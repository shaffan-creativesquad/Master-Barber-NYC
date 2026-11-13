import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateMemberCode } from "@/lib/members.functions";
import { escapeLike } from "@/lib/escape-like";
import {
  parseCsv, missingColumns, MEMBERS_REQUIRED_COLUMNS, CONTACTS_REQUIRED_COLUMNS,
  buildPhoneLookup, mapPlan, splitName, isTrue, normEmail,
  MULTI_SUBSCRIPTION_NAMES, type PlanMapping,
} from "@/lib/member-import";

const inputSchema = z.object({
  members_csv: z.string().min(1).max(6_000_000),
  contacts_csv: z.string().min(1).max(12_000_000),
});

async function requireAdminUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin")) throw new Error("Admin access required.");
}

type Prepared = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  active: boolean;
  plan: PlanMapping | null;
  raw_plan: string;
  start_date: string;
  name_review: boolean;
  multi: boolean;
};

type Invalid = { row: number; email: string; reason: string };

function prepare(membersCsv: string, contactsCsv: string) {
  const members = parseCsv(membersCsv);
  const contacts = parseCsv(contactsCsv);

  const missingMembers = missingColumns(members, MEMBERS_REQUIRED_COLUMNS);
  const missingContacts = missingColumns(contacts, CONTACTS_REQUIRED_COLUMNS);
  if (missingMembers.length) throw new Error(`Members file is missing columns: ${missingMembers.join(", ")}`);
  if (missingContacts.length) throw new Error(`Contacts file is missing columns: ${missingContacts.join(", ")}`);

  const phones = buildPhoneLookup(contacts);

  const valid: Prepared[] = [];
  const invalid: Invalid[] = [];
  const unmapped = new Map<string, number>();
  const seen = new Set<string>();

  members.forEach((r, i) => {
    const rowNo = i + 2;
    const email = normEmail(r["login_email"]);
    if (!email || !email.includes("@")) {
      invalid.push({ row: rowNo, email: r["login_email"] ?? "", reason: "Missing or invalid login_email" });
      return;
    }
    if (seen.has(email)) {
      invalid.push({ row: rowNo, email, reason: "Duplicate email inside the members file (later row skipped)" });
      return;
    }
    seen.add(email);

    const full = (r["full_name"] ?? "").trim();
    if (!full) {
      invalid.push({ row: rowNo, email, reason: "Missing full_name" });
      return;
    }
    const { first_name, last_name, needsNameReview } = splitName(full);
    const active = isTrue(r["has_active_subscription"]);
    const rawPlan = (r["current_subscription_plan"] ?? "").trim();
    const plan = active ? mapPlan(rawPlan) : null;
    if (active && !plan) unmapped.set(rawPlan || "(blank)", (unmapped.get(rawPlan || "(blank)") ?? 0) + 1);

    valid.push({
      email,
      first_name,
      last_name,
      phone: phones.get(email) ?? null,
      active,
      plan,
      raw_plan: rawPlan,
      start_date: (r["subscription_start_date"] ?? "").trim(),
      name_review: needsNameReview,
      multi: MULTI_SUBSCRIPTION_NAMES.includes(full.toLowerCase()),
    });
  });

  return { total: members.length, valid, invalid, unmapped };
}

export const dryRunMemberImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminUser(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { total, valid, invalid, unmapped } = prepare(data.members_csv, data.contacts_csv);

    const emails = valid.map((v) => v.email);
    const existing = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const { data: rows } = await supabaseAdmin
        .from("customers").select("email").in("email", emails.slice(i, i + 200));
      (rows ?? []).forEach((r) => existing.add(normEmail(r.email)));
    }

    return {
      total_rows: total,
      valid_rows: valid.length,
      invalid_rows: invalid,
      new_customers: valid.filter((v) => !existing.has(v.email)).length,
      existing_customers: valid.filter((v) => existing.has(v.email)).length,
      active_memberships: valid.filter((v) => v.active && v.plan).length,
      unmapped_plans: [...unmapped.entries()].map(([plan, count]) => ({ plan, count })),
      with_phone: valid.filter((v) => v.phone).length,
      without_phone: valid.filter((v) => !v.phone).length,
      name_review: valid.filter((v) => v.name_review).map((v) => ({ email: v.email, first_name: v.first_name })),
      multi_subscription: valid
        .filter((v) => v.multi)
        .map((v) => ({ name: `${v.first_name} ${v.last_name}`.trim(), email: v.email, plan: v.raw_plan })),
    };
  });

export const commitMemberImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminUser(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { valid } = prepare(data.members_csv, data.contacts_csv);

    let created = 0, updated = 0, membershipsCreated = 0, membershipsUpdated = 0, codes = 0;
    const errors: Array<{ email: string; message: string }> = [];
    const importedCustomerIds: string[] = [];

    for (const v of valid) {
      try {
        // Escape LIKE wildcards so emails containing _ % or \ match literally.
        const emailPattern = escapeLike(v.email);
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id,member_code,phone")
          .ilike("email", emailPattern)
          .maybeSingle();


        let customerId: string;
        if (existing) {
          const patch: { first_name: string; last_name: string; imported_from: string; phone?: string; member_code?: string } = {
            first_name: v.first_name,
            last_name: v.last_name,
            imported_from: "wix",
          };
          if (v.phone) patch.phone = v.phone;
          if (!existing.member_code) { patch.member_code = generateMemberCode(); codes++; }
          const { error } = await supabaseAdmin.from("customers").update(patch).eq("id", existing.id);
          if (error) throw new Error(error.message);
          customerId = existing.id;
          updated++;
        } else {
          const { data: ins, error } = await supabaseAdmin
            .from("customers")
            .insert({
              first_name: v.first_name,
              last_name: v.last_name,
              email: v.email,
              phone: v.phone ?? "",
              imported_from: "wix",
              member_code: generateMemberCode(),
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          customerId = ins.id;
          created++; codes++;
        }
        importedCustomerIds.push(customerId);

        if (v.active && v.plan) {
          // Match on customer_id alone so the import updates whatever membership
          // row already exists (manual, stripe or imported) instead of duplicating.
          const { data: existingRows } = await supabaseAdmin
            .from("memberships")
            .select("id")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })
            .limit(1);
          const existingM = existingRows?.[0] ?? null;


          const payload = {
            plan_id: v.plan.plan_id,
            tier: v.plan.tier,
            status: "active" as const,
            source: "imported",
            stripe_subscription_id: null,
            needs_review: true,
            // No date is estimated at import time; an admin types the real one in Edit.
            current_period_end: null,
            created_at: v.start_date ? new Date(v.start_date).toISOString() : new Date().toISOString(),
          };

          if (existingM) {
            const { error } = await supabaseAdmin.from("memberships").update(payload).eq("id", existingM.id);
            if (error) throw new Error(error.message);
            membershipsUpdated++;
          } else {
            const { error } = await supabaseAdmin
              .from("memberships").insert({ customer_id: customerId, ...payload });
            if (error) throw new Error(error.message);
            membershipsCreated++;
          }
        }
      } catch (e) {
        errors.push({ email: v.email, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      customers_created: created,
      customers_updated: updated,
      memberships_created: membershipsCreated,
      memberships_updated: membershipsUpdated,
      member_codes_generated: codes,
      errors,
    };
  });

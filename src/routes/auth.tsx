import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";

function safeRedirect(v: unknown): string | null {
  if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect: string | null } => ({
    redirect: safeRedirect(search.redirect),
  }),
  head: () => ({
    meta: [
      { title: "Staff Sign In | Master Barber NYC" },
      { name: "description", content: "Team access for Master Barber NYC." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      if (redirect) navigate({ to: redirect });
      else navigate({ to: await homeFor() });
    })();
  }, [navigate, redirect]);

  async function homeFor(): Promise<"/admin" | "/validator"> {
    try {
      const r = await getIsAdmin();
      return r.isAdmin ? "/admin" : "/validator";
    } catch {
      return "/admin";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (redirect) navigate({ to: redirect });
        else navigate({ to: await homeFor() });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg("If that email has staff access, a reset link is on its way. Check the inbox.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4 py-16 text-cream">
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-white/[0.02] p-10">
        <Link to="/" className="text-[10px] uppercase tracking-[0.32em] text-cream/50 hover:text-gold">← Back to site</Link>
        <div className="mt-6 eyebrow">Staff Access</div>
        <h1 className="mt-3 font-display text-3xl">{mode === "signin" ? "Sign in" : "Reset password"}</h1>
        <p className="mt-2 text-sm text-cream/60">
          {mode === "signin"
            ? "Team access to the booking dashboard."
            : "Enter your staff email and we'll send a link to set a new password."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          {mode === "signin" && (
            <Field label="Password" value={password} onChange={setPassword} type="password" required minLength={8} />
          )}
          {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
          {msg && <div className="rounded-sm border border-gold/40 bg-gold/10 p-3 text-sm text-gold">{msg}</div>}
          <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-40">
            {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Please wait…</> : mode === "signin" ? "Sign in" : "Send reset link"}
          </button>
        </form>

        <button type="button" onClick={() => { setMode(mode === "signin" ? "forgot" : "signin"); setErr(null); setMsg(null); }} className="mt-6 text-xs uppercase tracking-[0.24em] text-cream/60 hover:text-gold">
          {mode === "signin" ? "Forgot password?" : "← Back to sign in"}
        </button>
      </div>
    </div>
  );
}


function Field({ label, value, onChange, type = "text", ...rest }: { label: string; value: string; onChange: (v: string) => void; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/60">{label}</span>
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-sm border border-white/15 bg-black/40 px-4 py-3 text-cream focus:border-gold focus:outline-none"
      />
    </label>
  );
}

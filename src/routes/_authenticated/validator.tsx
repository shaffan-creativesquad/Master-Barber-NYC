import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin.functions";
import { Loader2, LogOut, ScanLine, CreditCard, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/validator")({
  head: () => ({
    meta: [
      { title: "Membership Validator | Master Barber NYC" },
      { name: "description", content: "Membership check-in kiosk and ledger for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ValidatorLayout,
});

function ValidatorLayout() {
  const navigate = useNavigate();
  const isAdminFn = useServerFn(getIsAdmin);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      try {
        const r = await isAdminFn();
        setIsAdmin(!!r.isAdmin);
        setState(r.isAdmin || r.isStaff ? "ok" : "denied");
      } catch {
        setState("denied");
      }
    })();
  }, [isAdminFn]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: null } });
  }

  if (state === "loading") {
    return <div className="grid min-h-screen place-items-center bg-ink text-cream/60"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (state === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-4 text-cream">
        <div className="max-w-md rounded-sm border border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="eyebrow">Staff only</div>
          <h1 className="mt-3 font-display text-2xl">This area is staff-only</h1>
          <p className="mt-3 text-sm text-cream/60">Signed in as {email}.</p>
          <button onClick={signOut} className="mt-6 text-xs uppercase tracking-[0.24em] text-cream/60 hover:text-gold">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="flex flex-col items-center gap-4 border-b border-white/10 bg-black/40 px-4 py-6 text-center">
        <div>
          <Link to="/" className="font-display text-xl text-gold">Master Barber</Link>
          <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-cream/40">Membership Validator</div>
        </div>
        <nav className="flex items-center gap-6 text-xs">
          <Link
            to="/validator"
            activeOptions={{ exact: true }}
            className="inline-flex items-center gap-1.5 text-cream/70 hover:text-gold [&.active]:text-gold"
          >
            <ScanLine className="h-3.5 w-3.5" /> Kiosk
          </Link>
          <Link
            to="/validator/members"
            className="inline-flex items-center gap-1.5 text-cream/70 hover:text-gold [&.active]:text-gold"
          >
            <CreditCard className="h-3.5 w-3.5" /> Members
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-cream/70 hover:text-gold [&.active]:text-gold"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
          <button onClick={signOut} className="inline-flex items-center gap-1.5 text-cream/50 hover:text-gold">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </nav>
      </header>
      <main className="flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}

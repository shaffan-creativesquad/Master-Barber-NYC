import { createFileRoute, Outlet, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin, bootstrapFirstAdmin } from "@/lib/admin.functions";
import { LayoutDashboard, Calendar, Scissors, Users, Settings, LogOut, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Master Barber NYC" },
      { name: "description", content: "Staff admin area for Master Barber NYC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const isAdminFn = useServerFn(getIsAdmin);
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      try {
        const r = await isAdminFn();
        if (r.isAdmin) {
          setState("ok");
        } else if (r.isStaff) {
          // Staff accounts belong at the membership validator, not booking admin.
          navigate({ to: "/validator", replace: true });
        } else {
          setState("denied");
        }
      } catch {
        setState("denied");
      }
    })();
  }, [isAdminFn, navigate]);

  async function claimAdmin() {
    setErr(null);
    try {
      const res = await bootstrapFn();
      if (!res.ok) {
        setErr(res.message);
        return;
      }
      const r = await isAdminFn();
      setState(r.isAdmin ? "ok" : "denied");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

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
          <div className="eyebrow">Admin required</div>
          <h1 className="mt-3 font-display text-2xl">This area is admin-only</h1>
          <p className="mt-3 text-sm text-cream/60">Signed in as {email}. Your account does not have admin access.</p>
          <div className="mt-6 flex flex-col gap-3">
            <button onClick={claimAdmin} className="btn-gold">Claim admin (first user only)</button>
            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{err}</div>}
            <button onClick={signOut} className="text-xs uppercase tracking-[0.24em] text-cream/60 hover:text-gold">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-cream">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-white/10 bg-black/40 p-6 md:block">
        <Link to="/" className="font-display text-xl text-gold">Master Barber</Link>
        <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-cream/40">Admin</div>
        <nav className="mt-10 space-y-1 text-sm">
          <NavLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" exact />
          <NavLink to="/admin/appointments" icon={<Calendar className="h-4 w-4" />} label="Appointments" />
          <NavLink to="/admin/services" icon={<Scissors className="h-4 w-4" />} label="Services" />
          <NavLink to="/admin/barbers" icon={<Users className="h-4 w-4" />} label="Barbers" />
          <NavLink to="/validator/members" icon={<Users className="h-4 w-4" />} label="Members" />
          <NavLink to="/admin/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
        </nav>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-cream/50">
          <div className="truncate">{email}</div>
          <button onClick={signOut} className="mt-3 inline-flex items-center gap-2 text-cream/60 hover:text-gold">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <div className="md:ml-60">
        <MobileNav email={email} onSignOut={signOut} />
        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLink({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex items-center gap-3 rounded-sm px-3 py-2 text-cream/70 hover:bg-white/5 hover:text-gold [&.active]:bg-gold/10 [&.active]:text-gold"
    >
      {icon} {label}
    </Link>
  );
}

function MobileNav({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 md:hidden">
      <div className="flex gap-3 overflow-x-auto text-xs">
        <Link to="/admin" className="text-cream/70 [&.active]:text-gold" activeOptions={{ exact: true }}>Dashboard</Link>
        <Link to="/admin/appointments" className="text-cream/70 [&.active]:text-gold">Appts</Link>
        <Link to="/admin/services" className="text-cream/70 [&.active]:text-gold">Services</Link>
        <Link to="/admin/barbers" className="text-cream/70 [&.active]:text-gold">Barbers</Link>
        <Link to="/validator/members" className="text-cream/70 [&.active]:text-gold">Members</Link>
        <Link to="/admin/settings" className="text-cream/70 [&.active]:text-gold">Settings</Link>
      </div>
      <button onClick={onSignOut} className="text-[10px] uppercase tracking-[0.24em] text-cream/60"><LogOut className="inline h-3 w-3" /></button>
    </div>
  );
}

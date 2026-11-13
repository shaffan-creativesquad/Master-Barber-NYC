import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password | Master Barber NYC" },
      { name: "description", content: "Set a new password for your Master Barber NYC staff account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErr("This reset link is invalid or has expired. Request a new one from the sign-in page.");
      }
      setReady(true);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate({ to: "/auth", search: { redirect: null } }), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4 py-16 text-cream">
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-white/[0.02] p-10">
        <Link to="/auth" search={{ redirect: null }} className="text-[10px] uppercase tracking-[0.32em] text-cream/50 hover:text-gold">← Back to sign in</Link>
        <div className="mt-6 eyebrow">Staff Access</div>
        <h1 className="mt-3 font-display text-3xl">Set a new password</h1>

        {!ready ? (
          <p className="mt-6 text-sm text-cream/60"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Checking your link…</p>
        ) : done ? (
          <div className="mt-6 rounded-sm border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
            Password updated. Taking you to sign in…
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="New password" value={password} onChange={setPassword} type="password" required minLength={8} />
            <Field label="Confirm password" value={confirm} onChange={setConfirm} type="password" required minLength={8} />
            {err && <div className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
            <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-40">
              {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Saving…</> : "Update password"}
            </button>
          </form>
        )}
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

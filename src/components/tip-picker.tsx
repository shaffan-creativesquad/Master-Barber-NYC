import { useState } from "react";
import { TIP_FLAT_CENTS, TIP_PERCENTS, tipFromPercent } from "@/lib/site-data";

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

/** Flat, percentage, custom, or no tip. Reports the tip in cents. */
export function TipPicker({ baseCents, value, onChange, percentLabel }: {
  baseCents: number; value: number; onChange: (cents: number) => void; percentLabel?: string;
}) {
  const [mode, setMode] = useState<string>("none");
  const [custom, setCustom] = useState("");
  const btn = (on: boolean) =>
    "rounded-sm border px-4 py-2.5 text-sm transition " +
    (on ? "border-gold bg-gold/15 text-gold" : "border-white/10 bg-white/[0.02] text-cream/75 hover:border-gold/50");
  const pick = (key: string, cents: number) => { setMode(key); setCustom(""); onChange(cents); };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {TIP_FLAT_CENTS.map((c) => (
          <button key={c} type="button" className={btn(mode === `f${c}`)} onClick={() => pick(`f${c}`, c)}>{money(c)}</button>
        ))}
        {TIP_PERCENTS.map((p) => {
          const c = tipFromPercent(baseCents, p);
          return (
            <button key={p} type="button" className={btn(mode === `p${p}`)} onClick={() => pick(`p${p}`, c)}>
              {p}% <span className="text-xs opacity-70">({money(c)})</span>
            </button>
          );
        })}
        <button type="button" className={btn(mode === "none")} onClick={() => pick("none", 0)}>No tip</button>
        <div className={"flex items-center gap-2 rounded-sm border px-3 " + (mode === "custom" ? "border-gold" : "border-white/10") + " bg-white/[0.02]"}>
          <span className="text-sm text-cream/50">$</span>
          <input value={custom} inputMode="decimal" placeholder="Custom"
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              setCustom(v); setMode("custom");
              const n = Math.round(parseFloat(v || "0") * 100);
              onChange(Number.isFinite(n) && n > 0 ? Math.min(n, 50000) : 0);
            }}
            className="w-20 bg-transparent py-2.5 text-sm text-cream outline-none" />
        </div>
      </div>
      {percentLabel && <p className="mt-2 text-xs text-cream/45">{percentLabel}</p>}
      {value > 0 && <p className="mt-2 text-xs text-cream/60">Tip: {money(value)} (no tax on tips)</p>}
    </div>
  );
}

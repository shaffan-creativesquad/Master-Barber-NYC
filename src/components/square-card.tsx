import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSquareConfig } from "@/lib/square.functions";
import { Loader2 } from "lucide-react";

type SquareCardInstance = {
  attach: (el: HTMLElement) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>;
  destroy?: () => Promise<void>;
};

type SquarePayments = {
  card: (opts?: Record<string, unknown>) => Promise<SquareCardInstance>;
  verifyBuyer: (token: string, details: Record<string, unknown>) => Promise<{ token?: string } | null>;
};

type SquareGlobal = {
  payments: (appId: string, locationId: string) => SquarePayments;
};

const CARD_STYLE = {
  input: { color: "#f3ede4", fontSize: "15px", backgroundColor: "#0a0a0a" },
  ".input-container": {
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: "2px",
    borderWidth: "1px",
  },
  ".input-container.is-focus": { borderColor: "#c9a84c" },
  ".input-container.is-error": { borderColor: "#f87171" },
  ".message-text": { color: "#f3ede4" },
  ".message-icon": { color: "#f3ede4" },
  "input::placeholder": { color: "rgba(243,237,228,0.45)" },
};


let sdkPromise: Promise<SquareGlobal> | null = null;

function loadSquareSdk(url: string): Promise<SquareGlobal> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SquareGlobal>((resolve, reject) => {
    const existing = (window as unknown as { Square?: SquareGlobal }).Square;
    if (existing) return resolve(existing);
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const sq = (window as unknown as { Square?: SquareGlobal }).Square;
      if (sq) resolve(sq);
      else reject(new Error("The secure card form could not load."));
    };
    script.onerror = () => reject(new Error("The secure card form could not load."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export type SquareTokenResult = { source_id: string; verification_token: string | null };

/**
 * Square Web Payments card field. Handles SDK loading, tokenizing and (when an
 * amount is supplied) buyer verification for 3-D Secure.
 */
export function SquareCardForm({
  buttonLabel,
  amountCents,
  cardholder,
  email,
  intent = "CHARGE",
  onToken,
  onError,
}: {
  buttonLabel: string;
  amountCents?: number | null;
  cardholder: string;
  email?: string;
  intent?: "CHARGE" | "STORE";
  onToken: (result: SquareTokenResult) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const configFn = useServerFn(getSquareConfig);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<SquareCardInstance | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await configFn();
        if (!config.application_id || !config.location_id) {
          if (!cancelled) setUnavailable("Card payments are not switched on yet.");
          return;
        }
        const sq = await loadSquareSdk(config.sdk_url);
        if (cancelled) return;
        const payments = sq.payments(config.application_id, config.location_id);
        paymentsRef.current = payments;
        const card = await payments.card({ style: CARD_STYLE });
        if (cancelled) {
          await card.destroy?.();
          return;
        }
        if (containerRef.current) await card.attach(containerRef.current);
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.().catch(() => undefined);
      cardRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    const card = cardRef.current;
    if (!card || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await card.tokenize();
      if (result.status !== "OK" || !result.token) {
        throw new Error(result.errors?.[0]?.message ?? "Please check the card details and try again.");
      }

      let verificationToken: string | null = null;
      const payments = paymentsRef.current;
      if (payments) {
        try {
          const verification = await payments.verifyBuyer(result.token, {
            intent,
            ...(intent === "CHARGE" && amountCents
              ? { amount: (amountCents / 100).toFixed(2), currencyCode: "USD" }
              : {}),
            billingContact: { givenName: cardholder.split(" ")[0] ?? cardholder, email },
          });
          verificationToken = verification?.token ?? null;
        } catch {
          verificationToken = null;
        }
      }

      await onToken({ source_id: result.token, verification_token: verificationToken });
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (unavailable) {
    return (
      <div className="rounded-sm border border-white/10 bg-white/[0.03] p-4 text-sm text-cream/60">{unavailable}</div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="min-h-[90px]" />
      {!ready && (
        <div className="flex items-center gap-3 py-4 text-sm text-cream/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading secure card form…
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!ready || busy}
        className="btn-gold mt-6 w-full disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Processing…
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
}

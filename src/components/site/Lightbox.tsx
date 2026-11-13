import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  alt?: string;
};

export function Lightbox({ images, index, onClose, onIndexChange, alt = "Gallery image" }: Props) {
  const total = images.length;
  const prev = useCallback(() => onIndexChange((index - 1 + total) % total), [index, total, onIndexChange]);
  const next = useCallback(() => onIndexChange((index + 1) % total), [index, total, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center border border-white/15 bg-ink/50 text-cream transition hover:border-gold hover:text-gold"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        aria-label="Previous image"
        className="absolute left-3 md:left-6 grid h-12 w-12 place-items-center border border-white/15 bg-ink/50 text-cream transition hover:border-gold hover:text-gold"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        aria-label="Next image"
        className="absolute right-3 md:right-6 grid h-12 w-12 place-items-center border border-white/15 bg-ink/50 text-cream transition hover:border-gold hover:text-gold"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div
        className="relative max-h-[88vh] max-w-[92vw] animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={index}
          src={images[index]}
          alt={`${alt} ${index + 1}`}
          className="max-h-[88vh] max-w-[92vw] object-contain shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] animate-in fade-in duration-300"
        />
        <div className="mt-3 text-center text-[11px] uppercase tracking-[0.28em] text-cream/60">
          {index + 1} / {total}
        </div>
      </div>
    </div>
  );
}

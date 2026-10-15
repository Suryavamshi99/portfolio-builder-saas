import { SELLING_POINTS } from "@/config/pricing";
import { usePricing } from "@/lib/use-pricing";

/**
 * The offer in three plain rows, shown wherever someone is about to pay, so
 * the price, what it includes and the renewal are all visible before the
 * click (no extra step): Today / You get / Next year.
 *
 * `compact` is the one-line-per-row version for toolbars and dialogs.
 */
export function OfferSummary({ compact = false }: { compact?: boolean }) {
  const pricing = usePricing();
  const points = compact ? SELLING_POINTS.slice(0, 3) : SELLING_POINTS;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs space-y-2" data-testid="offer-summary">
      <div className="flex gap-2">
        <span className="w-20 shrink-0 font-semibold uppercase tracking-wide text-[10px] text-accent pt-0.5">Today</span>
        <span className="text-foreground">
          <strong>{pricing.today}</strong> one time. Tax included.
        </span>
      </div>
      <div className="flex gap-2">
        <span className="w-20 shrink-0 font-semibold uppercase tracking-wide text-[10px] text-accent pt-0.5">You get</span>
        <ul className="space-y-1 text-foreground/80">
          {points.map((point) => (
            <li key={point} className="flex gap-1.5">
              <span className="text-accent">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2">
        <span className="w-20 shrink-0 font-semibold uppercase tracking-wide text-[10px] text-accent pt-0.5">
          Next year
        </span>
        <span className="text-foreground/80">
          Hosting renews at <strong className="text-foreground">{pricing.renewal}/year</strong>. Cancel anytime, you
          keep Pro and your downloads.
        </span>
      </div>
      <p className="pt-1 text-[11px] text-muted-foreground">
        Full refund within 14 days.{" "}
        <a className="underline" href="/refund" target="_blank" rel="noreferrer">
          Refund policy
        </a>
        {" · "}
        <a className="underline" href="/terms" target="_blank" rel="noreferrer">
          Terms
        </a>
      </p>
    </div>
  );
}

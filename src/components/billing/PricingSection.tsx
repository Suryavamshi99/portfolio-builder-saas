import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { OfferSummary } from "@/components/billing/OfferSummary";
import { usePricing } from "@/lib/use-pricing";

/**
 * Public price block for the landing page. Shows the same numbers and wording
 * as checkout (₹ in India, $ elsewhere), because anything that differs between
 * the page and the checkout reads as a trick.
 */
export function PricingSection() {
  const pricing = usePricing();

  return (
    <section id="pricing" className="mx-auto max-w-4xl space-y-6 text-center" aria-labelledby="pricing-title">
      <div className="space-y-2">
        <h2 id="pricing-title" className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Simple pricing. Pay once, go live today.
        </h2>
        <p className="text-sm text-muted-foreground">
          Try it free. Pay {pricing.today} when you&rsquo;re ready to publish. {pricing.autoRenews
            ? `Hosting renews at ${pricing.renewal}/year from year 2, and you can cancel anytime.`
            : `After year 1, keep hosting for ${pricing.renewal}/year. You renew yourself, nothing is charged automatically.`}
        </p>
      </div>

      <div className="grid gap-4 text-left sm:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <h3 className="text-base font-bold text-foreground">Free</h3>
          <p className="text-2xl font-extrabold text-foreground">
            {pricing.region === "IN" ? "₹0" : "$0"}
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>✓ Generate your portfolio from your resume</li>
            <li>✓ Full preview in Studio (with a watermark)</li>
            <li>✓ Refine it with AI</li>
            <li className="text-muted-foreground/70">✗ No publishing or downloads</li>
          </ul>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login" search={{ redirect: "/onboarding" }}>
              Start free
            </Link>
          </Button>
        </div>

        <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-xs">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">Pro + 1 year hosting</h3>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              14-day refund
            </span>
          </div>
          <OfferSummary />
          <Button asChild className="w-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
            <Link to="/login" search={{ redirect: "/onboarding" }}>
              Go live for {pricing.today}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

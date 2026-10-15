import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, LegalPage, OPERATOR_NAME, Section } from "@/components/legal/LegalPage";
import { pricingFor } from "@/config/pricing";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Shipfolio" },
      {
        name: "description",
        content: "What you get with Shipfolio, what it costs, how renewal and cancellation work, and the rules of use.",
      },
    ],
  }),
  component: TermsPage,
});

const LAST_UPDATED = "15 October 2026";

function TermsPage() {
  const inr = pricingFor("IN");
  const usd = pricingFor("ROW");
  return (
    <LegalPage title="Terms of Service" updated={LAST_UPDATED}>
      <p>
        Shipfolio is operated by {OPERATOR_NAME} (&ldquo;Shipfolio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        creating an account or paying, you agree to these terms. Questions:{" "}
        <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <Section title="1. The service">
        <p>
          Shipfolio turns your resume into a portfolio website written by an AI model. You can preview it for free. The
          preview carries a watermark and cannot be published or downloaded.
        </p>
      </Section>

      <Section title="2. What you pay">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Today:</strong> {usd.today} (or {inr.today} in India), one time, tax
            included. This unlocks Pro (clean HTML download, zip export, GitHub push, deploy to your own Vercel
            account, no watermark) and includes <strong className="text-foreground">1 year of hosting</strong> with a
            custom domain.
          </li>
          <li>
            <strong className="text-foreground">From year 2:</strong> hosting renews automatically every year at{" "}
            {usd.renewal} (or {inr.renewal} in India), tax included. You can cancel at any time before the renewal and
            you will not be charged.
          </li>
          <li>
            Prices may change for future renewals. We will email you at least 30 days before a renewal that costs
            more.
          </li>
        </ul>
        <p>
          Payments are processed by Dodo Payments, our Merchant of Record. By paying you also agree to their buyer
          terms. Taxes (such as GST or VAT) are included in the price you see.
        </p>
      </Section>

      <Section title="3. Cancelling and what happens next">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Pro is yours to keep.</strong> Cancelling the hosting renewal never
            removes Pro or the files you downloaded.
          </li>
          <li>
            <strong className="text-foreground">Hosting runs to the end of the paid year.</strong> If a renewal payment
            fails, your site stays live for 14 more days so you can fix your payment method. After that it goes
            offline and the custom domain is disconnected.
          </li>
          <li>You can bring a site back online at any time by renewing hosting.</li>
        </ul>
      </Section>

      <Section title="4. Refunds">
        <p>
          You can get a full refund within 14 days of any payment. See the{" "}
          <a className="text-accent underline" href="/refund">
            Refund Policy
          </a>
          .
        </p>
      </Section>

      <Section title="5. Your content">
        <p>
          You keep ownership of your resume, photos and the portfolio built from them. You give us permission to
          process them to provide the service (reading your resume, generating and hosting your site). You promise that
          what you upload is yours to use and is accurate.
        </p>
      </Section>

      <Section title="6. AI-generated pages">
        <p>
          Pages are written by an AI model and checked automatically for facts taken from your resume, but no check is
          perfect. Please read your page before you publish it. You are responsible for what you publish.
        </p>
      </Section>

      <Section title="7. Acceptable use">
        <p>
          You may not use hosted sites to impersonate another person or company, collect passwords or payment details,
          spread malware, host illegal content, or harass anyone. We may take a site offline or close an account that
          breaks these rules, with a refund of the unused part where the problem was not your doing.
        </p>
      </Section>

      <Section title="8. Availability and liability">
        <p>
          We work to keep Shipfolio running but do not promise it will be uninterrupted or error-free. To the fullest
          extent the law allows, our total liability for anything arising from the service is limited to the amount
          you paid us in the 12 months before the claim. Nothing here limits rights you have under the law that cannot
          be limited.
        </p>
      </Section>

      <Section title="9. Changes and law">
        <p>
          If we change these terms we will update the date above, and for material changes tell you by email or in the
          app. These terms are governed by the laws of India, and the courts of India have jurisdiction, without
          affecting any consumer rights you have where you live.
        </p>
      </Section>
    </LegalPage>
  );
}

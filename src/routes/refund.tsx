import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, LegalPage, Section } from "@/components/legal/LegalPage";
import { pricingFor } from "@/config/pricing";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Shipfolio" },
      {
        name: "description",
        content: "Full refund within 14 days of any payment. How to ask, and what happens after a refund.",
      },
    ],
  }),
  component: RefundPage,
});

const LAST_UPDATED = "15 October 2026";

function RefundPage() {
  const inr = pricingFor("IN");
  const usd = pricingFor("ROW");
  return (
    <LegalPage title="Refund Policy" updated={LAST_UPDATED}>
      <p>
        If Shipfolio isn&rsquo;t right for you, you can have your money back within 14 days. No forms and no
        questions about why.
      </p>

      <Section title="1. The 14-day refund">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">What it covers.</strong> Your first payment (
            {usd.today} / {inr.today}, which includes Pro and the first year of hosting) and any yearly hosting renewal
            ({usd.renewal} / {inr.renewal}).
          </li>
          <li>
            <strong className="text-foreground">How long.</strong> 14 days from the date of the charge.
          </li>
          <li>
            <strong className="text-foreground">How much.</strong> The full amount you paid, including any tax.
          </li>
        </ul>
      </Section>

      <Section title="2. How to ask">
        <p>
          Email{" "}
          <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          from the address on your account and say you want a refund. We will confirm by email and start the refund,
          normally within 2 working days. Your bank or card issuer may take a further 5 to 10 working days to show the
          money, and UPI refunds usually return to the same account.
        </p>
      </Section>

      <Section title="3. What happens after a refund">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your account returns to the free plan and the yearly hosting subscription is cancelled, so you won&rsquo;t be charged again.</li>
          <li>Your published site is taken offline and any custom domain is disconnected.</li>
          <li>
            Your portfolio is not deleted. You can still open it in Studio with the free preview (including the
            watermark) and you can delete your account at any time.
          </li>
          <li>
            Files you already downloaded are yours, but a refund means you should stop using Shipfolio hosting and
            paid features.
          </li>
        </ul>
      </Section>

      <Section title="4. Cancelling without a refund">
        <p>
          You can cancel the yearly hosting renewal at any time. You keep Pro, your downloads and your hosting until the
          end of the period you have already paid for, and you won&rsquo;t be charged again. Cancelling after the 14
          days does not return money already paid.
        </p>
      </Section>

      <Section title="5. Disputes and chargebacks">
        <p>
          Please email us first. We would rather refund you quickly than have you go through your bank. If a payment is
          disputed with your bank and the dispute is decided against us, the same steps as a refund apply to your
          account.
        </p>
      </Section>

      <Section title="6. Who handles the payment">
        <p>
          Payments are processed by Dodo Payments, our reseller and Merchant of Record. Dodo also handles order-related
          questions and returns, and their own buyer terms apply to the payment itself.
        </p>
      </Section>
    </LegalPage>
  );
}

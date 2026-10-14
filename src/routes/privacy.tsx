import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Shipfolio" },
      {
        name: "description",
        content: "How Shipfolio collects, uses, stores and deletes your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

const CONTACT_EMAIL = "vamshi.ravi99@gmail.com";
const LAST_UPDATED = "14 October 2026";

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-sm leading-relaxed text-muted-foreground sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="text-xs">Last updated: {LAST_UPDATED}</p>
      </header>

      <p>
        Shipfolio (&ldquo;Shipfolio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) turns your resume into a
        portfolio website. This policy explains what we collect, why, who we share it with, and how long we keep
        it. If you have a question, email{" "}
        <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <Section title="1. What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Account details.</strong> Your email address and password (stored
            hashed by our authentication provider). If you sign in with Google, we receive your email address and,
            where Google provides them, your name and profile picture.
          </li>
          <li>
            <strong className="text-foreground">Content you upload.</strong> Your resume (PDF or DOCX), optional
            reference screenshots, an optional profile photo, and any profile links or instructions you type in.
          </li>
          <li>
            <strong className="text-foreground">Your portfolio.</strong> The generated HTML of your site, and any edits
            you make in Studio.
          </li>
          <li>
            <strong className="text-foreground">Your API keys and tokens.</strong> If you connect a Google Gemini key
            or a Vercel account, we store the key or token encrypted (AES-256-GCM). We never display it back to you
            or write it to logs.
          </li>
          <li>
            <strong className="text-foreground">Payment records.</strong> If you upgrade, our payment provider
            processes your payment. We receive confirmation and your plan status, not your card details.
          </li>
          <li>
            <strong className="text-foreground">Basic technical data.</strong> Standard server logs (such as IP
            address and request time) needed to run and secure the service.
          </li>
        </ul>
      </Section>

      <Section title="2. How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To create your account and sign you in.</li>
          <li>To read your resume and generate your portfolio when you ask us to.</li>
          <li>To publish your portfolio to your own Vercel account when you choose to publish it.</li>
          <li>To process your upgrade and enforce plan limits.</li>
          <li>To keep the service secure and fix problems.</li>
        </ul>
        <p>We do not sell your data.</p>
      </Section>

      <Section title="3. Who we share it with">
        <p>We share data only with the services needed to run Shipfolio:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Supabase</strong>: database, file storage and sign-in.
          </li>
          <li>
            <strong className="text-foreground">Google Gemini</strong>: when you generate a portfolio, your resume text
            and any screenshots or photo are sent to Google using your own API key. Google&rsquo;s own terms govern how
            Google handles that content; under some free-tier keys Google may use submitted content to improve its
            products. Check Google&rsquo;s terms for the key you connect.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong>: hosts Shipfolio, and hosts your published portfolio in
            your own Vercel account.
          </li>
          <li>
            <strong className="text-foreground">Google sign-in</strong>: if you choose to sign in with Google.
          </li>
          <li>
            <strong className="text-foreground">Dodo Payments</strong>: processes the one-time Pro payment.
          </li>
        </ul>
      </Section>

      <Section title="4. How long we keep it">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Resumes and reference screenshots</strong> are deleted 48 hours after
            your portfolio is generated.
          </li>
          <li>
            <strong className="text-foreground">Profile photos and project images</strong> are kept while your draft is
            active. If a draft is left untouched for 30 days, we delete them. Once you publish, the published copy
            lives in your own Vercel account, under your control.
          </li>
          <li>
            <strong className="text-foreground">Your portfolio draft and account</strong> are kept until you delete
            them or ask us to.
          </li>
        </ul>
      </Section>

      <Section title="5. Metadata in your photos">
        <p>
          We remove hidden location (GPS) and camera information from uploaded photos and images before storing them.
        </p>
      </Section>

      <Section title="6. Your choices">
        <p>
          You can edit or regenerate your portfolio at any time, disconnect your Google Gemini key or Vercel account
          from Settings, and delete your uploads. To delete your account and all data, email us at{" "}
          <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . You can also ask for a copy of your data, or for a correction.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          Data is encrypted in transit (HTTPS). API keys and tokens are encrypted at rest. Access to stored files is
          limited to your own account. No system is perfectly secure, so please use a strong, unique password.
        </p>
      </Section>

      <Section title="8. Changes">
        <p>
          If we change this policy, we will update the date above. For material changes we will tell you by email or
          in the app.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

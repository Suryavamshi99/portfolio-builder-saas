import type * as React from "react";

/** Same contact and operator details on every legal page, so they can't drift apart. */
export const CONTACT_EMAIL = "vamshi.ravi99@gmail.com";
export const OPERATOR_NAME = "Surya Vamshi";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-sm leading-relaxed text-muted-foreground sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-xs">Last updated: {updated}</p>
      </header>
      {children}
      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-xs">
        <a className="text-accent underline" href="/terms">
          Terms of Service
        </a>
        <a className="text-accent underline" href="/refund">
          Refund Policy
        </a>
        <a className="text-accent underline" href="/privacy">
          Privacy Policy
        </a>
        <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
          Contact: {CONTACT_EMAIL}
        </a>
      </nav>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

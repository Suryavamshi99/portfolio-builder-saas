import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ThemePicker } from "@/components/theme-picker";

export const Route = createFileRoute("/themes")({
  component: ThemesPage,
});

/** Public gallery of the portfolio looks. Picking one here only highlights it; building happens in onboarding. */
function ThemesPage() {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Portfolio looks</h1>
      <p className="mb-4 text-sm text-muted-foreground">Each look is a design language. Your portfolio is written from your own resume in the one you choose.</p>
      <ThemePicker value={value} onChange={setValue} />
    </main>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";

/** The public gallery of ready-made looks is taken down; this path now goes to the home page. */
export const Route = createFileRoute("/themes")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Portfolio Builder</h1>
      <p className="text-sm text-muted-foreground">
        Scaffold in progress — accounts, onboarding, and the live builder UI land here as
        milestones ship. See <code>API.md</code> for the endpoint contract.
      </p>
    </div>
  );
}

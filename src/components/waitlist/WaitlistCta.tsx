import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface WaitlistCtaProps {
  source?: string;
  buttonLabel?: string;
  className?: string;
  buttonClassName?: string;
  id?: string;
}

export function WaitlistCta({
  source = "landing",
  buttonLabel = "Join the waitlist",
  className,
  buttonClassName,
  id,
}: WaitlistCtaProps) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setErrorMessage(data?.error?.message ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMessage("Something went wrong. Try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div
        id={id}
        className={`flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 ${className ?? ""}`}
      >
        <CheckCircle2 className="size-4 shrink-0" />
        You're on the list — we'll email you when it's ready.
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className={`flex flex-col gap-2 ${className ?? ""}`} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="h-11 sm:w-64"
          aria-label="Email address"
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className={`h-11 gap-2 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-[0.98] ${buttonClassName ?? ""}`}
        >
          {status === "loading" ? "Joining…" : buttonLabel}
          {status !== "loading" && <ArrowRight className="size-4" />}
        </Button>
      </div>
      {status === "error" && <p className="text-xs text-destructive">{errorMessage}</p>}
    </form>
  );
}

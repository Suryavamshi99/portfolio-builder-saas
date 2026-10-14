import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/layout/Logo";

import { FluidOrb } from "@/components/ui/fluid-orb";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const res: { redirect?: string } = {};
    if (typeof search["redirect"] === "string" && search["redirect"]) {
      res.redirect = search["redirect"];
    }
    return res;
  },
  head: () => ({
    meta: [{ title: "Sign In / Sign Up — Shipfolio" }],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithPassword, signUp, signInWithGoogle, sendPasswordReset, supabaseConfigured, refreshPortfolioStatus } = useAuth();

  const [activeTab, setActiveTab] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Where to land after auth succeeds: an explicit `redirect` (e.g. AuthGuard
  // bounced someone off a protected page) always wins. Otherwise, default to
  // the wizard until a portfolio actually exists — Studio isn't the landing
  // page for a first-time or still-empty account.
  const resolveDestination = React.useCallback(async (): Promise<string> => {
    if (redirect) return redirect;
    const ready = await refreshPortfolioStatus();
    return ready ? "/studio" : "/onboarding";
  }, [redirect, refreshPortfolioStatus]);

  // If already authenticated, redirect to destination
  React.useEffect(() => {
    if (user) {
      void resolveDestination().then((to) => {
        // /authorize is a server route (the connector consent page), not a client route: load it normally.
        if (to.startsWith("/authorize?")) window.location.assign(to);
        else navigate({ to: to as any });
      });
    }
  }, [user, resolveDestination, navigate]);

  const handleForgot = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!email) {
      setErrorMsg("Enter your email above first, then choose Forgot password.");
      return;
    }
    setLoading(true);
    const { error } = await sendPasswordReset(email);
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else setSuccessMsg("If an account exists for that address, a password reset link is on its way. It may land in spam.");
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    const { error } = await signInWithGoogle();
    if (error) setErrorMsg(error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      if (activeTab === "signin") {
        const { error } = await signInWithPassword(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          const to = await resolveDestination();
          void navigate({ to: to as any });
        }
      } else {
        const { error, user: createdUser } = await signUp(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else if (createdUser && !createdUser.confirmed_at) {
          setSuccessMsg(
            "Account created! Check your inbox for a confirmation email from Supabase (sender address looks like noreply@mail.app.supabase.io) — it sometimes lands in spam. Confirm it, then come back and sign in."
          );
        } else {
          // No email confirmation required — a brand-new account always starts in the wizard.
          void navigate({ to: (redirect ?? "/onboarding") as any });
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Returning from Google (or already signed in): the session is still being read or we are about to
  // redirect, so show a spinner instead of flashing the sign-in form.
  if (authLoading || user) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center" role="status" aria-label="Signing you in">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-12">
      {/* Ambient FluidOrb Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-35 dark:opacity-20 blur-3xl">
        <FluidOrb size={380} color="#3457E8" />
      </div>

      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back to overview
        </Link>
      </div>

      <Card className="border-border/80 bg-card/95 backdrop-blur-xl shadow-xl rounded-2xl">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="flex justify-center pb-1">
            <Logo size="md" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {activeTab === "signin" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-xs">
            {activeTab === "signin"
              ? "Sign in to access your Shipfolio studio and deployments."
              : "Start turning your resume into a live published portfolio."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!supabaseConfigured && (
            <Alert variant="warning" className="mb-6">
              <AlertTitle>Configuration Required</AlertTitle>
              <AlertDescription>
                Supabase credentials (<code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code>) are not
                configured in <code>.env</code>.
              </AlertDescription>
            </Alert>
          )}

          {errorMsg && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Authentication error</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert variant="success" className="mb-6">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as "signin" | "signup");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
          >
            <TabsList className="mb-6 grid w-full grid-cols-2 bg-muted/60 p-1">
              <TabsTrigger value="signin" className="text-xs font-semibold">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-xs font-semibold">Sign Up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="auth-email" className="text-xs font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading || !supabaseConfigured}
                  className="bg-background/60"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-password" className="text-xs font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={activeTab === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  disabled={loading || !supabaseConfigured}
                  className="bg-background/60"
                />
              </div>

              {activeTab === "signin" && (
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading || !supabaseConfigured}
                  className="block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              )}

              <Button
                type="submit"
                className="w-full font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-[0.98]"
                disabled={loading || !supabaseConfigured}
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {activeTab === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 font-semibold"
              onClick={handleGoogle}
              disabled={loading || !supabaseConfigured}
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
              Continue with Google
            </Button>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-accent" />
            <span>Secure Supabase Auth session & encrypted credentials</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

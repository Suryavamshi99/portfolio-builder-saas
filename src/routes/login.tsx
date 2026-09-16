import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const res: { redirect?: string } = {};
    if (typeof search["redirect"] === "string" && search["redirect"]) {
      res.redirect = search["redirect"];
    }
    return res;
  },
  head: () => ({
    meta: [{ title: "Sign In / Sign Up — Portfolio Builder" }],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, signInWithPassword, signUp, supabaseConfigured } = useAuth();

  const [activeTab, setActiveTab] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // If already authenticated, redirect to destination
  React.useEffect(() => {
    if (user) {
      void navigate({ to: (redirect ?? "/studio") as any });
    }
  }, [user, redirect, navigate]);

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
          void navigate({ to: (redirect ?? "/studio") as any });
        }
      } else {
        const { error, user: createdUser } = await signUp(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else if (createdUser && !createdUser.confirmed_at) {
          setSuccessMsg(
            "Account created! If email confirmation is enabled on this project, check your inbox to confirm before signing in."
          );
        } else {
          void navigate({ to: (redirect ?? "/onboarding") as any });
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back to overview
        </Link>
      </div>

      <Card className="border-border shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {activeTab === "signin" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {activeTab === "signin"
              ? "Sign in to access your portfolio studio and deployments."
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
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
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
                />
              </div>

              <Button
                type="submit"
                className="w-full font-medium"
                disabled={loading || !supabaseConfigured}
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {activeTab === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>
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

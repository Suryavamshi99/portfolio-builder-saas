import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackUrl?: string;
  actionName?: string;
}

export function AuthGuard({
  children,
  fallbackUrl = "/login",
  actionName = "access this area",
}: AuthGuardProps) {
  const { user, loading, supabaseConfigured } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user && supabaseConfigured) {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
      void navigate({
        to: fallbackUrl as any,
        search: { redirect: currentPath } as any,
      });
    }
  }, [loading, user, supabaseConfigured, navigate, fallbackUrl]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center" role="status">
        <Loader2 className="size-6 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Checking authentication session…</p>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-md py-16">
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-warning">Supabase Credentials Needed</CardTitle>
            <CardDescription>
              <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> must be set in{" "}
              <code>.env</code> to enable sign-in.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Lock className="size-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>You must be signed in to {actionName}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to="/login" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }}>
                Sign in to continue
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

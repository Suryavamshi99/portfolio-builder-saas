import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Shipfolio" }] }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) return setError(err.message);
    setDone(true);
    setTimeout(() => void navigate({ to: "/login" }), 1500);
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Card className="rounded-2xl border-border/80">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
          <CardDescription className="text-xs">Open this page from the reset link in your email.</CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && !user ? (
            <Alert variant="warning">
              <AlertDescription>
                This reset link is missing or has expired. <Link to="/login" className="underline">Request a new one</Link> from the sign-in page.
              </AlertDescription>
            </Alert>
          ) : done ? (
            <Alert variant="success">
              <AlertDescription>Password updated. Taking you to sign in…</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Input type="password" placeholder="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={busy}>Update password</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// replaced by 08c
import * as React from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface SignInProps {
  onDone: () => void;
}

export function SignIn({ onDone }: SignInProps) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
        setError(data?.error?.message ?? "Sign-in failed");
        return;
      }
      onDone();
    } catch {
      setError("Failed to sign in due to a network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center space-y-6">
      <div className="space-y-1 text-center">
        <ShieldAlert className="mx-auto size-8 text-accent" />
        <h1 className="text-xl font-bold text-foreground">Admin sign-in</h1>
      </div>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="admin-username" className="text-xs font-medium text-muted-foreground">
            Username
          </label>
          <Input
            id="admin-username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
            Password
          </label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            required
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

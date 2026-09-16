import * as React from "react";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isPortfolioReady } from "@/lib/portfolio-gate";
import type { Content } from "@/data/content";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  supabaseConfigured: boolean;
  /** null = not checked yet. See src/lib/portfolio-gate.ts for what "ready" means and how it's used. */
  portfolioReady: boolean | null;
  refreshPortfolioStatus: () => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; user: User | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

let cachedClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!cachedClient) {
    try {
      cachedClient = createSupabaseBrowserClient();
    } catch (e) {
      console.warn("Supabase browser client could not be initialized:", e);
      return null;
    }
  }
  return cachedClient;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = React.useState(true);
  const [portfolioReady, setPortfolioReady] = React.useState<boolean | null>(null);

  const client = React.useMemo(() => getBrowserClient(), []);

  const refreshPortfolioStatus = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/content");
      if (!res.ok) {
        setPortfolioReady(false);
        return false;
      }
      const json = (await res.json()) as { content: Content };
      const ready = isPortfolioReady(json.content);
      setPortfolioReady(ready);
      return ready;
    } catch {
      setPortfolioReady(false);
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (!client) {
      setSupabaseConfigured(false);
      setLoading(false);
      return;
    }

    setSupabaseConfigured(true);

    client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  React.useEffect(() => {
    if (!user) {
      setPortfolioReady(null);
      return;
    }
    void refreshPortfolioStatus();
  }, [user, refreshPortfolioStatus]);

  const signInWithPassword = async (email: string, password: string) => {
    if (!client) {
      return { error: new Error("Supabase is not configured yet. Check environment variables.") };
    }
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!client) {
      return {
        error: new Error("Supabase is not configured yet. Check environment variables."),
        user: null,
      };
    }
    const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });
    return { error, user: data.user };
  };

  const signOut = async () => {
    if (!client) return;
    await client.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshSession = async () => {
    if (!client) return;
    const { data } = await client.auth.refreshSession();
    setSession(data.session);
    setUser(data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        supabaseConfigured,
        portfolioReady,
        refreshPortfolioStatus,
        signInWithPassword,
        signUp,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

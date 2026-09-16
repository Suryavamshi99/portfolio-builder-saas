import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  LayoutTemplate,
  LogOut,
  LogIn,
  KeyRound,
  Sun,
  Moon,
  FolderUp,
} from "lucide-react";

export function Navbar() {
  const { user, signOut, loading } = useAuth();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [darkMode, setDarkMode] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark =
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80">
            <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-xs">
              <Sparkles className="size-4" />
            </div>
            <span className="text-sm font-bold sm:text-base">Portfolio Builder</span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-wider">
              BYOK
            </Badge>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                to="/studio"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPath.startsWith("/studio")
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <LayoutTemplate className="size-3.5" />
                  Studio
                </span>
              </Link>
              <Link
                to="/onboarding"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPath.startsWith("/onboarding")
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FolderUp className="size-3.5" />
                  Wizard
                </span>
              </Link>
              <Link
                to="/settings"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPath.startsWith("/settings")
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="size-3.5" />
                  BYOK & Storage
                </span>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden max-w-[150px] truncate text-xs text-muted-foreground sm:inline-block">
                    {user.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                    <Link to="/login" search={{ redirect: currentPath }}>
                      <LogIn className="mr-1.5 size-3.5" />
                      Sign in
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

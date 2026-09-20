import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessStudio } from "@/lib/portfolio-gate";
import { getLaunchMode } from "@/config/launch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import {
  Sparkles,
  LayoutTemplate,
  LogOut,
  LogIn,
  KeyRound,
  Sun,
  Moon,
  FolderUp,
  Lock,
  ArrowRight,
} from "lucide-react";

export function Navbar() {
  const { user, signOut, loading, portfolioReady } = useAuth();
  const studioUnlocked = canAccessStudio({ portfolioReady });
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
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="group flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="Shipfolio Home"
          >
            <Logo size="sm" />
            <Badge
              variant="secondary"
              className="hidden lg:inline-flex text-[10px] uppercase font-mono tracking-wider text-muted-foreground"
            >
              AI Builder
            </Badge>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {studioUnlocked ? (
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
              ) : (
                <span
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground/50"
                  title="Generate your portfolio in the wizard first to unlock Studio"
                >
                  <Lock className="size-3" />
                  Studio
                </span>
              )}
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
              ) : getLaunchMode() === "waitlist" ? (
                <Button
                  asChild
                  size="sm"
                  className="h-8 bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Link to="/" hash="waitlist" hashScrollIntoView>
                    Join waitlist
                  </Link>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium">
                    <Link to="/login" search={{ redirect: currentPath }}>
                      <LogIn className="mr-1.5 size-3.5" />
                      Sign in
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="h-8 bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    <Link to="/login" search={{ redirect: "/onboarding" }}>
                      Create my portfolio
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

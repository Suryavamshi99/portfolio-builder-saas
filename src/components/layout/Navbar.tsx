import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessStudio } from "@/lib/portfolio-gate";
import { getLaunchMode } from "@/config/launch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import {
  LayoutTemplate,
  LogOut,
  LogIn,
  KeyRound,
  Sun,
  Moon,
  FolderUp,
  Lock,
  Menu,
  X,
} from "lucide-react";

export function Navbar() {
  const { user, signOut, loading, portfolioReady } = useAuth();
  const studioUnlocked = canAccessStudio({ portfolioReady });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [darkMode, setDarkMode] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

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
                  <span className="hidden max-w-[150px] truncate text-xs text-muted-foreground lg:inline-block">
                    {user.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 hidden sm:inline-flex"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign out</span>
                  </Button>
                  {/* Mobile hamburger menu toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
                    className="size-8 text-muted-foreground hover:text-foreground md:hidden"
                  >
                    {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                  </Button>
                </div>
              ) : getLaunchMode() === "waitlist" ? (
                <Button
                  asChild
                  size="sm"
                  className="h-8 bg-accent px-3.5 text-xs font-semibold text-accent-foreground shadow-xs hover:bg-accent/90"
                >
                  <Link to="/" hash="waitlist" hashScrollIntoView>
                    Join waitlist
                  </Link>
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs font-medium">
                    <Link to="/login" search={{ redirect: currentPath }}>
                      <LogIn className="mr-1 sm:mr-1.5 size-3.5" />
                      <span>Sign in</span>
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="h-8 bg-accent px-2.5 sm:px-3.5 text-xs font-semibold text-accent-foreground shadow-xs hover:bg-accent/90"
                  >
                    <Link to="/login" search={{ redirect: "/onboarding" }}>
                      <span className="hidden sm:inline">Create portfolio</span>
                      <span className="sm:hidden">Create</span>
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile navigation panel for logged-in users */}
      {user && mobileMenuOpen && (
        <div className="border-t border-border/80 bg-background/95 backdrop-blur-md px-4 py-3 md:hidden space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="text-[11px] font-mono text-muted-foreground px-2 py-1 truncate">
            Signed in as {user.email}
          </div>
          <nav className="flex flex-col gap-1">
            {studioUnlocked ? (
              <Link
                to="/studio"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  currentPath.startsWith("/studio")
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <LayoutTemplate className="size-4 text-accent" />
                <span>Studio</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/50">
                <Lock className="size-4" />
                <span>Studio (Generate portfolio first)</span>
              </div>
            )}
            <Link
              to="/onboarding"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                currentPath.startsWith("/onboarding")
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FolderUp className="size-4 text-accent" />
              <span>Wizard</span>
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                currentPath.startsWith("/settings")
                  ? "bg-accent/15 text-accent font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <KeyRound className="size-4 text-accent" />
              <span>BYOK & Storage</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

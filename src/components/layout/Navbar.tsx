import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessStudio } from "@/lib/portfolio-gate";
import { getLaunchMode } from "@/config/launch";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import {
  LayoutTemplate,
  LogOut,
  LogIn,
  FolderUp,
  Lock,
  Menu,
  Settings,
  User,
  X,
} from "lucide-react";

export function Navbar() {
  const { user, signOut, loading, portfolioReady, isAdmin } = useAuth();
  const studioUnlocked = canAccessStudio({ portfolioReady, isAdmin });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isGuestHome = currentPath === "/" && !loading && !user;
  const linkBase = "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors";

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto grid h-[72px] max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="group flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="Shipfolio Home"
          >
            <Logo size="lg" />
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {studioUnlocked ? (
                <Link
                  to="/studio"
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    currentPath.startsWith("/studio")
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutTemplate className="size-3.5" />
                    Edit my portfolio
                  </span>
                </Link>
              ) : (
                <Link
                  to="/onboarding"
                  title="Create your portfolio first. Then you can edit it here."
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <Lock className="size-3" />
                  Edit my portfolio
                </Link>
              )}
              <Link
                to="/onboarding"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  currentPath.startsWith("/onboarding")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FolderUp className="size-3.5" />
                  Create
                </span>
              </Link>
              <Link
                to="/settings"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  currentPath.startsWith("/settings")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Settings className="size-3.5" />
                  Account
                </span>
              </Link>
            </nav>
          )}
        </div>

        {/* Center column: marketing nav for guests only — fills the wide
            empty gap logged-out visitors saw on desktop. Authenticated
            users keep their existing nav in the left group untouched. */}
        {isGuestHome ? (
          <nav className="hidden items-center justify-end gap-1 md:flex" aria-label="Sections">
            {[
              { hash: "how-it-works", label: "How it works" },
              { hash: "portfolios", label: "Portfolios" },
              { hash: "pricing", label: "Pricing" },
            ].map(({ hash, label }) => (
              <Link
                key={hash}
                to="/"
                hash={hash}
                hashScrollIntoView
                className={`${linkBase} text-foreground hover:bg-foreground/5`}
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 sm:gap-3 justify-self-end">
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
                  className="h-10 px-5 text-[13px]"
                >
                  <Link to="/" hash="waitlist" hashScrollIntoView>
                    Join waitlist
                  </Link>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="size-10 border-0 bg-card shadow-sm"
                  >
                    <Link to="/login" search={{ redirect: currentPath }} aria-label="Sign in">
                      <User className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-10 px-5 text-[13px]">
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
        <div className="border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 md:hidden space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
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
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <LayoutTemplate className="size-4 text-accent" />
                <span>Edit my portfolio</span>
              </Link>
            ) : (
              <Link
                to="/onboarding"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Lock className="size-4" />
                <span>Edit my portfolio (create one first)</span>
              </Link>
            )}
            <Link
              to="/onboarding"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                currentPath.startsWith("/onboarding")
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FolderUp className="size-4 text-accent" />
              <span>Create a portfolio</span>
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                currentPath.startsWith("/settings")
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Settings className="size-4 text-accent" />
              <span>Account and plan</span>
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

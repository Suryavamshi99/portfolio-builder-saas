import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessStudio } from "@/lib/portfolio-gate";
import { getLaunchMode } from "@/config/launch";
import { WaitlistCta } from "@/components/waitlist/WaitlistCta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/layout/Logo";
import { FluidOrb } from "@/components/ui/fluid-orb";
import { Integration, VisualContainer } from "@/components/ui/integration-card";
import { Reveal, StaggerGroup, StaggerItem, Magnetic } from "@/components/motion/reveal";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  KeyRound,
  Globe,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Clock,
  HardDrive,
  LayoutTemplate,
  ExternalLink,
  Zap,
  Upload,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";

interface HomeSearch {
  vercel?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const res: HomeSearch = {};
    if (typeof search["vercel"] === "string" && search["vercel"]) {
      res.vercel = search["vercel"];
    }
    return res;
  },
  head: () => ({
    meta: [
      { title: "Shipfolio — AI Resume to Live Portfolio SaaS" },
      {
        name: "description",
        content:
          "Turn your resume into a live, edge-deployed developer portfolio using recruiter-grade AI and your own BYOK keys.",
      },
    ],
  }),
  component: HomePage,
});

interface UserRecord {
  id: string;
  email: string;
  plan: string;
  storage: { usedBytes: number; quotaBytes: number };
  vercel: { connected: boolean };
}

interface PublishStatus {
  deploymentId?: string;
  status?: "queued" | "building" | "ready" | "error";
  url?: string;
  finishedAt?: string;
}

const ROTATING_WORDS = ["hired.", "interviews.", "top offers.", "noticed."];

const FEATURED_PORTFOLIO = {
  name: "Maneesh Bichala",
  url: "https://maneeshbichala.vercel.app/",
  host: "maneeshbichala.vercel.app",
};

// The real site is captured at a fixed desktop viewport, then scaled to
// whatever width the container actually renders at (measured live, not
// guessed per breakpoint) so the preview always fills its box.
const PREVIEW_SOURCE_WIDTH = 1440;
const PREVIEW_SOURCE_HEIGHT = 900;

function LivePortfolioFrame({ url, title }: { url: string; title: string }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.32);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PREVIEW_SOURCE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-xl border border-border/40 bg-background"
      style={{ aspectRatio: `${PREVIEW_SOURCE_WIDTH} / ${PREVIEW_SOURCE_HEIGHT}` }}
    >
      <iframe
        src={url}
        title={title}
        loading="lazy"
        sandbox="allow-scripts"
        tabIndex={-1}
        width={PREVIEW_SOURCE_WIDTH}
        height={PREVIEW_SOURCE_HEIGHT}
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        className="pointer-events-none absolute left-0 top-0 border-0"
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0"
        aria-label={`Open ${title} in a new tab`}
      />
    </div>
  );
}

export function HomePage() {
  const { vercel } = Route.useSearch();
  const navigate = useNavigate();
  const { user, portfolioReady } = useAuth();
  const studioUnlocked = canAccessStudio({ portfolioReady });
  const launchMode = getLaunchMode();

  const [vercelJustConnected, setVercelJustConnected] = React.useState(vercel === "connected");
  const [userData, setUserData] = React.useState<UserRecord | null>(null);
  const [publishStatus, setPublishStatus] = React.useState<PublishStatus | null>(null);

  // Dynamic typing / rotating word in hero
  const [wordIndex, setWordIndex] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!user) return;

    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UserRecord | null) => {
        if (data) setUserData(data);
      })
      .catch(() => {});

    void fetch("/api/publish/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublishStatus | null) => {
        if (data) setPublishStatus(data);
      })
      .catch(() => {});
  }, [user]);

  const dismissVercelBanner = () => {
    setVercelJustConnected(false);
    void navigate({ to: "/", search: {} });
  };

  return (
    <div className="space-y-16 py-2 sm:py-6">
      {/* Vercel OAuth return banner */}
      {vercelJustConnected && (
        <Alert variant="success" className="border-success/40 bg-success/10">
          <CheckCircle2 className="size-5 text-success" />
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <AlertTitle className="font-semibold">Vercel Connected Successfully!</AlertTitle>
              <AlertDescription className="text-xs">
                Your Vercel account is linked. You can now deploy and publish your portfolio with 1 click.
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="h-8 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                {studioUnlocked ? (
                  <Link to="/studio">Open Studio to Publish</Link>
                ) : (
                  <Link to="/onboarding">Generate a Portfolio First</Link>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissVercelBanner}
                className="h-8 text-xs text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {user ? (
        /* Authenticated Dashboard View */
        <div className="space-y-8">
          {/* Welcome banner with ambient FluidOrb touch */}
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div className="pointer-events-none absolute -right-12 -top-12 -z-0 opacity-25 dark:opacity-20 blur-xl">
              <FluidOrb size={200} color="#3457E8" />
            </div>

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                    Workspace Dashboard
                  </h1>
                  <Badge variant="accent" className="font-mono text-[10px] uppercase">
                    {userData?.plan ?? "free"} tier
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Signed in as <span className="font-medium text-foreground">{user.email}</span>
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2 sm:pt-0">
                {studioUnlocked ? (
                  <Button asChild className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-xs">
                    <Link to="/studio">
                      <LayoutTemplate className="size-4" /> Open Studio
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant={studioUnlocked ? "outline" : "default"} className="gap-2">
                  <Link to="/onboarding">
                    <Sparkles className="size-4 text-accent" />
                    {studioUnlocked ? "Run AI Wizard" : "Generate Your Portfolio"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Key Metrics & Status Grid */}
          <StaggerGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Live Site Status */}
            <StaggerItem whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
            <Card className="border-border/80 hover:border-accent/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="size-4 text-accent" />
                    Published Portfolio
                  </CardTitle>
                  {publishStatus?.status === "ready" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Draft only
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {publishStatus?.status === "ready"
                    ? "Your static site is deployed to Vercel."
                    : "Your site has not been published to Vercel yet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {publishStatus?.status === "ready" && publishStatus.url ? (
                  <div className="space-y-3">
                    <a
                      href={publishStatus.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline truncate max-w-full"
                    >
                      {publishStatus.url}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    {publishStatus.finishedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Last published {new Date(publishStatus.finishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Connect Vercel in Settings or Studio to deploy your site.
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-border/40 pt-3">
                <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
                  {studioUnlocked ? (
                    <Link to="/studio">Edit in Studio →</Link>
                  ) : (
                    <Link to="/onboarding">Generate your portfolio →</Link>
                  )}
                </Button>
              </CardFooter>
            </Card>
            </StaggerItem>

            {/* Card 2: Storage Quota Meter */}
            <StaggerItem whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
            <Card className="border-border/80 hover:border-accent/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <HardDrive className="size-4 text-accent" />
                    Storage Usage
                  </CardTitle>
                  <span className="text-xs font-mono text-muted-foreground">
                    {userData
                      ? `${(userData.storage.usedBytes / (1024 * 1024)).toFixed(1)} / ${(
                          userData.storage.quotaBytes / (1024 * 1024)
                        ).toFixed(0)} MB`
                      : "50 MB"}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Storage for headshots, resumes, and project images.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {userData && (
                  <Progress
                    value={userData.storage.usedBytes}
                    max={userData.storage.quotaBytes}
                    indicatorClassName="bg-accent"
                  />
                )}
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>50MB account quota</span>
                  <span>
                    {userData
                      ? `${Math.round((userData.storage.usedBytes / userData.storage.quotaBytes) * 100)}% used`
                      : "0%"}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/40 pt-3">
                <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
                  <Link to="/settings">Manage Uploads →</Link>
                </Button>
              </CardFooter>
            </Card>
            </StaggerItem>

            {/* Card 3: AI BYOK Status */}
            <StaggerItem whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
            <Card className="border-border/80 hover:border-accent/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="size-4 text-accent" />
                    BYOK API Keys
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    AES-256
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Zero inference markup — run generation with your own Anthropic, OpenAI, or Google keys.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Keys are stored with envelope encryption and never logged.
              </CardContent>
              <CardFooter className="border-t border-border/40 pt-3">
                <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
                  <Link to="/settings">Configure Keys →</Link>
                </Button>
              </CardFooter>
            </Card>
            </StaggerItem>
          </StaggerGroup>

          {/* Privacy & Retention Information */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <ShieldCheck className="size-5 text-accent" />
              Automated Data Protection & Retention Rules
            </h3>
            <div className="grid gap-4 sm:grid-cols-3 text-xs text-muted-foreground">
              <div className="space-y-1.5 rounded-xl bg-muted/40 p-3.5 border border-border/40">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-accent" /> 48-Hour Purge
                </div>
                <p>
                  Uploaded resumes and visual screenshots are deleted automatically 48 hours after generation.
                </p>
              </div>
              <div className="space-y-1.5 rounded-xl bg-muted/40 p-3.5 border border-border/40">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-accent" /> Metadata Stripped
                </div>
                <p>
                  Profile photos and showcase images have EXIF and GPS geolocation metadata removed before storage.
                </p>
              </div>
              <div className="space-y-1.5 rounded-xl bg-muted/40 p-3.5 border border-border/40">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-accent" /> Edge Bundle Immunity
                </div>
                <p>
                  Publishing copies image bytes into your Vercel deployment bundle, guaranteeing your live site stays online.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Guest View — Elite Modern Landing Page adhering to DESIGN.md & taste-skill */
        <div className="relative space-y-24 sm:space-y-32">
          {/* Quiet recurring dot-grid texture behind the whole page, not another glow blob */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-30 opacity-[0.05] dark:opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Section 1: Hero Section with Ambient FluidOrb Background */}
          <section className="relative pt-6 sm:pt-12 pb-8 text-center flex flex-col items-center justify-center overflow-hidden sm:overflow-visible">
            {/* Ambient FluidOrb WebGL Shader Canvas nestled behind Hero */}
            <div className="pointer-events-none absolute left-1/2 -top-12 -translate-x-1/2 -z-10 flex items-center justify-center overflow-visible">
              <FluidOrb
                size={440}
                color="#3457E8"
                className="opacity-50 dark:opacity-35 blur-3xl transition-opacity duration-1000 scale-125"
              />
            </div>

            <StaggerGroup className="mx-auto max-w-4xl space-y-6">
              {/* Eyebrow: exactly 1 allowed for this section family */}
              <StaggerItem className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent backdrop-blur-md shadow-xs">
                <Sparkles className="size-3.5 text-accent" />
                <span>AI Portfolio Builder for Developers</span>
                <span className="h-3 w-px bg-accent/30" />
                <span className="font-mono text-[11px] font-normal opacity-90">100% BYOK</span>
              </StaggerItem>

              {/* Display Headline: Max 2 lines at desktop, tight tracking */}
              <StaggerItem
                as="h1"
                className="text-4xl font-black tracking-tight sm:text-6xl md:text-7xl text-foreground leading-[1.08]"
              >
                This portfolio builder gets you{" "}
                <span className="relative inline-block text-accent">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={ROTATING_WORDS[wordIndex]}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="inline-block"
                    >
                      {ROTATING_WORDS[wordIndex]}
                    </motion.span>
                  </AnimatePresence>
                  <svg
                    className="absolute -bottom-2 left-0 w-full text-accent/40"
                    viewBox="0 0 250 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 9.5C65 2 185 2 248 9.5"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </StaggerItem>

              {/* Subtext: Strict copy constraint (<20 words, max 3 lines) */}
              <StaggerItem
                as="p"
                className="mx-auto max-w-2xl text-base sm:text-xl font-normal text-muted-foreground leading-relaxed"
              >
                Transform raw resume bullets into an interactive, recruiter-vetted portfolio and deploy to Vercel in minutes with private BYOK AI.
              </StaggerItem>

              {/* Action Buttons: 1 primary + max 1 secondary */}
              {launchMode === "waitlist" ? (
                <StaggerItem className="flex justify-center pt-3">
                  <WaitlistCta id="waitlist" source="hero" buttonLabel="Join the waitlist" />
                </StaggerItem>
              ) : (
                <StaggerItem className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                  <Magnetic>
                    <Button
                      asChild
                      size="lg"
                      className="h-12 px-7 text-sm sm:text-base font-bold shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90 gap-2 active:scale-[0.98]"
                    >
                      <Link to="/login" search={{ redirect: "/onboarding" }}>
                        Create my portfolio
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </Magnetic>

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 px-6 text-sm sm:text-base font-semibold border-border/80 hover:bg-muted gap-2 active:scale-[0.98]"
                  >
                    <Link to="/login" search={{ redirect: "/onboarding" }}>
                      <Upload className="size-4 text-accent" />
                      Upload my resume
                    </Link>
                  </Button>
                </StaggerItem>
              )}

              {/* Trust & Proof Bar: Placed directly under CTAs, honest claims only, no invented stats */}
              <StaggerItem className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-accent" />
                  <span className="font-medium">Live in minutes, not weeks</span>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-accent" />
                  <span className="font-medium">Private BYOK · zero inference markup</span>
                </div>

                <Link
                  to="/"
                  hash="portfolios"
                  hashScrollIntoView
                  className="flex items-center gap-2 font-medium hover:text-foreground"
                >
                  <ExternalLink className="size-4 text-accent" />
                  <span>See real portfolios built with Shipfolio</span>
                </Link>
              </StaggerItem>
            </StaggerGroup>

            {/* Section 2: Real Portfolio Preview — an actual Shipfolio output, not a mockup */}
            <Reveal delay={0.2} y={32} className="mx-auto mt-12 w-full max-w-5xl space-y-3">
              <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-accent" />
                  A real portfolio, shipped with Shipfolio
                </span>
                <a
                  href={FEATURED_PORTFOLIO.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
                >
                  Open live <ExternalLink className="size-3" />
                </a>
              </div>

              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="w-full rounded-2xl border border-border/80 bg-card p-2 sm:p-4 shadow-xl ring-1 ring-black/5"
              >
                {/* Browser chrome header, pointing at a real deployed URL */}
                <div className="flex items-center gap-2 border-b border-border/60 px-3 sm:px-4 py-2.5">
                  <div className="size-3 rounded-full bg-rose-500/80" />
                  <div className="size-3 rounded-full bg-amber-500/80" />
                  <div className="size-3 rounded-full bg-emerald-500/80" />
                  <div className="ml-2 flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    <Lock className="size-3 shrink-0" />
                    <span className="truncate">{FEATURED_PORTFOLIO.host}</span>
                  </div>
                </div>

                {/* Live embed of the real site, scaled to fill the box at any width. Interaction goes through the overlay link so nested scroll never hijacks the page. */}
                <LivePortfolioFrame
                  url={FEATURED_PORTFOLIO.url}
                  title={`${FEATURED_PORTFOLIO.name}'s live portfolio, built with Shipfolio`}
                />
              </motion.div>
            </Reveal>
        </section>

        {/* Section 3: Real Portfolios Built with Shipfolio (Social Proof) */}
        <Reveal
          as="section"
          id="portfolios"
          className="mx-auto max-w-5xl scroll-mt-20 rounded-3xl border border-border/80 bg-card p-5 sm:p-10 space-y-6 sm:space-y-8 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
              Real portfolios built on Shipfolio
            </h3>
            <div className="text-xs text-muted-foreground font-mono">Shared with developer permission</div>
          </div>

          <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
            {[
              {
                quote: "Went from a stack of PDF drafts to a live site in one sitting — genuinely convenient.",
                name: "Harshit Chebolu",
                role: "AI Product & Strategy",
                url: "https://harshit-chebolu.vercel.app/",
              },
              {
                quote: "Turned a few years of experience into something recruiters could click through, not just skim.",
                name: "Shrividya Ramesh",
                role: "Sports Management & Gaming, Masters' Union",
                url: "https://my-personal-portfolio-orpin-six.vercel.app/",
              },
              {
                quote: "Super convenient — I didn't have to think about hosting or design, just my own story.",
                name: "Maneesh Bichala",
                role: "Associate Analyst, Deloitte Consulting",
                url: "https://maneeshbichala.vercel.app/",
              },
              {
                quote: "Loved how fast it was. My numbers finally had a place that looked as sharp as they are.",
                name: "Atul Sreejil",
                role: "Sales & Marketing Professional",
                url: "https://atulsreejilportfolio-drab.vercel.app/",
              },
              {
                quote: "Made turning consulting case work into something presentable way less painful than I expected.",
                name: "Revathi Iyer",
                role: "Risk Consultant, now at Masters' Union",
                url: "https://revathiportfolio-eight.vercel.app/",
              },
            ].map((t) => (
              <StaggerItem
                key={t.name}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex flex-col justify-between space-y-3 rounded-xl bg-muted/40 p-4 border border-border/40 hover:border-accent/30"
              >
                <p className="text-xs text-foreground leading-relaxed italic">“{t.quote}”</p>
                <div className="pt-2">
                  <div className="font-bold text-xs text-foreground">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.role}</div>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                  >
                    View portfolio <ExternalLink className="size-3" />
                  </a>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Reveal>

        {/* Section 4: AI Tuning Highlight — The Career Formulation (No Eyebrow) */}
        <section className="mx-auto max-w-5xl space-y-10">
            <Reveal className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground tracking-tight">
                How our AI elevates your resume into a portfolio
              </h2>
              <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                Generic AI tools hallucinate facts or output generic boilerplate. Shipfolio structures your raw experience into authoritative, recruiter-vetted impact stories.
              </p>
            </Reveal>

            {/* Pipeline diagram: resume -> AI extraction -> live portfolio. Staggered reveal mirrors the actual processing sequence. */}
            <StaggerGroup className="flex items-center justify-center gap-2 sm:gap-4">
              <StaggerItem className="flex flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground sm:size-14">
                  <Upload className="size-5" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">Your resume</span>
              </StaggerItem>
              <ArrowRight className="size-4 shrink-0 text-border sm:size-5" />
              <StaggerItem className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex size-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent sm:size-14"
                >
                  <Sparkles className="size-5" />
                </motion.div>
                <span className="text-[11px] font-medium text-accent sm:text-xs">AI extraction</span>
              </StaggerItem>
              <ArrowRight className="size-4 shrink-0 text-border sm:size-5" />
              <StaggerItem className="flex flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground sm:size-14">
                  <Globe className="size-5" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">Live portfolio</span>
              </StaggerItem>
            </StaggerGroup>

            {/* Before vs After Comparison: opposite-side reveals reinforce the contrast */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Weak Raw Bullet */}
              <Reveal x={-32} y={0} className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-6 dark:border-rose-950/50 dark:bg-rose-950/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Typical Raw Resume Text
                  </span>
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                    Weak & Passive
                  </span>
                </div>
                <blockquote className="italic text-sm text-muted-foreground border-l-2 border-rose-300 pl-3">
                  “Worked on backend APIs for the user portal. Fixed bugs, attended standups, and helped team migrate databases.”
                </blockquote>
                <ul className="space-y-1.5 text-xs text-rose-700/80 dark:text-rose-300/80">
                  <li>• Lacks quantifiable metrics or business impact</li>
                  <li>• Passive phrasing doesn’t demonstrate engineering depth</li>
                  <li>• Misses ATS keyword triggers for recruiter searches</li>
                </ul>
              </Reveal>

              {/* Shipfolio Tuned */}
              <Reveal x={32} y={0} delay={0.1} className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-6 dark:border-emerald-950/50 dark:bg-emerald-950/10 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Shipfolio AI-Tuned Formulation
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                    Recruiter Winning
                  </span>
                </div>
                <blockquote className="font-medium text-sm text-foreground border-l-2 border-emerald-500 pl-3">
                  “Architected high-throughput RESTful user microservices, cutting p95 response times by 38% and zero-downtime migrating 2M records to PostgreSQL.”
                </blockquote>
                <ul className="space-y-1.5 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  <li>✓ Follows Google’s X-Y-Z accomplishment formula</li>
                  <li>✓ Highlights real speedups, scale, and technical ownership</li>
                  <li>✓ Strict fact guardrails, zero ungrounded hallucinations</li>
                </ul>
              </Reveal>
            </div>
          </section>

          {/* Section 4: Feature Bento Grid with Integrated FluidOrb (Eyebrow allowed: count 2) */}
          <section className="mx-auto max-w-5xl space-y-10">
            <Reveal className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <Layers className="size-3.5" />
                <span>Architecture & Features</span>
              </div>
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground tracking-tight">
                Engineered for speed, privacy, and flawless presentation
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Everything you need to showcase real engineering depth without fighting fragile website builders.
              </p>
            </Reveal>

            {/* Asymmetric Bento Grid */}
            <StaggerGroup className="grid gap-6 md:grid-cols-3">
              {/* Bento Card 1: Autonomous WebGL Fluid Dynamics (Span 2 cols) */}
              <StaggerItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="md:col-span-2 relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-accent/5 p-6 sm:p-8 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-md">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Cpu className="size-5" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      Dynamic WebGL Fluid Canvas & Edge Bundles
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Every portfolio features lightweight WebGL fluid shader dynamics with GPU acceleration, fallback-safe rendering, and zero client-side layout jumping.
                    </p>
                  </div>

                  <div className="flex justify-center shrink-0">
                    <div className="rounded-2xl border border-accent/20 bg-background/70 p-3 shadow-lg backdrop-blur-xs">
                      <FluidOrb size={140} color="#3457E8" />
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* Bento Card 2: 100% BYOK Privacy */}
              <StaggerItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 hover:border-accent/40"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <KeyRound className="size-5" />
                </div>
                <h3 className="text-xl font-bold text-foreground">100% BYOK Privacy</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Connect your Claude, OpenAI, or Gemini API keys. Keys are protected with AES-256-GCM envelope encryption at rest.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                    <Lock className="size-3" /> Zero inference markup
                  </span>
                </div>
              </StaggerItem>

              {/* Bento Card 3: 1-Click Vercel Deploy */}
              <StaggerItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 hover:border-accent/40"
              >
                <div
                  className="pointer-events-none absolute inset-0 -z-0"
                  style={{
                    background:
                      "radial-gradient(circle at 100% 100%, rgb(var(--accent) / 0.14), transparent 60%)",
                  }}
                />
                <div className="relative z-10 flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Globe className="size-5" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-foreground">1-Click Vercel Deploy</h3>
                <p className="relative z-10 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Connect your personal Vercel account. Your portfolio deploys as high-performance static HTML on Vercel’s global edge CDN.
                </p>
                <div className="relative z-10 pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                    <Zap className="size-3" /> Edge bundle immunity
                  </span>
                </div>
              </StaggerItem>

              {/* Bento Card 4: Smart Skill & Project Taxonomy (Span 2 cols) */}
              <StaggerItem
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 md:col-span-2"
              >
                <div
                  className="pointer-events-none absolute inset-0 -z-0 opacity-60"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgb(var(--foreground) / 0.12) 1px, transparent 1px)",
                    backgroundSize: "18px 18px",
                    maskImage: "linear-gradient(to left, black, transparent 70%)",
                  }}
                />
                <div className="relative z-10 flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Terminal className="size-5" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-foreground">
                  Recruiter-Aligned Taxonomy & Evidence Links
                </h3>
                <p className="relative z-10 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Technologies are grouped into clean domains (Languages, Systems, Cloud, Frontend). Each skill links directly to concrete proof in your projects with zero ungrounded claims.
                </p>
                <div className="relative z-10 flex flex-wrap gap-2 pt-1 text-xs">
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">TypeScript</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Rust</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">PostgreSQL</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Distributed Systems</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Docker</span>
                </div>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section 5: Integrations — real BYOK providers + Vercel deploy, not a generic tool wall */}
          <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <Reveal x={-24} y={0} className="space-y-4 p-6 sm:p-10">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <KeyRound className="size-3.5" />
                  <span>Bring your own everything</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Your AI keys. Your Vercel account. Zero markup.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Shipfolio orchestrates Claude, OpenAI, and Gemini with the API keys you already have, then
                  deploys the finished portfolio straight to your own Vercel account — no proxy inference fees,
                  no vendor lock-in.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground sm:text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
                    Switch between Claude, OpenAI, or Gemini per generation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
                    Keys encrypted at rest with AES-256-GCM, never logged
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
                    1-click publish to your personal Vercel edge deployment
                  </li>
                </ul>
              </Reveal>

              <Reveal x={24} y={0} delay={0.1}>
                <VisualContainer className="min-h-72 sm:min-h-96">
                  <Integration />
                </VisualContainer>
              </Reveal>
            </div>
          </section>

          {/* Section 6: Privacy & Trust Architecture */}
          <Reveal
            as="section"
            className="mx-auto max-w-4xl rounded-2xl border border-border/80 bg-card p-6 sm:p-8 text-center space-y-4 shadow-xs"
          >
            <div className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Privacy-First Architecture</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We never sell your data or retain uploaded documents permanently. Resumes and visual mockups are automatically purged after 48 hours. Profile photos have EXIF and GPS geolocation metadata stripped before storage.
            </p>
          </Reveal>

          {/* Section 7: Bottom CTA Banner with FluidOrb Ambient Glow */}
          <Reveal
            as="section"
            y={40}
            className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-[#0b0d16] via-[#090a10] to-[#0c111f] p-6 sm:p-14 text-center text-white shadow-2xl"
          >
            {/* Ambient FluidOrb nestled in right-center */}
            <div className="pointer-events-none absolute -right-16 -top-16 -z-0 opacity-40 blur-2xl">
              <FluidOrb size={360} color="#3457E8" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-extrabold sm:text-5xl tracking-tight leading-tight">
                Ready to stand out in the top 2%?
              </h2>
              <p className="text-base text-slate-300 leading-relaxed">
                Join thousands of students and engineers creating job-winning portfolios in minutes with Shipfolio.
              </p>
              <div className="pt-2">
                {launchMode === "waitlist" ? (
                  <div className="flex justify-center">
                    <WaitlistCta
                      source="bottom-banner"
                      buttonLabel="Join the waitlist"
                      buttonClassName="bg-white text-slate-950 hover:bg-slate-100 shadow-xl font-bold"
                    />
                  </div>
                ) : (
                  <Magnetic className="inline-flex justify-center">
                    <Button
                      asChild
                      size="lg"
                      className="h-12 bg-white text-slate-950 hover:bg-slate-100 font-bold px-8 text-base shadow-xl active:scale-[0.98]"
                    >
                      <Link to="/login" search={{ redirect: "/onboarding" }}>
                        Create my portfolio now
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </Magnetic>
                )}
              </div>
            </div>
          </Reveal>

          {/* Footer: Single line on desktop */}
          <footer className="border-t border-border/80 pt-8 pb-6 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="text-muted-foreground/60">|</span>
                <span>The AI Developer Portfolio Builder</span>
              </div>
              <div className="flex items-center gap-6">
                {launchMode === "waitlist" ? (
                  <Link to="/" hash="waitlist" hashScrollIntoView className="hover:text-foreground">
                    Join waitlist
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="hover:text-foreground">
                      Sign in
                    </Link>
                    <Link to="/login" search={{ redirect: "/onboarding" }} className="hover:text-foreground">
                      Build Portfolio
                    </Link>
                  </>
                )}
                <Link to="/settings" className="hover:text-foreground">
                  Privacy & Keys
                </Link>
              </div>
              <div>
                © {new Date().getFullYear()} Shipfolio. All rights reserved.
              </div>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

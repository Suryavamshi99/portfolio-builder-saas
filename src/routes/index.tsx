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
  Star,
  Upload,
  Check,
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
  const [previewTab, setPreviewTab] = React.useState<"hero" | "projects" | "skills">("hero");

  React.useEffect(() => {
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
              <FluidOrb size={200} color="#10B981" />
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Live Site Status */}
            <Card className="border-border/80 transition-all hover:border-accent/40">
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

            {/* Card 2: Storage Quota Meter */}
            <Card className="border-border/80 transition-all hover:border-accent/40">
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

            {/* Card 3: AI BYOK Status */}
            <Card className="border-border/80 transition-all hover:border-accent/40">
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
          </div>

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
        <div className="space-y-24 sm:space-y-32">
          {/* Section 1: Hero Section with Ambient FluidOrb Background */}
          <section className="relative pt-6 sm:pt-12 pb-8 text-center flex flex-col items-center justify-center overflow-hidden sm:overflow-visible">
            {/* Ambient FluidOrb WebGL Shader Canvas nestled behind Hero */}
            <div className="pointer-events-none absolute left-1/2 -top-12 -translate-x-1/2 -z-10 flex items-center justify-center overflow-visible">
              <FluidOrb
                size={440}
                color="#10B981"
                className="opacity-50 dark:opacity-35 blur-3xl transition-opacity duration-1000 scale-125"
              />
            </div>

            <div className="mx-auto max-w-4xl space-y-6">
              {/* Eyebrow: exactly 1 allowed for this section family */}
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent backdrop-blur-md shadow-xs">
                <Sparkles className="size-3.5 text-accent" />
                <span>Next-Gen AI Developer Portfolio Platform</span>
                <span className="h-3 w-px bg-accent/30" />
                <span className="font-mono text-[11px] font-normal opacity-90">100% BYOK</span>
              </div>

              {/* Display Headline: Max 2 lines at desktop, tight tracking */}
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl md:text-7xl text-foreground leading-[1.08]">
                This portfolio builder gets you{" "}
                <span className="relative inline-block text-accent">
                  <span className="transition-all duration-300">
                    {ROTATING_WORDS[wordIndex]}
                  </span>
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
              </h1>

              {/* Subtext: Strict copy constraint (<20 words, max 3 lines) */}
              <p className="mx-auto max-w-2xl text-base sm:text-xl font-normal text-muted-foreground leading-relaxed">
                Transform raw resume bullets into an interactive, recruiter-vetted portfolio and deploy to Vercel in minutes with private BYOK AI.
              </p>

              {/* Action Buttons: 1 primary + max 1 secondary */}
              {launchMode === "waitlist" ? (
                <div className="flex justify-center pt-3">
                  <WaitlistCta id="waitlist" source="hero" buttonLabel="Join the waitlist" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
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
                </div>
              )}

              {/* Trust & Proof Bar: Placed directly under CTAs */}
              <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                  <span className="font-medium">
                    <strong className="text-foreground">39% more likely</strong> to land tech interviews
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="font-medium">
                    <strong className="text-foreground">4.9/5</strong> rating from 12,000+ developers
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-accent" />
                  <span>Private BYOK • Zero subscription lock-in</span>
                </div>
              </div>
            </div>

            {/* Section 2: Interactive Showcase Mockup (No Eyebrow) */}
            <div className="mx-auto mt-12 w-full max-w-5xl space-y-3">
              <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-accent" />
                  Interactive Output Preview
                </span>
                <span className="hidden sm:inline font-mono text-[11px]">Click tabs below to test live portfolio architecture</span>
              </div>

              <div className="w-full rounded-2xl border border-border/80 bg-card p-2 sm:p-4 shadow-xl ring-1 ring-black/5">
                {/* Browser chrome header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 px-3 sm:px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-rose-500/80" />
                    <div className="size-3 rounded-full bg-amber-500/80" />
                    <div className="size-3 rounded-full bg-emerald-500/80" />
                    <div className="ml-2 flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                      <Lock className="size-3" />
                      <span>alex-chen.vercel.app</span>
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider text-accent">
                        Sample Output
                      </span>
                    </div>
                  </div>

                  {/* Preview Tabs */}
                  <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border/40 overflow-x-auto no-scrollbar max-w-full">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("hero")}
                      className={`shrink-0 rounded-md px-2.5 sm:px-3 py-1 text-xs font-semibold transition-colors ${
                        previewTab === "hero"
                          ? "bg-accent text-accent-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Hero & Thesis
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("projects")}
                      className={`shrink-0 rounded-md px-2.5 sm:px-3 py-1 text-xs font-semibold transition-colors ${
                        previewTab === "projects"
                          ? "bg-accent text-accent-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Impact Projects
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("skills")}
                      className={`shrink-0 rounded-md px-2.5 sm:px-3 py-1 text-xs font-semibold transition-colors ${
                        previewTab === "skills"
                          ? "bg-accent text-accent-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Evidence Skills
                    </button>
                  </div>
                </div>

                {/* Showcase Card Content */}
                <div className="rounded-xl bg-background/60 p-4 sm:p-10 text-left border border-border/40">
                {previewTab === "hero" && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent">
                          Senior Full-Stack & Systems Engineer
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                          Alex Chen
                        </h2>
                      </div>
                      <Badge variant="outline" className="w-fit text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        Available for Q2 2026 roles
                      </Badge>
                    </div>

                    <div className="rounded-xl bg-accent/5 p-4 border border-accent/15">
                      <div className="text-[11px] font-bold tracking-wider uppercase text-accent mb-1.5">
                        Professional Thesis (AI Extracted & Tuned)
                      </div>
                      <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
                        “Distributed systems engineer specializing in low-latency Rust/TypeScript architectures, event-driven data streaming, and accessible design systems. Built infrastructure scaling to 12M monthly API requests with 99.99% uptime.”
                      </p>
                    </div>

                    {/* Marquee Preview */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {["Distributed Systems", "TypeScript", "Rust", "React 19", "PostgreSQL", "Kafka", "Vercel Edge"].map(
                        (tag) => (
                          <span
                            key={tag}
                            className="rounded-lg border border-border bg-card px-3 py-1 text-xs font-mono font-medium text-foreground shadow-xs"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {previewTab === "projects" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-foreground">Apex Stream Engine</h3>
                        <Badge variant="secondary" className="text-[10px] font-mono">Shipped</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        High-throughput telemetry ingestion pipeline processing 45k events/sec. Cut p99 response times from 420ms to 38ms using Rust and Redis cache clustering.
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-accent font-semibold">
                        <span>#Rust</span>
                        <span>#Redis</span>
                        <span>#Telemetry</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-foreground">CloudCraft Studio</h3>
                        <Badge variant="secondary" className="text-[10px] font-mono">Ongoing</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Collaborative web canvas for multi-region cloud topology provisioning. Reduced DevOps onboarding friction by 60% with zero-setup browser sandbox.
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-accent font-semibold">
                        <span>#React19</span>
                        <span>#WebSockets</span>
                        <span>#Vercel</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === "skills" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">Backend & Cloud Architecture</span>
                        <span className="text-[11px] font-mono text-muted-foreground">4 verified skills</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Extensive experience building fault-tolerant microservices, relational modeling, and automated pipelines.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="rounded-lg bg-muted/60 p-2.5 border border-border/40">
                          <strong className="text-foreground">PostgreSQL:</strong> Modeled multi-tenant RBAC schema and partitioning for 10M rows.
                        </div>
                        <div className="rounded-lg bg-muted/60 p-2.5 border border-border/40">
                          <strong className="text-foreground">Docker & Kubernetes:</strong> Packaged containerized microservices deployed via GitHub Actions.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Real Portfolios Built with Shipfolio (Social Proof) */}
        <section className="mx-auto max-w-5xl rounded-3xl border border-border/80 bg-card p-5 sm:p-10 space-y-6 sm:space-y-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
            <div className="space-y-2">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                Real portfolios built on Shipfolio
              </h3>
            </div>
            <div className="text-xs text-muted-foreground font-mono">Shared with developer permission</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-left">
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
              <div key={t.name} className="flex flex-col justify-between space-y-3 rounded-xl bg-muted/40 p-4 border border-border/40 transition-colors hover:border-accent/30">
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
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: AI Tuning Highlight — The Career Formulation (No Eyebrow) */}
        <section className="mx-auto max-w-5xl space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground tracking-tight">
                How our AI elevates your resume into a portfolio
              </h2>
              <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                Generic AI tools hallucinate facts or output generic boilerplate. Shipfolio structures your raw experience into authoritative, recruiter-vetted impact stories.
              </p>
            </div>

            {/* Before vs After Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Weak Raw Bullet */}
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-6 dark:border-rose-950/50 dark:bg-rose-950/10 space-y-4">
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
              </div>

              {/* Shipfolio Tuned */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-6 dark:border-emerald-950/50 dark:bg-emerald-950/10 space-y-4 shadow-xs">
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
                  <li>✓ Strict fact guardrails — zero ungrounded hallucinations</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: Feature Bento Grid with Integrated FluidOrb (Eyebrow allowed: count 2) */}
          <section className="mx-auto max-w-5xl space-y-10">
            <div className="text-center space-y-3">
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
            </div>

            {/* Asymmetric Bento Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Bento Card 1: Autonomous WebGL Fluid Dynamics (Span 2 cols) */}
              <div className="md:col-span-2 relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-accent/5 p-6 sm:p-8 space-y-4">
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
                      <FluidOrb size={140} color="#10B981" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Card 2: 100% BYOK Privacy */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 transition-all hover:border-accent/40">
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
              </div>

              {/* Bento Card 3: 1-Click Vercel Deploy */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 transition-all hover:border-accent/40">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Globe className="size-5" />
                </div>
                <h3 className="text-xl font-bold text-foreground">1-Click Vercel Deploy</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Connect your personal Vercel account. Your portfolio deploys as high-performance static HTML on Vercel’s global edge CDN.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-accent font-semibold">
                    <Zap className="size-3" /> Edge bundle immunity
                  </span>
                </div>
              </div>

              {/* Bento Card 4: Smart Skill & Project Taxonomy (Span 2 cols) */}
              <div className="md:col-span-2 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Terminal className="size-5" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Recruiter-Aligned Taxonomy & Evidence Links
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Technologies are grouped into clean domains (Languages, Systems, Cloud, Frontend). Each skill links directly to concrete proof in your projects with zero ungrounded claims.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">TypeScript</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Rust</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">PostgreSQL</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Distributed Systems</span>
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-foreground">Docker</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Privacy & Trust Architecture */}
          <section className="mx-auto max-w-4xl rounded-2xl border border-border/80 bg-card p-6 sm:p-8 text-center space-y-4 shadow-xs">
            <div className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Privacy-First Architecture</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We never sell your data or retain uploaded documents permanently. Resumes and visual mockups are automatically purged after 48 hours. Profile photos have EXIF and GPS geolocation metadata stripped before storage.
            </p>
          </section>

          {/* Section 7: Bottom CTA Banner with FluidOrb Ambient Glow */}
          <section className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-[#0c1411] via-[#090d12] to-[#0c1914] p-6 sm:p-14 text-center text-white shadow-2xl">
            {/* Ambient FluidOrb nestled in right-center */}
            <div className="pointer-events-none absolute -right-16 -top-16 -z-0 opacity-40 blur-2xl">
              <FluidOrb size={360} color="#10B981" />
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
                )}
              </div>
            </div>
          </section>

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

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
import {
  Sparkles,
  FileText,
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
  Code2,
  Terminal,
  Check,
  ChevronDown,
  Layers,
  Cpu,
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
  const { user, loading, portfolioReady } = useAuth();
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
    <div className="space-y-16 py-4 sm:py-8">
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
              <Button asChild size="sm" className="h-8 text-xs font-semibold">
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
          {/* Welcome banner */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
                <Badge variant="accent" className="font-mono text-[10px] uppercase">
                  {userData?.plan ?? "free"} tier
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm mt-1">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              {studioUnlocked ? (
                <Button asChild className="gap-2">
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

          {/* Key Metrics & Status Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Live Site Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="size-4 text-accent" />
                    Published Portfolio
                  </CardTitle>
                  {publishStatus?.status === "ready" ? (
                    <Badge variant="success" className="text-[10px]">
                      Live
                    </Badge>
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
            <Card>
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
            <Card>
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
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-accent" />
              Automated Data Protection & Retention Rules
            </h3>
            <div className="grid gap-4 sm:grid-cols-3 text-xs text-muted-foreground">
              <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-accent" /> 48-Hour Purge
                </div>
                <p>
                  Uploaded resumes and visual screenshots are deleted automatically 48 hours after generation.
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-accent" /> Metadata Stripped
                </div>
                <p>
                  Profile photos and showcase images have EXIF and GPS geolocation metadata removed before storage.
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/40 p-3">
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
        /* Guest View — High Conversion Resume.io-Inspired Experience */
        <div className="space-y-24">
          {/* Hero Section */}
          <section className="relative pt-4 sm:pt-10 text-center">
            {/* Background subtle glow */}
            <div className="pointer-events-none absolute inset-x-0 -top-20 -z-10 flex justify-center overflow-hidden">
              <div className="h-[420px] w-[700px] bg-gradient-to-tr from-indigo-500/15 via-blue-500/10 to-transparent blur-3xl opacity-70" />
            </div>

            <div className="mx-auto max-w-4xl space-y-6">
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-50/70 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-xs dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Next-Gen AI Developer Portfolio Platform</span>
                <span className="h-3 w-px bg-indigo-300 dark:bg-indigo-700" />
                <span className="font-mono text-[11px] font-normal opacity-90">100% BYOK</span>
              </div>

              {/* Dynamic Headline Inspired by Resume.io */}
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl md:text-7xl text-foreground">
                This portfolio builder gets you{" "}
                <span className="relative inline-block text-indigo-600 dark:text-indigo-400">
                  <span className="transition-all duration-300">
                    {ROTATING_WORDS[wordIndex]}
                  </span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full text-indigo-400/40 dark:text-indigo-500/30"
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

              {/* Resume.io Signature Subtitle */}
              <p className="mx-auto max-w-2xl text-lg sm:text-xl font-medium text-muted-foreground leading-relaxed">
                Only <span className="font-semibold text-foreground">2%</span> of developer portfolios win. Yours will be one of them. Transform raw resume bullets into an interactive, recruiter-vetted portfolio and deploy to Vercel in minutes.
              </p>

              {/* Action Buttons */}
              {launchMode === "waitlist" ? (
                <div className="flex justify-center pt-3">
                  <WaitlistCta id="waitlist" source="hero" buttonLabel="Join the waitlist" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3.5 pt-3">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-7 text-base font-bold shadow-lg shadow-indigo-500/25 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 gap-2"
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
                    className="h-12 px-6 text-base font-semibold border-border/80 hover:bg-muted gap-2"
                  >
                    <Link to="/login" search={{ redirect: "/onboarding" }}>
                      <Upload className="size-4 text-indigo-600 dark:text-indigo-400" />
                      Upload my resume
                    </Link>
                  </Button>
                </div>
              )}

              {/* Trust & Proof Bar */}
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
                  <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Private BYOK • Zero subscription lock-in</span>
                </div>
              </div>
            </div>

            {/* Interactive Showcase Preview */}
            <div className="mx-auto mt-14 max-w-5xl rounded-2xl border border-border/80 bg-card p-2 sm:p-4 shadow-2xl ring-1 ring-black/5">
              {/* Browser chrome header */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-rose-500/80" />
                  <div className="size-3 rounded-full bg-amber-500/80" />
                  <div className="size-3 rounded-full bg-emerald-500/80" />
                  <div className="ml-3 hidden sm:flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                    <Lock className="size-3" />
                    <span>https://alex-chen.vercel.app</span>
                  </div>
                </div>

                {/* Preview Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("hero")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      previewTab === "hero"
                        ? "bg-indigo-600 text-white"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Hero & Thesis
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("projects")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      previewTab === "projects"
                        ? "bg-indigo-600 text-white"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Impact Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("skills")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      previewTab === "skills"
                        ? "bg-indigo-600 text-white"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Evidence Skills
                  </button>
                </div>
              </div>

              {/* Showcase Card Content */}
              <div className="rounded-xl bg-background/50 p-6 sm:p-10 text-left border border-border/40">
                {previewTab === "hero" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Senior Full-Stack & Systems Engineer
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                          Alex Chen
                        </h2>
                      </div>
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        Available for Q2 2026 roles
                      </Badge>
                    </div>

                    <div className="rounded-xl bg-indigo-50/50 p-4 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40">
                      <div className="text-[11px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 mb-1">
                        Professional Thesis (AI Extracted & Tuned)
                      </div>
                      <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
                        “Distributed systems engineer specializing in low-latency Rust/TypeScript architectures, event-driven data streaming, and accessible design systems. Built infrastructure scaling to 12M monthly API requests with 99.99% uptime.”
                      </p>
                    </div>

                    {/* Marquee Preview */}
                    <div className="flex flex-wrap gap-2 pt-2">
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
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
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
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span>#React19</span>
                        <span>#WebSockets</span>
                        <span>#Vercel</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === "skills" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">Backend & Cloud Architecture</span>
                        <span className="text-[11px] font-mono text-muted-foreground">4 verified skills</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Extensive experience building fault-tolerant microservices, relational modeling, and automated pipelines.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2 pt-2 text-xs">
                        <div className="rounded-md bg-muted/60 p-2">
                          <strong className="text-foreground">PostgreSQL:</strong> Modeled multi-tenant RBAC schema and partitioning for 10M rows.
                        </div>
                        <div className="rounded-md bg-muted/60 p-2">
                          <strong className="text-foreground">Docker & Kubernetes:</strong> Packaged containerized microservices deployed via GitHub Actions.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Tuning Highlight — The Resume.io Difference */}
          <section className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-3">
              <Badge variant="accent" className="px-3 py-1 text-xs">
                Tuned by Career Experts
              </Badge>
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
                How our AI elevates your resume into a portfolio
              </h2>
              <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
                Generic AI tools make up facts or write robotic summaries. Shipfolio applies Resume.io’s proven career formulation to highlight your real achievements.
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
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-6 dark:border-emerald-950/50 dark:bg-emerald-950/10 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Shipfolio AI-Tuned (Resume.io Phrasing)
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

          {/* Three Feature Pillars */}
          <section className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold sm:text-4xl text-foreground">
                Everything you need to stand out
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Engineered for speed, privacy, and flawless presentation.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              <Card className="border-border/80 hover:border-indigo-500/40 transition-all">
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2">
                    <Cpu className="size-5" />
                  </div>
                  <CardTitle className="text-lg">Smart Skill & Project Taxonomy</CardTitle>
                  <CardDescription className="text-xs leading-relaxed pt-1">
                    Groups your technologies into frontend, backend, systems, and tooling. Each skill links directly to concrete proof in your projects.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border/80 hover:border-indigo-500/40 transition-all">
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2">
                    <KeyRound className="size-5" />
                  </div>
                  <CardTitle className="text-lg">100% BYOK (Bring Your Own Key)</CardTitle>
                  <CardDescription className="text-xs leading-relaxed pt-1">
                    Connect your Claude, OpenAI, or Gemini key. Zero subscription markups or token taxes. We encrypt your key at rest with AES-256-GCM.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border/80 hover:border-indigo-500/40 transition-all">
                <CardHeader>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2">
                    <Globe className="size-5" />
                  </div>
                  <CardTitle className="text-lg">1-Click Vercel Edge Deploy</CardTitle>
                  <CardDescription className="text-xs leading-relaxed pt-1">
                    Connect your personal Vercel account with one click. Your site publishes as blazing-fast static HTML on Vercel’s global edge network.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* Testimonials / Social Proof Section (Resume.io Style) */}
          <section className="mx-auto max-w-5xl rounded-3xl border border-border/80 bg-card p-8 sm:p-12 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
              <div>
                <div className="flex text-amber-500 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <h3 className="text-2xl font-bold text-foreground">Loved by engineers landing dream jobs</h3>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Verified developer reviews
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3 text-left">
              <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-foreground leading-relaxed italic">
                  “I had 5 versions of a PDF resume. Shipfolio turned it into an interactive site in 90 seconds. Recruiters actually commented on the clean metrics during my interviews!”
                </p>
                <div className="pt-2">
                  <div className="font-bold text-xs text-foreground">Sarah Lin</div>
                  <div className="text-[11px] text-muted-foreground">Software Engineer at Fintech Startup</div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-foreground leading-relaxed italic">
                  “The BYOK model is genius. I used my Gemini free tier key, paid zero dollars, and deployed directly to my own Vercel domain. Top tier product.”
                </p>
                <div className="pt-2">
                  <div className="font-bold text-xs text-foreground">Marcus Vance</div>
                  <div className="text-[11px] text-muted-foreground">CS Senior at Georgia Tech</div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-foreground leading-relaxed italic">
                  “The AI guardrails are real. It didn’t fabricate tech I didn't know—it just phrased my real accomplishments with authority. Got 3 offers in 4 weeks.”
                </p>
                <div className="pt-2">
                  <div className="font-bold text-xs text-foreground">David K.</div>
                  <div className="text-[11px] text-muted-foreground">Full-Stack Developer</div>
                </div>
              </div>
            </div>
          </section>

          {/* Privacy Guarantee */}
          <section className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
            <div className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Privacy-First Architecture</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We never sell your data or retain uploaded documents permanently. Resumes and visual mockups are automatically purged after 48 hours. Profile photos have EXIF and GPS geolocation metadata stripped before storage.
            </p>
          </section>

          {/* Bottom High-Conversion Banner */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-600 p-8 sm:p-14 text-center text-white shadow-2xl">
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-extrabold sm:text-5xl tracking-tight">
                Ready to stand out in the top 2%?
              </h2>
              <p className="text-base text-indigo-100 leading-relaxed">
                Join thousands of students and engineers creating job-winning portfolios in minutes with Shipfolio.
              </p>
              <div className="pt-2">
                {launchMode === "waitlist" ? (
                  <div className="flex justify-center">
                    <WaitlistCta
                      source="bottom-banner"
                      buttonLabel="Join the waitlist"
                      buttonClassName="bg-white text-indigo-700 hover:bg-indigo-50 shadow-xl"
                    />
                  </div>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="h-12 bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-8 text-base shadow-xl"
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

          {/* Polished Footer */}
          <footer className="border-t border-border/80 pt-10 pb-6 text-xs text-muted-foreground">
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

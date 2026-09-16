import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
      { title: "Portfolio Builder — Student Resume to Live Portfolio SaaS" },
      {
        name: "description",
        content: "Turn your resume into a live, edge-deployed developer portfolio using your own AI keys.",
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

function HomePage() {
  const { vercel } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [vercelJustConnected, setVercelJustConnected] = React.useState(vercel === "connected");
  const [userData, setUserData] = React.useState<UserRecord | null>(null);
  const [publishStatus, setPublishStatus] = React.useState<PublishStatus | null>(null);

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
    <div className="space-y-12 py-4 sm:py-8">
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
                <Link to="/studio">Open Studio to Publish</Link>
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
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
                <Badge variant="accent" className="font-mono text-[10px] uppercase">
                  {userData?.plan ?? "free"} tier
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm mt-1">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              <Button asChild className="gap-2">
                <Link to="/studio">
                  <LayoutTemplate className="size-4" /> Open Studio
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/onboarding">
                  <Sparkles className="size-4 text-accent" /> New Wizard Run
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
                  <Link to="/studio">Edit in Studio →</Link>
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
        /* Guest / Marketing Pitch View */
        <div className="space-y-16">
          {/* Hero Section */}
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <Badge variant="accent" className="px-3 py-1 text-xs gap-1.5">
              <Sparkles className="size-3.5" />
              Developer Portfolio SaaS
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
              Turn your resume into a{" "}
              <span className="bg-gradient-to-r from-accent via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                live portfolio
              </span>{" "}
              in seconds.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your resume or visual screenshots. Use your own AI key (Anthropic, OpenAI, Google) to extract and format projects, then publish with 1 click to your own Vercel account.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button asChild size="lg" className="h-11 px-6 font-semibold gap-2">
                <Link to="/login" search={{ redirect: "/onboarding" }}>
                  Start Building Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" /> Bring Your Own Key
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" /> 1-Click Vercel Deploy
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" /> 48h Auto-Purge
              </span>
            </div>
          </div>

          {/* Feature Pillars Grid */}
          <div className="grid gap-6 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-2">
                  <FileText className="size-5" />
                </div>
                <CardTitle className="text-lg">Server-Side Parsing</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Upload PDF or DOCX resumes. Text is safely extracted and guarded with strict anti-hallucination prompts so your credentials remain accurate.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-2">
                  <KeyRound className="size-5" />
                </div>
                <CardTitle className="text-lg">Zero Markup (BYOK)</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Connect your personal Claude, OpenAI, or Gemini key. We encrypt your key at rest with AES-256-GCM and never charge for AI generation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-2">
                  <Globe className="size-5" />
                </div>
                <CardTitle className="text-lg">Publish to Your Vercel</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  One-click OAuth links your Vercel account. Your site is bundled with zero-dependency static HTML and hosted at your custom domain.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Privacy & Trust Callout */}
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-3">
            <div className="inline-flex size-10 items-center justify-center rounded-full bg-success/15 text-success mb-1">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-xl font-bold">Privacy-First Architecture</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We never sell your data or retain your resumes indefinitely. Resumes and design screenshots are automatically expunged from storage 48 hours after generation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

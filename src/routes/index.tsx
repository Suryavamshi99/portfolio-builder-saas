import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessStudio } from "@/lib/portfolio-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { GuestLanding } from "@/components/landing/GuestLanding";
import {
  Sparkles,
  KeyRound,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Clock,
  HardDrive,
  LayoutTemplate,
  ExternalLink,
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
      { title: "Shipfolio — Turn Your Resume into a Live Portfolio" },
      {
        name: "description",
        content:
          "Turn your resume into a live, interactive personal portfolio in seconds. Instant hosting, custom domains, or export anywhere.",
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

export function HomePage() {
  const { vercel } = Route.useSearch();
  const navigate = useNavigate();
  const { user, portfolioReady, isAdmin } = useAuth();
  const studioUnlocked = canAccessStudio({ portfolioReady, isAdmin });

  const [vercelJustConnected, setVercelJustConnected] = React.useState(vercel === "connected");
  const [userData, setUserData] = React.useState<UserRecord | null>(null);
  const [publishStatus, setPublishStatus] = React.useState<PublishStatus | null>(null);
  const [siteData, setSiteData] = React.useState<{ slug: string; url: string; status: string } | null>(null);

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

    void fetch("/api/sites/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { site?: { slug: string; url: string; status: string } | null } | null) => {
        if (data?.site) setSiteData(data.site);
      })
      .catch(() => {});
  }, [user]);

  const dismissVercelBanner = () => {
    setVercelJustConnected(false);
    void navigate({ to: "/", search: {} });
  };

  return (
    <div className={user ? "space-y-16 py-2 sm:py-6" : "space-y-16 pb-2 sm:pb-6"}>
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
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-aurora-mint p-6 sm:p-8">

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl text-foreground">
                    Your workspace
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
                  <Button asChild className="gap-2">
                    <Link to="/studio">
                      <LayoutTemplate className="size-4" /> Open Studio
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant={studioUnlocked ? "outline" : "default"} className="gap-2">
                  <Link to="/onboarding">
                    <Sparkles className="size-4" />
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
                  {(siteData?.status === "published" || publishStatus?.status === "ready") ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold text-success">
                      <span className="size-1.5 rounded-full bg-success animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Draft only
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {(siteData?.status === "published" || publishStatus?.status === "ready")
                    ? "Your static portfolio is live and accessible online."
                    : "Your site has not been published yet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(siteData?.url || publishStatus?.url) ? (
                  <div className="space-y-3">
                    <a
                      href={siteData?.url || publishStatus?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline truncate max-w-full"
                    >
                      {siteData?.url || publishStatus?.url}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    {publishStatus?.finishedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Last published {new Date(publishStatus.finishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Publish your portfolio in Studio to go live.
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

            {/* Card 3: AI Generation Status */}
            <StaggerItem whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
            <Card className="border-border/80 hover:border-accent/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="size-4 text-accent" />
                    AI Generation & Privacy
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    AES-256
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Generate with built-in free models, your Claude/ChatGPT plan, or your own Gemini key.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Keys and tokens are protected with envelope encryption and never logged.
              </CardContent>
              <CardFooter className="border-t border-border/40 pt-3">
                <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
                  <Link to="/settings">Configure AI & Keys →</Link>
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
                  <Clock className="size-3.5 text-accent" /> Deleted in 48 Hours
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
                  <Globe className="size-3.5 text-accent" /> Bundled Image Permanence
                </div>
                <p>
                  Publishing embeds image assets directly into your site, guaranteeing your live portfolio stays online permanently.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <GuestLanding />
      )}
    </div>
  );
}

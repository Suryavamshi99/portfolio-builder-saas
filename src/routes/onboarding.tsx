import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UploadWidget, type UploadItem } from "@/components/upload/UploadWidget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FluidOrb } from "@/components/ui/fluid-orb";
import {
  FileText,
  Image as ImageIcon,
  User,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  LayoutTemplate,
  Globe,
  Github,
  Linkedin,
  Plus,
  X,
  Link2,
} from "lucide-react";
import { apiClient, ApiError, type FreeStatusResponse, type GenerationJob } from "@/lib/api-client";
import {
  GenerationMethodCards,
  type GenerationMethod,
} from "@/components/wizard/GenerationMethodCards";
import { JobProgressView } from "@/components/wizard/JobProgressView";
import { McpWaitingPanel } from "@/components/wizard/McpWaitingPanel";
import { isJobTerminal, shouldContinuePollingJob } from "@/lib/studio-helpers";
import { announceBuildReady } from "@/lib/build-notify";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "AI Portfolio Wizard — Shipfolio" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <AuthGuard actionName="use the portfolio creation wizard">
      <OnboardingWizard />
    </AuthGuard>
  );
}

type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = [
  { step: 1, title: "Resume", icon: FileText },
  { step: 2, title: "Visual Style", icon: ImageIcon },
  { step: 3, title: "Profile Photo", icon: User },
  { step: 4, title: "Specifics", icon: MessageSquare },
  { step: 5, title: "How to Generate", icon: Sparkles },
  { step: 6, title: "Generate", icon: Sparkles },
] as const;

function OnboardingWizard() {
  const navigate = useNavigate();
  const { refreshPortfolioStatus, portfolioReady } = useAuth();

  const [currentStep, setCurrentStep] = React.useState<StepIndex>(1);
  const [resumeUpload, setResumeUpload] = React.useState<UploadItem | null>(null);
  const [visualReferences, setVisualReferences] = React.useState<UploadItem[]>([]);
  const [photoUpload, setPhotoUpload] = React.useState<UploadItem | null>(null);
  const [otherSpecifics, setOtherSpecifics] = React.useState("");
  const [linkedinUrl, setLinkedinUrl] = React.useState("");
  const [githubProfileUrl, setGithubProfileUrl] = React.useState("");
  const [githubProjectLinks, setGithubProjectLinks] = React.useState<string[]>([]);
  const [otherLinks, setOtherLinks] = React.useState<{ label: string; url: string }[]>([]);
  const [designIntensity, setDesignIntensity] = React.useState<"minimal" | "bold">("minimal");

  // Step 5 & Generation method state
  const [selectedMethod, setSelectedMethod] = React.useState<GenerationMethod>("free");
  const [freeConsentChecked, setFreeConsentChecked] = React.useState(false);
  const [freeStatus, setFreeStatus] = React.useState<FreeStatusResponse | null>(null);
  const [freeLoading, setFreeLoading] = React.useState(true);
  const [hasGeminiKey, setHasGeminiKey] = React.useState(false);
  const [comingSoonNotice, setComingSoonNotice] = React.useState<string | null>(null);

  // Upload busy guard
  const [uploadBusy, setUploadBusy] = React.useState(false);

  // Generation & Job state (Task B)
  const [activeJob, setActiveJob] = React.useState<GenerationJob | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [generationComplete, setGenerationComplete] = React.useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = React.useState(false);
  const [isCancelingQueued, setIsCancelingQueued] = React.useState(false);

  const activeJobIdRef = React.useRef<string | null>(null);
  const pollingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = React.useRef<number>(0);

  // Check on mount for existing resume and keys
  React.useEffect(() => {
    void fetch("/api/uploads?kind=resume")
      .then((r) => r.json())
      .then((data: { uploads?: UploadItem[] }) => {
        if (data.uploads && data.uploads.length > 0 && data.uploads[0]) {
          setResumeUpload(data.uploads[0]);
        }
      })
      .catch(() => {});

    void fetch("/api/byok-keys")
      .then((r) => r.json())
      .then((data: { keys?: Array<{ provider: string }> }) => {
        if (data.keys && data.keys.some((k) => k.provider === "google")) {
          setHasGeminiKey(true);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch free capacity status
  React.useEffect(() => {
    let alive = true;
    setFreeLoading(true);
    void apiClient
      .getFreeStatus()
      .then((status) => {
        if (!alive) return;
        setFreeStatus(status);
        if (status.available) {
          setSelectedMethod("free");
        } else {
          // If free is unavailable, fallback to gemini or mcp
          setSelectedMethod((prev) => (prev === "free" ? "gemini" : prev));
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if ((err as { isNotFound?: boolean })?.isNotFound) {
          setComingSoonNotice("Free tier harness endpoint is coming soon. You can use your Gemini key or Claude/ChatGPT.");
          setSelectedMethod("gemini");
        }
      })
      .finally(() => {
        if (alive) setFreeLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Stop polling helper
  const stopPolling = React.useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Job Polling Loop (Task B)
  const pollJob = React.useCallback(
    (jobId: string) => {
      stopPolling();
      activeJobIdRef.current = jobId;
      pollStartTimeRef.current = Date.now();
      setGenerating(true);

      const check = async () => {
        try {
          const job = await apiClient.getGeneration(jobId);
          setActiveJob(job);

          const elapsedMs = Date.now() - pollStartTimeRef.current;
          const checkResult = shouldContinuePollingJob({
            status: job.status,
            elapsedMs,
          });

          if (job.status === "done") {
            stopPolling();
            setGenerating(false);
            await refreshPortfolioStatus();
            setGenerationComplete(true);
            announceBuildReady(job.id);
            return;
          }

          if (job.status === "failed") {
            stopPolling();
            setGenerating(false);
            return;
          }

          if (!checkResult.shouldContinue && checkResult.isTimedOut) {
            stopPolling();
            setGenerating(false);
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    message: "Generation is taking longer than usual. Please check back in a moment or refresh.",
                  }
                : null
            );
          }
        } catch (err: unknown) {
          if ((err as { isNotFound?: boolean })?.isNotFound) {
            stopPolling();
            setGenerating(false);
            setActiveJob({
              id: jobId,
              source: "free",
              status: "failed",
              message: "Generation endpoint coming soon.",
              error: {
                code: "not_found",
                message: "Generation endpoint coming soon.",
              },
              retryAt: null,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      };

      // Poll immediately then every 2 seconds
      void check();
      pollingTimerRef.current = setInterval(check, 2000);
    },
    [refreshPortfolioStatus, stopPolling]
  );

  // Resume non-terminal latest generation job on mount (Task B)
  React.useEffect(() => {
    let alive = true;
    void apiClient
      .getLatestGeneration()
      .then((latest) => {
        if (!alive || !latest) return;
        if (!isJobTerminal(latest.status)) {
          setActiveJob(latest);
          setCurrentStep(6);
          pollJob(latest.id);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      stopPolling();
    };
  }, [pollJob, stopPolling]);

  const hasLoadedInputsRef = React.useRef(false);
  const isDirtyRef = React.useRef(false);

  // Pre-fill inputs on mount from saved portfolio_inputs
  React.useEffect(() => {
    let isMounted = true;
    void fetch("/api/portfolio/inputs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        links?: {
          linkedin?: string;
          github?: string;
          githubProjects?: string[];
          other?: { label: string; url: string }[];
        };
        specifics?: string | null;
        designIntensity?: "minimal" | "bold";
      } | null) => {
        if (!isMounted || !data) return;
        if (!isDirtyRef.current) {
          if (data.specifics) setOtherSpecifics((prev) => (prev ? prev : data.specifics!));
          if (data.links?.linkedin) setLinkedinUrl((prev) => (prev ? prev : data.links!.linkedin!));
          if (data.links?.github) setGithubProfileUrl((prev) => (prev ? prev : data.links!.github!));
          if (data.links?.githubProjects && data.links.githubProjects.length > 0) {
            setGithubProjectLinks((prev) => (prev.length > 0 ? prev : data.links!.githubProjects!));
          }
          if (data.links?.other && data.links.other.length > 0) {
            setOtherLinks((prev) => (prev.length > 0 ? prev : data.links!.other!));
          }
          if (data.designIntensity) {
            setDesignIntensity(data.designIntensity);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load portfolio inputs:", err);
      })
      .finally(() => {
        if (isMounted) {
          hasLoadedInputsRef.current = true;
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced auto-save of inputs to /api/portfolio/inputs
  React.useEffect(() => {
    if (!hasLoadedInputsRef.current) return;
    isDirtyRef.current = true;

    const timer = setTimeout(() => {
      const payload = {
        links: {
          linkedin: linkedinUrl.trim() || undefined,
          github: githubProfileUrl.trim() || undefined,
          githubProjects: githubProjectLinks.map((l) => l.trim()).filter(Boolean),
          other: otherLinks
            .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
            .filter((l) => l.label && l.url),
        },
        specifics: otherSpecifics.trim() || null,
        designIntensity,
      };

      void fetch("/api/portfolio/inputs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.warn("Failed to save portfolio inputs:", err);
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [otherSpecifics, linkedinUrl, githubProfileUrl, githubProjectLinks, otherLinks, designIntensity]);

  // Handle generation start for Card 1 (free) and Card 3 (gemini)
  const handleGenerate = async () => {
    if (!resumeUpload) {
      setCurrentStep(1);
      return;
    }

    if (selectedMethod === "gemini" && !hasGeminiKey) {
      setCurrentStep(5);
      return;
    }

    if (selectedMethod === "free" && !freeConsentChecked) {
      setCurrentStep(5);
      return;
    }

    setGenerating(true);
    setActiveJob(null);

    try {
      const created = await apiClient.createGeneration({
        source: selectedMethod === "free" ? "free" : "gemini",
        resumeUploadId: resumeUpload.id,
        otherSpecifics: otherSpecifics.trim() || undefined,
        designIntensity,
        links: {
          linkedin: linkedinUrl.trim() || undefined,
          github: githubProfileUrl.trim() || undefined,
          githubProjects: githubProjectLinks.map((l) => l.trim()).filter(Boolean),
          other: otherLinks
            .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
            .filter((l) => l.label && l.url),
        },
      });

      // Poll created job
      pollJob(created.jobId);
    } catch (err: unknown) {
      setGenerating(false);
      if (err instanceof ApiError) {
        setActiveJob({
          id: "temp",
          source: selectedMethod === "free" ? "free" : "gemini",
          status: "failed",
          message: err.message,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            retryAfterSeconds: err.retryAfterSeconds,
          },
          retryAt: null,
          updatedAt: new Date().toISOString(),
        });
      } else {
        setActiveJob({
          id: "temp",
          source: selectedMethod === "free" ? "free" : "gemini",
          status: "failed",
          message: "Failed to start generation",
          error: {
            code: "network_error",
            message: err instanceof Error ? err.message : "Failed to connect to generation endpoint.",
          },
          retryAt: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  const handleCancelQueuedJob = async () => {
    if (!activeJob?.id || activeJob.status !== "queued") return;
    setIsCancelingQueued(true);
    try {
      await apiClient.cancelGeneration(activeJob.id);
      stopPolling();
      setActiveJob(null);
      setGenerating(false);
      setCurrentStep(5);
    } catch (e) {
      console.warn("Failed to cancel queued job:", e);
    } finally {
      setIsCancelingQueued(false);
    }
  };

  const canProceedFromStep5 = () => {
    if (selectedMethod === "free") return freeConsentChecked;
    if (selectedMethod === "gemini") return hasGeminiKey;
    if (selectedMethod === "mcp") return true;
    return false;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      {/* Header & Stepper */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Shipfolio AI Wizard</h1>
            <Badge variant="accent" className="text-[10px] font-mono">
              Resume.io Tuned
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm mt-1">
            Recruiter-aligned assistant to extract your work history, structure your projects, and craft a job-winning portfolio.
          </p>
        </div>

        {/* Accessible Step Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.title}
            </span>
            <span>{Math.round((currentStep / STEPS.length) * 100)}% completed</span>
          </div>
          <Progress value={currentStep} max={STEPS.length} />
        </div>

        {/* Step Icons Bar */}
        <div className="grid grid-cols-6 gap-1 border-y border-border/80 py-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCurrent = currentStep === s.step;
            const isCompleted = currentStep > s.step;

            return (
              <button
                key={s.step}
                type="button"
                disabled={s.step > 1 && !resumeUpload}
                onClick={() => !generating && !uploadBusy && setCurrentStep(s.step as StepIndex)}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-all ${
                  isCurrent
                    ? "bg-accent/15 text-accent font-semibold"
                    : isCompleted
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground opacity-60 hover:opacity-100"
                }`}
                aria-label={`Step ${s.step}: ${s.title}`}
              >
                <div
                  className={`flex size-7 items-center justify-center rounded-full ${
                    isCurrent
                      ? "bg-accent text-accent-foreground"
                      : isCompleted
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="size-4" /> : <Icon className="size-3.5" />}
                </div>
                <span className="hidden text-[11px] truncate sm:inline-block">{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Content Card */}
      <Card className="border-border shadow-sm">
        {/* Step 1: Resume Upload */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Upload Your Resume</CardTitle>
              <CardDescription>
                We extract plain text from your PDF or DOCX server-side before sending it to the model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadWidget
                kind="resume"
                onUploadSuccess={(up) => setResumeUpload(up)}
                onDeleteSuccess={() => setResumeUpload(null)}
                onBusyChange={setUploadBusy}
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">
                {uploadBusy
                  ? "Uploading…"
                  : resumeUpload
                  ? "Resume ready for parsing"
                  : "Upload a PDF or DOCX file to proceed"}
              </span>
              <Button
                type="button"
                disabled={!resumeUpload || uploadBusy}
                onClick={() => setCurrentStep(2)}
                className="gap-2 w-full sm:w-auto justify-center"
              >
                Next: Visual Style
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 2: Visual Style References */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 2: Visual Reference Screenshots (Optional)</CardTitle>
              <CardDescription>
                Upload up to 3 screenshots of portfolios or layouts you admire for structural inspiration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <UploadWidget
                kind="visual_reference"
                maxFilesOverride={3}
                onUploadSuccess={(up) => setVisualReferences((prev) => [...prev, up])}
                onDeleteSuccess={(id) => setVisualReferences((prev) => prev.filter((r) => r.id !== id))}
                onBusyChange={setUploadBusy}
              />

              <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <div className="text-xs font-semibold text-foreground">Design intensity</div>
                <p className="text-[11px] text-muted-foreground">
                  How much visual flair should the AI apply? You can change this anytime before generating.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDesignIntensity("minimal")}
                    aria-pressed={designIntensity === "minimal"}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      designIntensity === "minimal"
                        ? "border-accent bg-accent/10 ring-1 ring-accent"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="text-xs font-semibold text-foreground">Minimal</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Clean, restrained, editorial — whitespace and typography do the work.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesignIntensity("bold")}
                    aria-pressed={designIntensity === "bold"}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      designIntensity === "bold"
                        ? "border-accent bg-accent/10 ring-1 ring-accent"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="text-xs font-semibold text-foreground">Design-heavy</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Bolder typography, color, and layout — more visual personality.
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={uploadBusy}
                onClick={() => setCurrentStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                disabled={uploadBusy}
                onClick={() => setCurrentStep(3)}
                className="gap-2"
              >
                {uploadBusy ? "Uploading…" : visualReferences.length > 0 ? "Next: Profile Photo" : "Skip / Next: Profile Photo"}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 3: Profile Photo */}
        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 3: Profile Photo / Headshot (Optional)</CardTitle>
              <CardDescription>
                Upload a portrait for your hero section. Image EXIF and location data are stripped automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadWidget
                kind="photo"
                onUploadSuccess={(up) => setPhotoUpload(up)}
                onDeleteSuccess={() => setPhotoUpload(null)}
                onBusyChange={setUploadBusy}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={uploadBusy}
                onClick={() => setCurrentStep(2)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                disabled={uploadBusy}
                onClick={() => setCurrentStep(4)}
                className="gap-2"
              >
                {uploadBusy ? "Uploading…" : photoUpload ? "Next: Specifics" : "Skip / Next: Specifics"}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 4: Specifics & Free Text */}
        {currentStep === 4 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 4: Links & Specifics</CardTitle>
              <CardDescription>
                Add your profile links and anything else you want the AI to know.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <div className="text-xs font-semibold text-foreground">Links & profiles (optional)</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="linkedin-url" className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Linkedin className="size-3.5" /> LinkedIn URL
                    </label>
                    <Input
                      id="linkedin-url"
                      type="url"
                      placeholder="https://linkedin.com/in/yourname"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className="h-9 bg-background/60 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="github-url" className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Github className="size-3.5" /> GitHub profile URL
                    </label>
                    <Input
                      id="github-url"
                      type="url"
                      placeholder="https://github.com/yourname"
                      value={githubProfileUrl}
                      onChange={(e) => setGithubProfileUrl(e.target.value)}
                      className="h-9 bg-background/60 text-xs"
                    />
                  </div>
                </div>

                {/* GitHub project links */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">GitHub project links</div>
                  {githubProjectLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        type="url"
                        placeholder="https://github.com/yourname/project"
                        value={link}
                        onChange={(e) =>
                          setGithubProjectLinks((prev) => prev.map((l, i) => (i === idx ? e.target.value : l)))
                        }
                        className="h-9 bg-background/60 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setGithubProjectLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove project link"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGithubProjectLinks((prev) => [...prev, ""])}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    <Plus className="size-3.5" /> Add a project link
                  </button>
                </div>

                {/* Any other link */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">Other links (Figma, Behance, personal site, etc.)</div>
                  {otherLinks.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        placeholder="Label (e.g. Figma)"
                        value={entry.label}
                        onChange={(e) =>
                          setOtherLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)))
                        }
                        className="h-9 w-28 shrink-0 bg-background/60 text-xs"
                      />
                      <Input
                        type="url"
                        placeholder="https://…"
                        value={entry.url}
                        onChange={(e) =>
                          setOtherLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l)))
                        }
                        className="h-9 bg-background/60 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setOtherLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove link"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOtherLinks((prev) => [...prev, { label: "", url: "" }])}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    <Link2 className="size-3.5" /> Add any (Figma, Dribbble, portfolio…)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="other-specifics" className="text-xs font-medium text-foreground">
                  Anything else for the AI to know
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Write freely — there's no fixed format. Call out a project to emphasize, your target role, a tone you
                  want, or any context that isn't already on your resume.
                </p>
                <Textarea
                  id="other-specifics"
                  placeholder="e.g. Focus on my machine learning internships, I'm targeting backend roles at startups, keep the tone confident but not salesy."
                  value={otherSpecifics}
                  onChange={(e) => setOtherSpecifics(e.target.value)}
                  rows={4}
                  className="bg-background/60"
                />
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/40">
                <p>
                  <strong>Tip:</strong> The extraction prompt adheres to strict content-integrity guardrails: it will never fabricate facts, alter employment periods, or make unsubstantiated claims.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(3)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold active:scale-[0.98]"
              >
                Next: How to Generate
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 5: How should we generate it? (Task A: 3 Cards) */}
        {currentStep === 5 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 5: How should we generate it?</CardTitle>
              <CardDescription>
                Choose how you want your portfolio generated. You can use free models, your own Claude/ChatGPT subscription, or a Gemini key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GenerationMethodCards
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                freeStatus={freeStatus}
                freeLoading={freeLoading}
                freeConsentChecked={freeConsentChecked}
                onFreeConsentChange={setFreeConsentChecked}
                onKeyConnected={(prov) => {
                  if (prov === "google") setHasGeminiKey(true);
                }}
                comingSoonNotice={comingSoonNotice}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(4)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                disabled={!canProceedFromStep5()}
                onClick={() => setCurrentStep(6)}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold active:scale-[0.98]"
              >
                {selectedMethod === "mcp" ? "Proceed to Waiting Panel" : "Next: Review & Generate"}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 6: Trigger Generation, Progress & Hand-off */}
        {currentStep === 6 && generationComplete && (
          <>
            <CardContent className="flex flex-col items-center gap-6 py-12 text-center relative overflow-hidden">
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0 opacity-20 blur-3xl">
                <FluidOrb size={260} color="#3457E8" />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-success/20 text-success shadow-lg shadow-success/20">
                  <CheckCircle2 className="size-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">Your portfolio draft is ready</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Head to Studio to review what was generated — refine any field, tune project metrics, or reorder sections. Nothing is public yet.
                  </p>
                </div>

                <div className="w-full max-w-md space-y-2 rounded-xl border border-border/80 bg-muted/40 p-4 text-left text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Globe className="size-3.5 text-accent" />
                    Publishing is a separate, explicit step
                  </div>
                  <p className="leading-relaxed">
                    Editing and saving in Studio never goes live on its own. When you're happy with it, publish directly to your custom address or export your site package.
                  </p>
                </div>

                <Button size="lg" className="gap-2 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-[0.98]" onClick={() => void navigate({ to: "/studio" })}>
                  <LayoutTemplate className="size-4" />
                  Review & Edit in Studio
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 6 && !generationComplete && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedMethod === "mcp"
                  ? "Step 6: Chat with Claude or ChatGPT"
                  : "Step 6: Generate Your Portfolio Draft"}
              </CardTitle>
              <CardDescription>
                {selectedMethod === "mcp"
                  ? "Follow the prompt in your chat to build your portfolio."
                  : "Review your inputs and trigger the AI generation pipeline."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task C: If B is chosen, show MCP waiting panel */}
              {selectedMethod === "mcp" ? (
                <McpWaitingPanel
                  onPortfolioReady={async () => {
                    await refreshPortfolioStatus();
                    setGenerationComplete(true);
                  }}
                />
              ) : (
                <>
                  {/* Summary overview */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-1">
                      <span className="text-muted-foreground">Selected Resume:</span>
                      <div className="font-semibold truncate text-foreground">
                        {resumeUpload?.filename ?? "No resume uploaded"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-1">
                      <span className="text-muted-foreground">Generation Method:</span>
                      <div className="font-semibold text-accent">
                        {selectedMethod === "free" ? "Free Models" : "My Gemini Key"}
                      </div>
                    </div>
                  </div>

                  {portfolioReady && !generating && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>You already have a portfolio</AlertTitle>
                      <AlertDescription>
                        Generating again will overwrite your current draft.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Active Job Progress View or Failure (Task B) */}
                  {(generating || activeJob) && (
                    <JobProgressView
                      job={activeJob}
                      generating={generating}
                      onTryAgain={() => void handleGenerate()}
                      onEditDetails={() => setCurrentStep(4)}
                      onUseAnotherMethod={() => setCurrentStep(5)}
                      onCancelQueued={() => void handleCancelQueuedJob()}
                      isCancelingQueued={isCancelingQueued}
                    />
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                onClick={() => setCurrentStep(5)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              {selectedMethod !== "mcp" && (
                <Button
                  type="button"
                  disabled={generating || !resumeUpload}
                  onClick={() => (portfolioReady ? setConfirmRegenerateOpen(true) : void handleGenerate())}
                  className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                >
                  {generating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> {portfolioReady ? "Regenerate Portfolio" : "Generate Portfolio"}
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </>
        )}
      </Card>

      <Dialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" />
              Regenerate and overwrite your current draft?
            </DialogTitle>
            <DialogDescription>
              This will run generation with your chosen method ({selectedMethod}). Your current
              Studio draft will be overwritten with the new result.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => {
                setConfirmRegenerateOpen(false);
                void handleGenerate();
              }}
            >
              <Sparkles className="size-4" />
              Yes, regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

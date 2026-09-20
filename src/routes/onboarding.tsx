import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UploadWidget, type UploadItem } from "@/components/upload/UploadWidget";
import { ByokManager, type LLMProvider } from "@/components/byok/ByokManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  FileText,
  Image as ImageIcon,
  User,
  MessageSquare,
  KeyRound,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  LayoutTemplate,
  Globe,
} from "lucide-react";

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
  { step: 5, title: "BYOK Key", icon: KeyRound },
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
  const [selectedProvider, setSelectedProvider] = React.useState<LLMProvider>("anthropic");
  const [hasProviderKey, setHasProviderKey] = React.useState(false);

  // Generation state
  const [generating, setGenerating] = React.useState(false);
  const [generationPhase, setGenerationPhase] = React.useState<string>("");
  const [generationComplete, setGenerationComplete] = React.useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = React.useState(false);
  const [errorDetails, setErrorDetails] = React.useState<{
    title: string;
    message: string;
    issues?: Array<{ path: string; message: string }>;
    retryAfter?: number;
  } | null>(null);

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
      .then((data: { keys?: Array<{ provider: LLMProvider }> }) => {
        if (data.keys && data.keys.some((k) => k.provider === selectedProvider)) {
          setHasProviderKey(true);
        }
      })
      .catch(() => {});
  }, [selectedProvider]);

  const handleGenerate = async () => {
    if (!resumeUpload) {
      setErrorDetails({
        title: "Resume missing",
        message: "Please upload your resume before generating your portfolio.",
      });
      setCurrentStep(1);
      return;
    }

    setGenerating(true);
    setErrorDetails(null);
    setGenerationPhase("Extracting text from resume buffer…");

    const timer1 = setTimeout(() => {
      setGenerationPhase("Prompting LLM with strict content-integrity guardrails…");
    }, 1500);

    const timer2 = setTimeout(() => {
      setGenerationPhase("Validating structured JSON against portfolio content schema…");
    }, 4500);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          resumeUploadId: resumeUpload.id,
          otherSpecifics: otherSpecifics.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = json?.error;
        if (res.status === 401) {
          if (err?.code === "byok_key_invalid") {
            setErrorDetails({
              title: "API Key Rejected by Provider",
              message: err.message ?? "The provider rejected your API key. Check or rotate your key.",
            });
            setCurrentStep(5);
          } else {
            setErrorDetails({
              title: "Missing API Key",
              message: "Please connect an API key for your selected provider first.",
            });
            setCurrentStep(5);
          }
        } else if (res.status === 429) {
          setErrorDetails({
            title: "Generation Rate Limited",
            message:
              err?.message ??
              "You have reached the limit of 5 generations per hour. Please wait before trying again.",
            retryAfter: err?.retryAfterSeconds,
          });
        } else if (res.status === 422) {
          setErrorDetails({
            title: "Schema Validation Issue",
            message: err?.message ?? "The model returned content that did not match the required schema.",
            issues: json?.issues,
          });
        } else if (res.status === 502) {
          setErrorDetails({
            title: "LLM Provider Unavailable",
            message:
              err?.message ??
              "The upstream AI provider experienced an error or rate limit. Please try again in a moment.",
          });
        } else {
          setErrorDetails({
            title: "Generation Failed",
            message: err?.message ?? `Server returned error (${res.status})`,
          });
        }
        return;
      }

      // Success! Unlock Studio (refreshes the shared readiness flag Navbar
      // and the /studio route both gate on), then show a deliberate
      // hand-off screen rather than silently whisking the user away —
      // they should land on a clear next step, not a surprise redirect.
      setGenerationPhase("Content created successfully! Unlocking Studio…");
      await refreshPortfolioStatus();
      setGenerationComplete(true);
    } catch (e: unknown) {
      setErrorDetails({
        title: "Network Error",
        message: e instanceof Error ? e.message : "Failed to connect to generation endpoint.",
      });
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setGenerating(false);
    }
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
                onClick={() => !generating && setCurrentStep(s.step as StepIndex)}
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
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">
                {resumeUpload ? "Resume ready for parsing" : "Upload a PDF or DOCX file to proceed"}
              </span>
              <Button
                type="button"
                disabled={!resumeUpload}
                onClick={() => setCurrentStep(2)}
                className="gap-2"
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
            <CardContent>
              <UploadWidget
                kind="visual_reference"
                maxFilesOverride={3}
                onUploadSuccess={(up) => setVisualReferences((prev) => [...prev, up])}
                onDeleteSuccess={(id) => setVisualReferences((prev) => prev.filter((r) => r.id !== id))}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="gap-2"
              >
                {visualReferences.length > 0 ? "Next: Profile Photo" : "Skip / Next: Profile Photo"}
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
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="gap-2"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="gap-2"
              >
                {photoUpload ? "Next: Specifics" : "Skip / Next: Specifics"}
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 4: Specifics & Free Text */}
        {currentStep === 4 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 4: Additional Specifics & Instructions</CardTitle>
              <CardDescription>
                Provide any custom directions for the generation prompt (e.g., target role, specific projects to emphasize, tone).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Tuning Presets */}
              <div className="space-y-2 rounded-xl border border-indigo-200/60 bg-indigo-50/40 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                    Resume.io AI Tuning Presets
                  </span>
                  <span className="text-[11px] text-muted-foreground">Click to append</span>
                </div>

                <div className="space-y-2 pt-1">
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">Target Engineering Role:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Full-Stack Software Engineer",
                        "Backend & Distributed Systems",
                        "Frontend & UI Architecture",
                        "AI / ML & Data Systems",
                        "Cloud & DevOps Infrastructure",
                      ].map((rolePreset) => (
                        <button
                          key={rolePreset}
                          type="button"
                          onClick={() => {
                            const addition = `Target Role: ${rolePreset}.`;
                            if (!otherSpecifics.includes(addition)) {
                              setOtherSpecifics((prev) => (prev ? `${prev.trim()}\n${addition}` : addition));
                            }
                          }}
                          className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-all hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          + {rolePreset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1">Copywriting Style & Tone:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Google X-Y-Z Impact Formulation (highlight metrics & scale)",
                        "Deep Technical Architecture & Systems focus",
                        "Product-Minded & High-Velocity Startup tone",
                        "Clean, concise ATS-optimized phrasing",
                      ].map((tonePreset) => (
                        <button
                          key={tonePreset}
                          type="button"
                          onClick={() => {
                            const addition = `Style & Tone: ${tonePreset}.`;
                            if (!otherSpecifics.includes(addition)) {
                              setOtherSpecifics((prev) => (prev ? `${prev.trim()}\n${addition}` : addition));
                            }
                          }}
                          className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-all hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          + {tonePreset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="other-specifics" className="text-xs font-medium">
                  Custom instructions for the extraction model:
                </label>
                <Textarea
                  id="other-specifics"
                  placeholder="e.g. Focus on my machine learning internships, highlight my published papers, keep project summaries concise and impact-focused."
                  value={otherSpecifics}
                  onChange={(e) => setOtherSpecifics(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
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
                className="gap-2"
              >
                Next: BYOK Key Setup
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 5: BYOK Key Selection */}
        {currentStep === 5 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 5: Connect Your API Key</CardTitle>
              <CardDescription>
                Choose an AI provider and connect your personal API key. We never bill you for inference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ByokManager
                onKeyConnected={(prov) => {
                  setSelectedProvider(prov);
                  setHasProviderKey(true);
                }}
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
                onClick={() => setCurrentStep(6)}
                className="gap-2"
              >
                Next: Review & Generate
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 6: Trigger Generation, or the post-generation hand-off */}
        {currentStep === 6 && generationComplete && (
          <>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold">Your portfolio draft is ready</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Head to Studio to review what was generated — fix anything that's off, update old
                  roles, or add projects that didn't come from your resume. Nothing is public yet.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Globe className="size-3.5 text-accent" />
                  Publishing is a separate, explicit step
                </div>
                <p>
                  Editing and saving in Studio never goes live on its own. When you're happy with it,
                  connect Vercel and hit Publish from Studio to deploy it to your own account.
                </p>
              </div>
              <Button size="lg" className="gap-2 font-semibold" onClick={() => void navigate({ to: "/studio" })}>
                <LayoutTemplate className="size-4" />
                Review & Edit in Studio
              </Button>
            </CardContent>
          </>
        )}

        {currentStep === 6 && !generationComplete && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 6: Generate Your Portfolio Draft</CardTitle>
              <CardDescription>
                Review your inputs and trigger the AI generation pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary overview */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <span className="text-muted-foreground">Selected Resume:</span>
                  <div className="font-semibold truncate">
                    {resumeUpload?.filename ?? "No resume uploaded"}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <span className="text-muted-foreground">LLM Provider:</span>
                  <div className="font-semibold uppercase tracking-wider text-accent">
                    {selectedProvider}
                  </div>
                </div>
              </div>

              {portfolioReady && (
                <Alert variant="warning">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>You already have a portfolio</AlertTitle>
                  <AlertDescription>
                    Generating again will overwrite your current draft and call your {selectedProvider} key
                    again — using more of your API credits, subject to what your account has available.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Callouts */}
              {errorDetails && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>{errorDetails.title}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{errorDetails.message}</p>
                    {errorDetails.issues && errorDetails.issues.length > 0 && (
                      <div className="mt-2 space-y-1 rounded bg-black/10 p-2 font-mono text-[11px]">
                        {errorDetails.issues.map((iss, idx) => (
                          <div key={idx}>
                            • <span className="font-semibold">{iss.path}:</span> {iss.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {errorDetails.retryAfter && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <Clock className="size-3.5" />
                        <span>Try again in approximately {Math.ceil(errorDetails.retryAfter / 60)} minutes.</span>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Generating active state */}
              {generating && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-accent/40 bg-accent/5 p-8 text-center">
                  <div className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
                    <Sparkles className="size-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base">Crafting your portfolio…</h3>
                    <p className="text-xs text-muted-foreground">{generationPhase}</p>
                  </div>
                  <Loader2 className="size-5 animate-spin text-accent" />
                </div>
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
              This calls your {selectedProvider} API key again and uses more of your available credits —
              subject to whatever quota or balance your account has with that provider. Your current
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

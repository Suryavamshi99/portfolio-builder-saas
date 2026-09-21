import * as React from "react";
import type { Content } from "@/data/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FluidOrb } from "@/components/ui/fluid-orb";
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Briefcase,
  GraduationCap,
  Award,
  Layers,
  Sparkles,
} from "lucide-react";

interface LivePreviewProps {
  content: Content;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

export function LivePreview({ content }: LivePreviewProps) {
  const [mode, setMode] = React.useState<ViewportMode>("desktop");

  const p = content.profile;
  const isProfileEmpty = !p.name && !p.role && !p.thesis;

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Viewport controls bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-accent" />
          <span>Client Live Preview</span>
        </div>
        <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("desktop")}
            className={`size-6 rounded ${mode === "desktop" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Desktop preview width"
          >
            <Monitor className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("tablet")}
            className={`size-6 rounded ${mode === "tablet" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Tablet preview width"
          >
            <Tablet className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("mobile")}
            className={`size-6 rounded ${mode === "mobile" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Mobile preview width (375px)"
          >
            <Smartphone className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Responsive Preview Canvas */}
      <div className="flex-1 overflow-y-auto bg-muted/20 p-2 sm:p-4 flex justify-center">
        <div
          className={`w-full transition-all duration-200 bg-background text-foreground border border-border shadow-md rounded-lg overflow-hidden ${
            mode === "mobile"
              ? "max-w-[375px]"
              : mode === "tablet"
              ? "max-w-[768px]"
              : "max-w-full"
          }`}
        >
          {isProfileEmpty ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-sm font-medium">Portfolio content is empty.</p>
              <p className="text-xs mt-1">Use the editor or Onboarding Wizard to populate fields.</p>
            </div>
          ) : (
            <div className="p-6 sm:p-8 space-y-12 text-foreground">
              {/* Header / Hero */}
              <header className="space-y-4 border-b border-border/80 pb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {p.portrait ? (
                    <img
                      src={p.portrait}
                      alt={p.name}
                      className="size-20 rounded-full object-cover border border-border shadow-xs"
                    />
                  ) : (
                    <div className="relative size-20 rounded-full overflow-hidden border border-accent/30 shadow-xs flex items-center justify-center bg-accent/10">
                      <FluidOrb size={80} color="#3457E8" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {p.name || "Your Name"}
                    </h1>
                    <p className="text-sm font-medium text-accent">{p.role || "Your Title"}</p>
                    {p.location && (
                      <p className="text-xs text-muted-foreground">{p.location}</p>
                    )}
                  </div>
                </div>

                {p.thesis && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.thesis}</p>
                )}

                {/* Social links */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {p.links?.github && (
                    <a
                      href={p.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Github className="size-3" /> GitHub
                    </a>
                  )}
                  {p.links?.linkedin && (
                    <a
                      href={p.links.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Linkedin className="size-3" /> LinkedIn
                    </a>
                  )}
                  {p.emails && p.emails.length > 0 && (
                    <a
                      href={`mailto:${p.emails[0]?.value}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="size-3" /> {p.emails[0]?.label || "Email"}
                    </a>
                  )}
                </div>
              </header>

              {/* About */}
              {content.about?.intro && (
                <section className="space-y-4">
                  <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
                    {content.about.title || "About"}
                  </h2>
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                    {content.about.intro}
                  </p>
                  {content.about.stats && content.about.stats.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                      {content.about.stats.map((s, i) => (
                        <div key={i} className="rounded-lg border border-border bg-card p-3">
                          <div className="text-lg font-bold text-accent">{s.value}</div>
                          <div className="text-[11px] text-muted-foreground">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Work Experience */}
              {content.work?.roles && content.work.roles.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Briefcase className="size-4" /> Work Experience
                  </h2>
                  <div className="space-y-6">
                    {content.work.roles.map((r, i) => (
                      <div key={r.id || i} className="space-y-2 border-l-2 border-accent/40 pl-4">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                          <div className="font-semibold text-sm">{r.title}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.period}</div>
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">
                          {r.org} {r.location ? `• ${r.location}` : ""}
                        </div>
                        {r.claim && <p className="text-xs italic text-accent">{r.claim}</p>}
                        {r.groups?.map((g, gi) => (
                          <div key={gi} className="space-y-1 pt-1">
                            <h4 className="text-[11px] font-semibold text-foreground/80">{g.heading}</h4>
                            <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                              {g.points.map((pt, pti) => (
                                <li key={pti}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Projects */}
              {content.projects && content.projects.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Layers className="size-4" /> Featured Projects
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {content.projects.map((proj, i) => (
                      <div
                        key={proj.slug || i}
                        className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm">{proj.title}</h3>
                            {proj.status && (
                              <Badge
                                variant={
                                  proj.status === "shipped"
                                    ? "success"
                                    : proj.status === "ongoing"
                                    ? "accent"
                                    : "secondary"
                                }
                                className="text-[10px] uppercase"
                              >
                                {proj.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {proj.summary}
                          </p>
                          {proj.tech && proj.tech.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {proj.tech.map((t, ti) => (
                                <span
                                  key={ti}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {proj.links && Object.values(proj.links).some(Boolean) && (
                          <div className="flex gap-2 border-t border-border/40 pt-2 text-xs">
                            {proj.links.demo && (
                              <a
                                href={proj.links.demo}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-accent hover:underline text-[11px]"
                              >
                                Demo <ExternalLink className="size-3" />
                              </a>
                            )}
                            {proj.links.github && (
                              <a
                                href={proj.links.github}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-[11px]"
                              >
                                Code <Github className="size-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Skills */}
              {content.skills?.groups && content.skills.groups.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles className="size-4" /> Skills & Expertise
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {content.skills.groups.map((grp, i) => (
                      <div key={grp.id || i} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="font-semibold text-xs text-foreground">{grp.title}</div>
                        {grp.claim && (
                          <p className="text-[11px] text-muted-foreground italic">{grp.claim}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {grp.skills.map((sk, ski) => (
                            <Badge key={ski} variant="secondary" className="text-xs font-normal">
                              {sk.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Education & Certifications */}
              {((content.work?.education && content.work.education.length > 0) ||
                (content.work?.certifications && content.work.certifications.length > 0)) && (
                <section className="space-y-4 border-t border-border/80 pt-6">
                  <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <GraduationCap className="size-4" /> Education & Credentials
                  </h2>
                  <div className="space-y-3">
                    {content.work?.education?.map((ed, i) => (
                      <div key={i} className="text-xs space-y-0.5">
                        <div className="font-semibold text-foreground">{ed.qualification}</div>
                        <div className="text-muted-foreground">
                          {ed.org} • {ed.period}
                        </div>
                      </div>
                    ))}
                    {content.work?.certifications?.map((c, i) => (
                      <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                        <Award className="size-3.5 text-accent" />
                        <span>{c.name} ({c.year})</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

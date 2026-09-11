import { type ReactNode } from "react";

import type { Content } from "@/data/content";
import { AreaField, ArrayEditor, Field, SelectField, StringList } from "./fields";
import {
  emptyProject,
  emptyRole,
  emptySkillGroup,
  withLink,
  withOpt,
  type Project,
  type Skill,
} from "./model";

export type SectionProps = {
  draft: Content;
  set: (fn: (d: Content) => void) => void;
};

type Section = {
  id: string;
  label: string;
  render: (props: SectionProps) => ReactNode;
};

const ICONS = ["film", "racquet", "philosophy", "running", "generic"] as const;
const STATUS = ["unset", "shipped", "ongoing", "exploration"] as const;

/* ------------------------------------------------------------------ */

function ProfileSection({ draft, set }: SectionProps) {
  const p = draft.profile;
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" value={p.name} onChange={(v) => set((d) => void (d.profile.name = v))} />
      <Field
        label="Role / tagline"
        value={p.role}
        onChange={(v) => set((d) => void (d.profile.role = v))}
      />
      <Field
        label="Location"
        value={p.location}
        onChange={(v) => set((d) => void (d.profile.location = v))}
      />
      <AreaField
        label="Thesis (hero paragraph)"
        rows={4}
        value={p.thesis}
        onChange={(v) => set((d) => void (d.profile.thesis = v))}
      />
      <Field
        label="Portrait URL"
        value={p.portrait}
        hint="A Lovable asset path (/__l5e/…) or any absolute image URL."
        onChange={(v) => set((d) => void (d.profile.portrait = v))}
      />
      <Field
        label="Phone"
        value={p.phone}
        onChange={(v) => set((d) => void (d.profile.phone = v))}
      />
      <ArrayEditor
        label="Emails"
        addLabel="email"
        items={p.emails}
        onChange={(emails) => set((d) => void (d.profile.emails = emails))}
        create={() => ({ label: "", value: "" })}
        title={(e) => e.value || e.label}
      >
        {(e, patch) => (
          <>
            <Field label="Label" value={e.label} onChange={(v) => patch({ ...e, label: v })} />
            <Field label="Address" value={e.value} onChange={(v) => patch({ ...e, value: v })} />
          </>
        )}
      </ArrayEditor>
    </div>
  );
}

function LinksSection({ draft, set }: SectionProps) {
  const l = draft.profile.links;
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="LinkedIn"
        value={l.linkedin}
        onChange={(v) => set((d) => void (d.profile.links.linkedin = v))}
      />
      <Field
        label="GitHub"
        value={l.github}
        onChange={(v) => set((d) => void (d.profile.links.github = v))}
      />
      <Field
        label="Instagram"
        value={l.instagram ?? ""}
        hint="Leave blank to hide it."
        onChange={(v) =>
          set((d) => void (d.profile.links = withOpt(d.profile.links, "instagram", v)))
        }
      />
    </div>
  );
}

function NavSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Navigation"
      addLabel="link"
      items={draft.nav}
      onChange={(nav) => set((d) => void (d.nav = nav))}
      create={() => ({ to: "/", label: "", short: "", index: "" })}
      title={(n) => n.label || n.to}
    >
      {(n, patch) => (
        <>
          <Field label="Path (to)" value={n.to} onChange={(v) => patch({ ...n, to: v })} />
          <Field label="Label" value={n.label} onChange={(v) => patch({ ...n, label: v })} />
          <Field
            label="Short label (top bar)"
            value={n.short}
            hint="Only shown if the path matches a real route."
            onChange={(v) => patch({ ...n, short: v })}
          />
          <Field
            label="Index (e.g. 01)"
            value={n.index}
            onChange={(v) => patch({ ...n, index: v })}
          />
        </>
      )}
    </ArrayEditor>
  );
}

function HomeSection({ draft, set }: SectionProps) {
  const h = draft.home;
  return (
    <div className="flex flex-col gap-4">
      <Field
        label='"Now" heading'
        value={h.nowTitle}
        onChange={(v) => set((d) => void (d.home.nowTitle = v))}
      />
      <AreaField
        label='"Now" paragraph'
        rows={4}
        value={h.nowText}
        onChange={(v) => set((d) => void (d.home.nowText = v))}
      />
      <StringList
        label="Marquee terms"
        multiline={false}
        placeholder="term"
        items={h.marquee}
        onChange={(marquee) => set((d) => void (d.home.marquee = marquee))}
      />
    </div>
  );
}

function ResumesSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Résumés"
      addLabel="résumé"
      items={draft.resumes}
      onChange={(resumes) => set((d) => void (d.resumes = resumes))}
      create={() => ({ label: "", description: "", url: "", filename: "" })}
      title={(r) => r.label}
    >
      {(r, patch) => (
        <>
          <Field label="Label" value={r.label} onChange={(v) => patch({ ...r, label: v })} />
          <AreaField
            label="Description"
            rows={2}
            value={r.description}
            onChange={(v) => patch({ ...r, description: v })}
          />
          <Field label="URL" value={r.url} onChange={(v) => patch({ ...r, url: v })} />
          <Field
            label="Download filename"
            value={r.filename}
            onChange={(v) => patch({ ...r, filename: v })}
          />
        </>
      )}
    </ArrayEditor>
  );
}

function WorkRolesSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Roles"
      addLabel="role"
      items={draft.work.roles}
      onChange={(roles) => set((d) => void (d.work.roles = roles))}
      create={emptyRole}
      title={(r) => [r.org, r.title].filter(Boolean).join(" — ")}
    >
      {(r, patch) => (
        <>
          <Field
            label="ID (stable anchor)"
            value={r.id}
            hint="Lowercase, no spaces. Used in the URL hash."
            onChange={(v) => patch({ ...r, id: v })}
          />
          <Field label="Organisation" value={r.org} onChange={(v) => patch({ ...r, org: v })} />
          <Field
            label="Org note"
            value={r.orgNote ?? ""}
            onChange={(v) => patch(withOpt(r, "orgNote", v))}
          />
          <Field label="Title" value={r.title} onChange={(v) => patch({ ...r, title: v })} />
          <Field label="Period" value={r.period} onChange={(v) => patch({ ...r, period: v })} />
          <Field
            label="Location"
            value={r.location}
            onChange={(v) => patch({ ...r, location: v })}
          />
          <AreaField
            label="Claim"
            rows={2}
            value={r.claim}
            onChange={(v) => patch({ ...r, claim: v })}
          />
          <ArrayEditor
            label="Metrics"
            addLabel="metric"
            items={r.metrics ?? []}
            onChange={(metrics) =>
              patch(metrics.length ? { ...r, metrics } : withOpt(r, "metrics", ""))
            }
            create={() => ({ value: "", label: "" })}
            title={(m) => `${m.value} ${m.label}`.trim()}
          >
            {(m, mp) => (
              <>
                <Field label="Value" value={m.value} onChange={(v) => mp({ ...m, value: v })} />
                <Field label="Label" value={m.label} onChange={(v) => mp({ ...m, label: v })} />
              </>
            )}
          </ArrayEditor>
          <ArrayEditor
            label="Groups"
            addLabel="group"
            items={r.groups}
            onChange={(groups) => patch({ ...r, groups })}
            create={() => ({ heading: "", points: [] })}
            title={(g) => g.heading}
          >
            {(g, gp) => (
              <>
                <Field
                  label="Heading"
                  value={g.heading}
                  onChange={(v) => gp({ ...g, heading: v })}
                />
                <StringList
                  label="Points"
                  placeholder="point"
                  items={g.points}
                  onChange={(points) => gp({ ...g, points })}
                />
              </>
            )}
          </ArrayEditor>
        </>
      )}
    </ArrayEditor>
  );
}

function EducationSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Education"
      addLabel="entry"
      items={draft.work.education}
      onChange={(education) => set((d) => void (d.work.education = education))}
      create={() => ({ org: "", qualification: "", period: "", location: "", notes: [] })}
      title={(e) => e.org}
    >
      {(e, patch) => (
        <>
          <Field label="Organisation" value={e.org} onChange={(v) => patch({ ...e, org: v })} />
          <Field
            label="Qualification"
            value={e.qualification}
            onChange={(v) => patch({ ...e, qualification: v })}
          />
          <Field label="Period" value={e.period} onChange={(v) => patch({ ...e, period: v })} />
          <Field
            label="Location"
            value={e.location}
            onChange={(v) => patch({ ...e, location: v })}
          />
          <StringList
            label="Notes"
            placeholder="note"
            items={e.notes}
            onChange={(notes) => patch({ ...e, notes })}
          />
        </>
      )}
    </ArrayEditor>
  );
}

function CertificationsSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Certifications"
      addLabel="certification"
      items={draft.work.certifications}
      onChange={(certifications) => set((d) => void (d.work.certifications = certifications))}
      create={() => ({ name: "", year: "" })}
      title={(c) => c.name}
    >
      {(c, patch) => (
        <>
          <Field label="Name" value={c.name} onChange={(v) => patch({ ...c, name: v })} />
          <Field label="Year" value={c.year} onChange={(v) => patch({ ...c, year: v })} />
        </>
      )}
    </ArrayEditor>
  );
}

function SkillsSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Skill groups"
      addLabel="group"
      items={draft.skills.groups}
      onChange={(groups) => set((d) => void (d.skills.groups = groups))}
      create={emptySkillGroup}
      title={(g) => g.title}
    >
      {(g, patch) => (
        <>
          <Field label="ID" value={g.id} onChange={(v) => patch({ ...g, id: v })} />
          <Field label="Title" value={g.title} onChange={(v) => patch({ ...g, title: v })} />
          <AreaField
            label="Claim"
            rows={2}
            value={g.claim}
            onChange={(v) => patch({ ...g, claim: v })}
          />
          <ArrayEditor
            label="Skills"
            addLabel="skill"
            items={g.skills}
            onChange={(skills) => patch({ ...g, skills })}
            create={(): Skill => ({ name: "", evidence: "" })}
            title={(s) => s.name}
          >
            {(s, sp) => (
              <>
                <Field label="Name" value={s.name} onChange={(v) => sp({ ...s, name: v })} />
                <AreaField
                  label="Evidence"
                  rows={2}
                  value={s.evidence}
                  onChange={(v) => sp({ ...s, evidence: v })}
                />
                <Field
                  label="Proof link (href)"
                  value={s.href ?? ""}
                  hint="e.g. /work or /projects/decide"
                  onChange={(v) => sp(withOpt(s, "href", v))}
                />
                <Field
                  label="Logo domain"
                  value={s.logo ?? ""}
                  hint="e.g. figma.com — shows the favicon."
                  onChange={(v) => sp(withOpt(s, "logo", v))}
                />
              </>
            )}
          </ArrayEditor>
        </>
      )}
    </ArrayEditor>
  );
}

function AboutSection({ draft, set }: SectionProps) {
  const a = draft.about;
  return (
    <div className="flex flex-col gap-4">
      <Field label="Title" value={a.title} onChange={(v) => set((d) => void (d.about.title = v))} />
      <AreaField
        label="Intro"
        rows={5}
        value={a.intro}
        onChange={(v) => set((d) => void (d.about.intro = v))}
      />
      <ArrayEditor
        label="Stats"
        addLabel="stat"
        items={a.stats}
        onChange={(stats) => set((d) => void (d.about.stats = stats))}
        create={() => ({ value: "", label: "" })}
        title={(s) => `${s.value} ${s.label}`.trim()}
      >
        {(s, patch) => (
          <>
            <Field label="Value" value={s.value} onChange={(v) => patch({ ...s, value: v })} />
            <Field label="Label" value={s.label} onChange={(v) => patch({ ...s, label: v })} />
          </>
        )}
      </ArrayEditor>
      <ArrayEditor
        label="Off hours"
        addLabel="item"
        items={a.offHours}
        onChange={(offHours) => set((d) => void (d.about.offHours = offHours))}
        create={() => ({ title: "", note: "", icon: "generic" as const })}
        title={(o) => o.title}
      >
        {(o, patch) => (
          <>
            <Field label="Title" value={o.title} onChange={(v) => patch({ ...o, title: v })} />
            <Field label="Note" value={o.note} onChange={(v) => patch({ ...o, note: v })} />
            <SelectField
              label="Icon"
              value={o.icon}
              options={ICONS}
              onChange={(icon) => patch({ ...o, icon })}
            />
          </>
        )}
      </ArrayEditor>
    </div>
  );
}

function ProjectsSection({ draft, set }: SectionProps) {
  return (
    <ArrayEditor
      label="Projects & Quests"
      addLabel="project"
      items={draft.projects}
      onChange={(projects) => set((d) => void (d.projects = projects))}
      create={emptyProject}
      title={(p) => p.title || p.slug || "New project"}
    >
      {(p: Project, patch) => (
        <>
          <Field
            label="Slug *"
            value={p.slug}
            hint="URL segment: /projects/<slug>. Must be unique."
            onChange={(v) => patch({ ...p, slug: v })}
          />
          <Field label="Title *" value={p.title} onChange={(v) => patch({ ...p, title: v })} />
          <AreaField
            label="Summary *"
            rows={2}
            value={p.summary}
            onChange={(v) => patch({ ...p, summary: v })}
          />
          <Field
            label="Date *"
            value={p.date}
            hint='"YYYY" or "YYYY-MM". Sorted newest first.'
            onChange={(v) => patch({ ...p, date: v })}
          />
          <Field
            label="Category"
            value={p.category ?? ""}
            hint="Drives the filter chips."
            onChange={(v) => patch(withOpt(p, "category", v))}
          />
          <Field label="Role" value={p.role ?? ""} onChange={(v) => patch(withOpt(p, "role", v))} />
          <SelectField
            label="Status"
            value={p.status ?? "unset"}
            options={STATUS}
            onChange={(v) => patch(withOpt(p, "status", v === "unset" ? "" : v))}
          />
          <Field
            label="GitHub link"
            value={p.links?.github ?? ""}
            onChange={(v) => patch(withLink(p, "github", v))}
          />
          <Field
            label="Paper link"
            value={p.links?.paper ?? ""}
            onChange={(v) => patch(withLink(p, "paper", v))}
          />
          <Field
            label="External link"
            value={p.links?.external ?? ""}
            onChange={(v) => patch(withLink(p, "external", v))}
          />
          <Field
            label="Demo link"
            value={p.links?.demo ?? ""}
            onChange={(v) => patch(withLink(p, "demo", v))}
          />
          <StringList
            label="Tech"
            multiline={false}
            placeholder="tech"
            items={p.tech ?? []}
            onChange={(tech) => patch(tech.length ? { ...p, tech } : withOpt(p, "tech", ""))}
          />
          <ArrayEditor
            label="Body blocks"
            addLabel="block"
            items={p.body ?? []}
            onChange={(body) => patch(body.length ? { ...p, body } : withOpt(p, "body", ""))}
            create={() => ({ heading: "", text: "" })}
            title={(b) => b.heading ?? b.text ?? "Block"}
          >
            {(b, bp) => (
              <>
                <Field
                  label="Heading"
                  value={b.heading ?? ""}
                  onChange={(v) => bp(withOpt(b, "heading", v))}
                />
                <AreaField
                  label="Text"
                  rows={3}
                  value={b.text ?? ""}
                  onChange={(v) => bp(withOpt(b, "text", v))}
                />
                <StringList
                  label="Points"
                  placeholder="point"
                  items={b.points ?? []}
                  onChange={(points) =>
                    bp(points.length ? { ...b, points } : withOpt(b, "points", ""))
                  }
                />
              </>
            )}
          </ArrayEditor>
          <ArrayEditor
            label="Images"
            addLabel="image"
            items={p.images ?? []}
            onChange={(images) =>
              patch(images.length ? { ...p, images } : withOpt(p, "images", ""))
            }
            create={() => ({ src: "", alt: "" })}
            title={(im) => im.alt || im.src}
          >
            {(im, ip) => (
              <>
                <Field label="Source URL" value={im.src} onChange={(v) => ip({ ...im, src: v })} />
                <Field label="Alt text" value={im.alt} onChange={(v) => ip({ ...im, alt: v })} />
              </>
            )}
          </ArrayEditor>
          <AreaField
            label="Counterpoint"
            rows={3}
            value={p.counterpoint ?? ""}
            onChange={(v) => patch(withOpt(p, "counterpoint", v))}
          />
        </>
      )}
    </ArrayEditor>
  );
}

export const SECTIONS: Section[] = [
  { id: "profile", label: "Profile", render: ProfileSection },
  { id: "links", label: "Links", render: LinksSection },
  { id: "nav", label: "Navigation", render: NavSection },
  { id: "home", label: "Home", render: HomeSection },
  { id: "resumes", label: "Résumés", render: ResumesSection },
  { id: "work", label: "Work roles", render: WorkRolesSection },
  { id: "education", label: "Education", render: EducationSection },
  { id: "certifications", label: "Certifications", render: CertificationsSection },
  { id: "skills", label: "Skills", render: SkillsSection },
  { id: "about", label: "About", render: AboutSection },
  { id: "projects", label: "Projects", render: ProjectsSection },
];

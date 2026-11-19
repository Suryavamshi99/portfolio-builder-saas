import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { WaitlistCta } from "@/components/waitlist/WaitlistCta";
import { PricingSection } from "@/components/billing/PricingSection";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { getLaunchMode } from "@/config/launch";

// Seven tilted cards fanned out under the hero headline.
const FAN = [
  { id: "real-maneesh", src: "/landing/real-maneesh.jpg", pos: "0% 0%", rotate: -14, lift: 34 },
  { id: "real-revathi", src: "/landing/real-revathi.jpg", pos: "70% 0%", rotate: -9, lift: 14 },
  { id: "design-file", src: "/theme-thumbs/design-file.jpg", pos: "50% 50%", rotate: -4, lift: 2 },
  { id: "stream-shelf", src: "/theme-thumbs/stream-shelf.jpg", pos: "50% 50%", rotate: 0, lift: 0 },
  { id: "deep-signal", src: "/theme-thumbs/deep-signal.jpg", pos: "50% 50%", rotate: 4, lift: 2 },
  { id: "route-board", src: "/theme-thumbs/route-board.jpg", pos: "50% 50%", rotate: 9, lift: 14 },
  { id: "wheat-brass", src: "/theme-thumbs/wheat-brass.jpg", pos: "50% 50%", rotate: 14, lift: 34 },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Upload your resume",
    body: "A PDF or Word file is all we need. Nothing to retype.",
    tone: "bg-card",
  },
  {
    n: "2",
    title: "Pick a look",
    body: "Choose from 13 designs, or ask for something one of a kind.",
    tone: "bg-lime",
  },
  {
    n: "3",
    title: "Go live",
    body: "Get a link to share today. Add your own domain whenever you like.",
    tone: "bg-card",
  },
] as const;

// Real people's live sites mixed with the ready-made looks. Screenshots live in public/landing.
type Tile =
  | { kind: "real"; img: string; name: string; role: string; quote: string; url: string }
  | { kind: "look"; img: string; name: string };

const GALLERY: Tile[] = [
  { kind: "real", img: "real-maneesh", name: "Maneesh Bichala", role: "Associate Analyst, Deloitte", quote: "I didn't have to think about hosting or design, just my own story.", url: "https://maneeshbichala.vercel.app/" },
  { kind: "look", img: "tpl-two-ink", name: "Poster Pop" },
  { kind: "look", img: "tpl-deep-signal", name: "Data Glow" },
  { kind: "real", img: "real-harshit", name: "Harshit Chebolu", role: "AI Product & Strategy", quote: "From a stack of PDF drafts to a live site in one sitting.", url: "https://harshit-chebolu.vercel.app/" },
  { kind: "look", img: "tpl-design-file", name: "Design Canvas" },
  { kind: "look", img: "tpl-stream-shelf", name: "Binge Shelf" },
  { kind: "real", img: "real-shrividya", name: "Shrividya Ramesh", role: "Sports Management & Gaming", quote: "Something recruiters could click through, not just skim.", url: "https://my-personal-portfolio-orpin-six.vercel.app/" },
  { kind: "look", img: "tpl-atlas-desk", name: "Map View" },
  { kind: "look", img: "tpl-mascot-guide", name: "Mascot" },
  { kind: "real", img: "real-atul", name: "Atul Sreejil", role: "Sales & Marketing", quote: "My numbers finally had a place that looked as sharp as they are.", url: "https://atulsreejilportfolio-drab.vercel.app/" },
  { kind: "look", img: "tpl-grid-ledger", name: "Spreadsheet" },
  { kind: "real", img: "real-revathi", name: "Revathi Iyer", role: "Risk Consultant", quote: "Made turning case work into something presentable way less painful.", url: "https://revathiportfolio-eight.vercel.app/" },
];

const BAND = ["Resume in", "Portfolio out", "Free to try", "Live in minutes", "Your own domain"] as const;

function Eyebrow({ lead, accent }: { lead: string; accent: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
      {lead} <span className="text-accent">{accent}</span>
    </p>
  );
}

function PrimaryCta({ label = "Create my portfolio", source = "hero" }: { label?: string; source?: string }) {
  if (getLaunchMode() === "waitlist") {
    return source === "hero" ? (
      <WaitlistCta id="waitlist" source={source} buttonLabel="Join the waitlist" />
    ) : (
      <WaitlistCta source={source} buttonLabel="Join the waitlist" />
    );
  }
  return (
    <Button asChild size="lg" className="gap-2">
      <Link to="/login" search={{ redirect: "/onboarding" }}>
        {label}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

export function GuestLanding() {
  const launchMode = getLaunchMode();

  return (
    <div className="space-y-24 pb-6 sm:space-y-32">
      {/* Hero: one headline, a fan of real looks, one action. */}
      <section className="flex flex-col items-center text-center">
        <Logo size="xl" className="mb-8" />
        <h1
          className="max-w-4xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-6xl md:text-7xl"
          style={{ textWrap: "balance" }}
        >
          Turn your <span className="mark">resume</span> into a live <span className="mark">website.</span>
        </h1>

        <div
          className="relative mt-12 flex h-56 w-full max-w-3xl items-center justify-center sm:mt-16 sm:h-72"
          aria-hidden="true"
        >
          {FAN.map((card, i) => (
            <img
              key={card.id}
              src={card.src}
              alt=""
              width={256}
              height={256}
              loading={i === 3 ? "eager" : "lazy"}
              className="-ml-10 size-28 rounded-3xl object-cover shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] transition-transform duration-300 first:ml-0 hover:-translate-y-2 sm:-ml-14 sm:size-44"
              style={{ objectPosition: card.pos, transform: `translateY(${card.lift}px) rotate(${card.rotate}deg)`, zIndex: i === 3 ? 10 : 7 - Math.abs(3 - i) }}
            />
          ))}
        </div>

        <p className="mt-10 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
          Upload your resume. Pick a look. Share one link. <span className="whitespace-nowrap font-semibold text-foreground">Free to try.</span>
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta source="hero" />
          {launchMode !== "waitlist" && (
            <Button asChild variant="outline" size="lg">
              <Link to="/" hash="portfolios" hashScrollIntoView>
                See real portfolios
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* How it works: three cards stepping down the page. */}
      <section id="how-it-works" className="scroll-mt-24 space-y-10">
        <Reveal className="space-y-3 text-center">
          <Eyebrow lead="HOW IT" accent="WORKS" />
          <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Three steps. <span className="mark">No design skills.</span>
          </h2>
        </Reveal>

        <StaggerGroup className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StaggerItem
              key={step.n}
              className={`flex min-h-64 flex-col justify-between rounded-[2rem] border border-border p-7 ${step.tone} ${
                i === 1 ? "md:translate-y-10" : i === 2 ? "md:translate-y-20" : ""
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {step.n}
              </span>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-foreground/70">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <div className="hidden md:block md:h-20" aria-hidden="true" />
      </section>

      {/* Portfolios: real people's sites mixed with the ready-made looks */}
      <section id="portfolios" className="scroll-mt-24 space-y-10">
        <Reveal className="space-y-3 text-center">
          <Eyebrow lead="REAL SITES +" accent="13 LOOKS" />
          <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            See what you could <span className="mark">ship.</span>
          </h2>
        </Reveal>

        <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY.map((tile) => {
            const real = tile.kind === "real";
            const card = (
              <>
                <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card">
                  <img
                    src={`/landing/${tile.img}.jpg`}
                    alt={real ? `${tile.name}'s live portfolio` : `${tile.name} look`}
                    width={1440}
                    height={900}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold ${
                      real ? "bg-lime text-foreground" : "bg-white/90 text-foreground"
                    }`}
                  >
                    {real ? "Real site" : "Template"}
                  </span>
                </div>
                <div className="space-y-0.5 px-2 pt-3">
                  <p className="flex items-center gap-1.5 text-base font-semibold tracking-[-0.02em]">
                    {tile.name}
                    {real && <ExternalLink className="size-3.5 text-muted-foreground" />}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {real ? `${tile.role} · “${tile.quote}”` : "Ready-made look, built from your resume"}
                  </p>
                </div>
              </>
            );
            return (
              <StaggerItem key={tile.img}>
                {real ? (
                  <a href={tile.url} target="_blank" rel="noopener" className="group block">
                    {card}
                  </a>
                ) : (
                  <Link to="/themes" className="group block">
                    {card}
                  </Link>
                )}
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        <div className="flex justify-center">
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/themes">
              Browse all 13 looks <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Lime ticker band */}
      <section aria-label="Highlights" className="overflow-hidden rounded-[2rem] bg-lime py-8 sm:py-12">
        <div className="marquee-track" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {BAND.map((word) => (
                <span key={`${copy}-${word}`} className="flex items-center">
                  <span className="px-6 text-5xl font-semibold tracking-[-0.05em] sm:px-10 sm:text-7xl">{word}</span>
                  <span className="size-4 rounded-full bg-foreground sm:size-5" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="sr-only">{BAND.join(". ")}.</p>
      </section>

      {/* Two big promises */}
      <section className="grid gap-5 md:grid-cols-2">
        <Reveal className="flex min-h-96 flex-col justify-end gap-4 rounded-[2rem] bg-magenta p-8 text-white">
          <h3 className="text-4xl font-semibold leading-[1.02] tracking-[-0.04em]">
            Build it free.
            <br />
            Pay only to publish.
          </h3>
          <p className="max-w-xs text-sm leading-relaxed text-white/80">
            See the whole portfolio before you spend anything. Your private preview is always free.
          </p>
          <div>
            <Button asChild className="bg-white text-foreground hover:bg-white/90">
              <Link to="/login" search={{ redirect: "/onboarding" }}>
                Start free
              </Link>
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="flex min-h-96 flex-col justify-end gap-4 rounded-[2rem] border border-border bg-card p-8">
          <h3 className="text-4xl font-semibold leading-[1.02] tracking-[-0.04em]">
            Your link.
            <br />
            Your <span className="mark">own domain.</span>
          </h3>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Go live on an instant link, connect a custom domain, or download the files and host them anywhere.
          </p>
          <div>
            <Button asChild>
              <Link to="/" hash="pricing" hashScrollIntoView>
                See pricing
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <PricingSection />

      {/* Privacy, in one plain sentence */}
      <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Private by default.</span> We never sell your data. Resumes and
        reference screenshots are deleted within 48 hours, and location data is stripped from photos.
      </p>

      {/* Closing call to action */}
      <Reveal className="rounded-[2rem] bg-foreground px-6 py-16 text-center text-background sm:py-24">
        <div className="mx-auto max-w-2xl space-y-7">
          <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            Ready to put your work <span className="rounded-md bg-lime px-2 text-foreground">online?</span>
          </h2>
          {launchMode === "waitlist" ? (
            <div className="flex justify-center">
              <WaitlistCta source="bottom-banner" buttonLabel="Join the waitlist" />
            </div>
          ) : (
            <Button asChild size="lg" className="gap-2 bg-lime text-foreground hover:bg-lime/85">
              <Link to="/login" search={{ redirect: "/onboarding" }}>
                Create my portfolio
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </Reveal>

      <footer className="flex flex-col items-center justify-between gap-5 pb-4 text-xs text-muted-foreground sm:flex-row">
        <Logo size="lg" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          {launchMode === "waitlist" ? (
            <Link to="/" hash="waitlist" hashScrollIntoView className="hover:text-foreground">
              Join waitlist
            </Link>
          ) : (
            <Link to="/login" className="hover:text-foreground">
              Sign in
            </Link>
          )}
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="/terms" className="hover:text-foreground">
            Terms
          </a>
          <a href="/refund" className="hover:text-foreground">
            Refunds
          </a>
          <a href="/privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href="mailto:vamshi.ravi99@gmail.com" className="hover:text-foreground">
            Contact
          </a>
        </nav>
        <span>© {new Date().getFullYear()} Shipfolio</span>
      </footer>
    </div>
  );
}

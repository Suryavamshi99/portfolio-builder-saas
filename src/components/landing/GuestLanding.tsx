import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { WaitlistCta } from "@/components/waitlist/WaitlistCta";
import { PricingSection } from "@/components/billing/PricingSection";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { getLaunchMode } from "@/config/launch";

// Five tilted cards fanned out under the hero headline: real people's live sites.
const FAN = [
  { id: "real-maneesh", src: "/landing/real-maneesh.jpg", pos: "0% 0%", rotate: -12, lift: 24 },
  { id: "real-revathi", src: "/landing/real-revathi.jpg", pos: "70% 0%", rotate: -6, lift: 6 },
  { id: "real-harshit", src: "/landing/real-harshit.jpg", pos: "50% 0%", rotate: 0, lift: 0 },
  { id: "real-shrividya", src: "/landing/real-shrividya.jpg", pos: "50% 0%", rotate: 6, lift: 6 },
  { id: "real-atul", src: "/landing/real-atul.jpg", pos: "50% 0%", rotate: 12, lift: 24 },
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
    title: "Tell us the style",
    body: "Get a one-of-a-kind design, or ask for the look of a company you admire.",
    tone: "bg-aurora-mint",
  },
  {
    n: "3",
    title: "Go live",
    body: "Get a link to share today. Add your own domain whenever you like.",
    tone: "bg-card",
  },
] as const;

// Real people's live sites. Screenshots live in public/landing.
interface Tile {
  img: string;
  name: string;
  role: string;
  quote: string;
  url: string;
}

const GALLERY: Tile[] = [
  { img: "real-maneesh", name: "Maneesh Bichala", role: "Associate Analyst, Deloitte", quote: "I didn't have to think about hosting or design, just my own story.", url: "https://maneeshbichala.vercel.app/" },
  { img: "real-harshit", name: "Harshit Chebolu", role: "AI Product & Strategy", quote: "From a stack of PDF drafts to a live site in one sitting.", url: "https://harshit-chebolu.vercel.app/" },
  { img: "real-shrividya", name: "Shrividya Ramesh", role: "Sports Management & Gaming", quote: "Something recruiters could click through, not just skim.", url: "https://my-personal-portfolio-orpin-six.vercel.app/" },
  { img: "real-atul", name: "Atul Sreejil", role: "Sales & Marketing", quote: "My numbers finally had a place that looked as sharp as they are.", url: "https://atulsreejilportfolio-drab.vercel.app/" },
  { img: "real-revathi", name: "Revathi Iyer", role: "Risk Consultant", quote: "Made turning case work into something presentable way less painful.", url: "https://revathiportfolio-eight.vercel.app/" },
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
          className="max-w-4xl font-display text-[1.9rem] font-medium leading-[1.12] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl"
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
              loading={i === 2 ? "eager" : "lazy"}
              className="-ml-10 size-28 rounded-3xl object-cover shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] transition-transform duration-300 first:ml-0 hover:-translate-y-2 sm:-ml-14 sm:size-44"
              style={{ objectPosition: card.pos, transform: `translateY(${card.lift}px) rotate(${card.rotate}deg)`, zIndex: i === 2 ? 10 : 6 - Math.abs(2 - i) }}
            />
          ))}
        </div>

        <p className="mt-10 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
          Upload your resume. Get your site. Share one link. <span className="whitespace-nowrap font-semibold text-foreground">Free to try.</span>
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
          <h2 className="font-display text-2xl font-medium tracking-[-0.03em] sm:text-4xl">
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
                <h3 className="font-display text-lg font-medium tracking-[-0.02em]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-foreground/70">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <div className="hidden md:block md:h-20" aria-hidden="true" />
      </section>

      {/* Portfolios: real people's sites */}
      <section id="portfolios" className="scroll-mt-24 space-y-10">
        <Reveal className="space-y-3 text-center">
          <Eyebrow lead="REAL" accent="SITES" />
          <h2 className="font-display text-2xl font-medium tracking-[-0.03em] sm:text-4xl">
            See what you could <span className="mark">ship.</span>
          </h2>
        </Reveal>

        <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY.map((tile) => (
            <StaggerItem key={tile.img}>
              <a href={tile.url} target="_blank" rel="noopener" className="group block">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card">
                  <img
                    src={`/landing/${tile.img}.jpg`}
                    alt={`${tile.name}'s live portfolio`}
                    width={1440}
                    height={900}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-aurora-mint px-3 py-1 text-[11px] font-semibold text-foreground">Real site</span>
                </div>
                <div className="space-y-0.5 px-2 pt-3">
                  <p className="flex items-center gap-1.5 text-base font-semibold tracking-[-0.02em]">
                    {tile.name}
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </p>
                  <p className="text-sm text-muted-foreground">{`${tile.role} · “${tile.quote}”`}</p>
                </div>
              </a>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Brand-blue ticker band */}
      <section aria-label="Highlights" className="overflow-hidden rounded-[2rem] bg-aurora-blue text-white py-8 sm:py-12">
        <div className="marquee-track" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {BAND.map((word) => (
                <span key={`${copy}-${word}`} className="flex items-center">
                  <span className="px-6 font-display text-3xl font-medium tracking-[-0.04em] sm:px-10 sm:text-5xl">{word}</span>
                  <span className="size-4 rounded-full bg-white sm:size-5" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="sr-only">{BAND.join(". ")}.</p>
      </section>

      {/* Two big promises */}
      <section className="grid gap-5 md:grid-cols-2">
        <Reveal className="flex min-h-96 flex-col justify-end gap-4 rounded-[2rem] bg-aurora-cyan p-8 text-foreground">
          <h3 className="font-display text-2xl font-medium leading-[1.15] tracking-[-0.03em] sm:text-3xl">
            Build it free.
            <br />
            Pay only to publish.
          </h3>
          <p className="max-w-xs text-sm leading-relaxed text-foreground/75">
            See the whole portfolio before you spend anything. Your private preview is always free.
          </p>
          <div>
            <Button asChild>
              <Link to="/login" search={{ redirect: "/onboarding" }}>
                Start free
              </Link>
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="flex min-h-96 flex-col justify-end gap-4 rounded-[2rem] border border-border bg-card p-8">
          <h3 className="font-display text-2xl font-medium leading-[1.15] tracking-[-0.03em] sm:text-3xl">
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

      {/* Privacy, in one plain statement */}
      <p className="mx-auto max-w-3xl text-balance text-center font-display text-base font-light leading-relaxed tracking-[-0.01em] text-foreground/85 sm:text-xl">
        <span className="mark font-medium text-foreground">Private by default.</span> We{" "}
        <span className="mark">never sell your data.</span> Resumes and reference screenshots are deleted within 48
        hours, and location data is stripped from photos.
      </p>

      {/* Closing call to action */}
      <Reveal className="rounded-[2rem] bg-foreground px-6 py-16 text-center text-background sm:py-24">
        <div className="mx-auto max-w-2xl space-y-7">
          <h2 className="font-display text-2xl font-medium leading-[1.15] tracking-[-0.03em] sm:text-5xl">
            Ready to put your work <span className="rounded-md bg-aurora-mint px-2 text-foreground">online?</span>
          </h2>
          {launchMode === "waitlist" ? (
            <div className="flex justify-center">
              <WaitlistCta source="bottom-banner" buttonLabel="Join the waitlist" />
            </div>
          ) : (
            <Button asChild size="lg" className="gap-2 bg-aurora-mint text-foreground hover:bg-aurora-mint/85">
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

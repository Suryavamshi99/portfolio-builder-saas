import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";

import { FluidOrb } from "@/components/ui/fluid-orb";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-[65vh] items-center justify-center px-4 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-25 blur-3xl">
        <FluidOrb size={300} color="#3457E8" />
      </div>
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-7xl font-black tracking-tight text-accent">404</h1>
        <h2 className="text-xl font-bold text-foreground">Page not found</h2>
        <p className="text-sm text-muted-foreground">The page you were looking for doesn't exist.</p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90 active:scale-[0.98]"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: unknown }) {
  console.error(error);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-bold text-destructive">An unexpected error occurred</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90 active:scale-[0.98]"
          >
            Return to safety
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Public address of the site, for absolute URLs in social-share tags (the head also renders in the browser, where server env is unavailable). */
const SITE_URL = "https://www.shipfolio.xyz";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shipfolio — AI Resume to Live Developer Portfolio Builder" },
      {
        name: "description",
        content:
          "Turn your resume into a job-winning, edge-deployed developer portfolio in minutes. Recruiter-tested sections, action-verb impact tuning, and recruiter-grade AI.",
      },
      { name: "theme-color", content: "#0B0D12" },
      // Social share card (Slack, X, LinkedIn, WhatsApp): the image must be an absolute URL.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Shipfolio" },
      { property: "og:title", content: "Shipfolio: your resume, live as a portfolio in 30 seconds" },
      {
        property: "og:description",
        content: "Turn your resume into a bespoke developer portfolio and put it online in about 30 seconds.",
      },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Dark-only: there's no light theme toggle anymore, so the class is set
    // on the server-rendered <html> itself (no client effect, no flash).
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-accent/20 selection:text-accent">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            <Outlet />
          </main>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

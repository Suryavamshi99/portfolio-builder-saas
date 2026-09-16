# Frontend Implementation Changelog

This document logs all frontend changes and new architecture introduced to implement the user interface for **Portfolio Builder SaaS** (`portfolio-builder-saas`).

All server-side business rules, endpoints, and validation logic documented in [`API.md`](./API.md) have been strictly preserved. The frontend calls `/api/*` endpoints and Supabase Auth directly without duplicating or bypassing any server-side validation.

---

## 1. Summary of Changes

| Category | File | Description |
|---|---|---|
| **Build & Config** | [`vite.config.ts`](./vite.config.ts) | Enabled native Vite 8 `resolve.tsconfigPaths: true` and cleaned up deprecated plugin warnings. |
| **Design System** | [`src/styles.css`](./src/styles.css) | Established WCAG AA compliant color palette for light and dark modes, universal `:focus-visible` 2px ring, and legacy token aliases (`rule`, `ink`, `paper`). |
| **UI Primitives** | [`src/components/ui/badge.tsx`](./src/components/ui/badge.tsx) | New: Status pill with `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `accent` variants. |
| **UI Primitives** | [`src/components/ui/card.tsx`](./src/components/ui/card.tsx) | New: Surface cards (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`). |
| **UI Primitives** | [`src/components/ui/progress.tsx`](./src/components/ui/progress.tsx) | New: Accessible progress bar with `role="progressbar"` and dynamic threshold colors. |
| **UI Primitives** | [`src/components/ui/alert.tsx`](./src/components/ui/alert.tsx) | New: Notification alerts for honest server error codes, warnings, and trust notices. |
| **UI Primitives** | [`src/components/ui/tabs.tsx`](./src/components/ui/tabs.tsx) | New: Keyboard-accessible tab navigation (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`). |
| **UI Primitives** | [`src/components/ui/dialog.tsx`](./src/components/ui/dialog.tsx) | New: Accessible modal dialog with backdrop blur, focus trap, and Escape key dismissal. |
| **UI Primitives** | [`src/components/ui/input.tsx`](./src/components/ui/input.tsx) | Updated: Surface background, crisp borders, and accessible focus ring. |
| **UI Primitives** | [`src/components/ui/textarea.tsx`](./src/components/ui/textarea.tsx) | Updated: Surface background, `min-h-[70px]`, and accessible focus ring. |
| **Auth & Session** | [`src/lib/auth.tsx`](./src/lib/auth.tsx) | New: React Context and `useAuth()` hook wrapping Supabase Auth browser SDK (`createSupabaseBrowserClient`). |
| **Auth & Session** | [`src/components/auth/AuthGuard.tsx`](./src/components/auth/AuthGuard.tsx) | New: Route protection component redirecting unauthenticated users to `/login?redirect=...`. |
| **Navigation** | [`src/components/layout/Navbar.tsx`](./src/components/layout/Navbar.tsx) | New: Persistent responsive header with theme toggle (dark/light stored in `localStorage`), links, user email, and sign out. |
| **Shell** | [`src/routes/__root.tsx`](./src/routes/__root.tsx) | Updated: Wrapped app in `AuthProvider`, integrated `Navbar`, and refined 404/Error fallbacks. |
| **Auth Screen** | [`src/routes/login.tsx`](./src/routes/login.tsx) | New: Tabbed Sign In & Sign Up interface with error handling, email confirmation notice, and redirect preservation. |
| **Upload Widget** | [`src/components/upload/UploadWidget.tsx`](./src/components/upload/UploadWidget.tsx) | New: Reusable widget for all 4 upload kinds (`resume`, `visual_reference`, `photo`, `project_image`), real-time 50MB storage quota meter, countdown timer for 429 rate limits, and plain-language translations for server errors. |
| **BYOK Management** | [`src/components/byok/ByokManager.tsx`](./src/components/byok/ByokManager.tsx) | New: Connect, rotate, and disconnect Anthropic, OpenAI, and Google keys. Displays encryption notice; never echoes or re-requests stored key secrets. |
| **Onboarding** | [`src/routes/onboarding.tsx`](./src/routes/onboarding.tsx) | New: 6-step progressive disclosure wizard (Resume → Visual Style → Headshot → Specifics → BYOK Key → Generation) with multi-phase generation states and schema issue diagnostics. |
| **Live Preview** | [`src/components/preview/LivePreview.tsx`](./src/components/preview/LivePreview.tsx) | New: Client-side real-time preview of draft `Content` with Desktop, Tablet (768px), and Mobile (375px) viewport toggles. |
| **Publishing** | [`src/components/publish/PublishToolbar.tsx`](./src/components/publish/PublishToolbar.tsx) | New: Vercel OAuth connection trigger, deployment tracking poller (`queued` → `building` → `ready` / `error`), and live deployment URL links. |
| **Studio Editor** | [`src/routes/-studio/Editor.tsx`](./src/routes/-studio/Editor.tsx) | Updated: Design system restyle, `LivePreview` integration with Split/Edit/Preview modes, `PublishToolbar`, and inline server validation rendering. |
| **Studio Fields** | [`src/routes/-studio/fields.tsx`](./src/routes/-studio/fields.tsx) | Updated: Replaced legacy classes with design tokens (`text-muted-foreground`, `border-border`, `bg-card`). |
| **Studio Route** | [`src/routes/studio.tsx`](./src/routes/studio.tsx) | Updated: Protected by `AuthGuard`, improved async skeleton loader and error retry state. |
| **Dashboard / Home** | [`src/routes/index.tsx`](./src/routes/index.tsx) | Updated: Dual view (authenticated dashboard with storage quota bar and live site status vs. guest marketing pitch with trust disclosures); handles `/?vercel=connected` redirect query param. |
| **Settings** | [`src/routes/settings.tsx`](./src/routes/settings.tsx) | New: Account settings with tabbed BYOK key management, Vercel OAuth disconnect (`DELETE /api/vercel`), and storage asset manager. |
| **Router Tree** | [`src/routeTree.gen.ts`](./src/routeTree.gen.ts) | Auto-generated: Updated by TanStack Router plugin to register `/login`, `/onboarding`, and `/settings`. |

---

## 2. API Contract Adherence (`API.md`)

Every interaction strictly adheres to the contracts defined in [`API.md`](./API.md):

1. **`GET /api/me`**:
   - Fetched on the Dashboard ([`src/routes/index.tsx`](./src/routes/index.tsx)) and Settings ([`src/routes/settings.tsx`](./src/routes/settings.tsx)).
   - Surfaces `storage.usedBytes` and `storage.quotaBytes` (50MB free cap) into the visual progress bar.
2. **`GET / PUT /api/content`**:
   - Queried and saved inside Studio ([`src/routes/studio.tsx`](./src/routes/studio.tsx) and [`src/routes/-studio/Editor.tsx`](./src/routes/-studio/Editor.tsx)).
   - If `PUT` returns `422 content_invalid` with `issues: [{ path, message }]`, errors are displayed inline next to the flagged fields.
3. **`POST /api/uploads` & `GET /api/uploads` & `DELETE /api/uploads/:id`**:
   - Handled by [`src/components/upload/UploadWidget.tsx`](./src/components/upload/UploadWidget.tsx).
   - Server-side error codes (`upload_invalid_type`, `upload_too_large`, `upload_limit_exceeded`, `upload_quota_exceeded`, `rate_limited`) are rendered with actionable user messaging.
   - For `rate_limited` (`429`), `retryAfterSeconds` is used to run a live countdown timer.
4. **`POST /api/byok-keys` & `GET /api/byok-keys` & `DELETE /api/byok-keys/:provider`**:
   - Managed via [`src/components/byok/ByokManager.tsx`](./src/components/byok/ByokManager.tsx).
   - Rotating an existing key calls `POST /api/byok-keys` (server upserts).
   - Disconnecting calls `DELETE /api/byok-keys/:provider`.
   - Never requests or attempts to display key secrets.
5. **`POST /api/generate`**:
   - Called in Step 6 of the Onboarding Wizard ([`src/routes/onboarding.tsx`](./src/routes/onboarding.tsx)).
   - Passes `{ provider, resumeUploadId, otherSpecifics }`.
   - Handles `401 byok_key_missing`, `401 byok_key_invalid`, `422 generation_invalid_output` (showing schema `issues`), `429 rate_limited` (5/hr cap), and `502 llm_provider_error`.
6. **Vercel & Publishing (`/api/vercel/*` & `/api/publish*`)**:
   - Handled in [`src/components/publish/PublishToolbar.tsx`](./src/components/publish/PublishToolbar.tsx) and [`src/routes/settings.tsx`](./src/routes/settings.tsx).
   - Connecting initiates a top-level window navigation to `GET /api/vercel/oauth/start`.
   - Disconnecting calls `DELETE /api/vercel`.
   - Publishing calls `POST /api/publish` (202 response) and polls `GET /api/publish/status` every 2.5 seconds until a terminal status (`ready` or `error`) is reached.
   - Returning from OAuth at `/?vercel=connected` is caught by [`src/routes/index.tsx`](./src/routes/index.tsx) with a success banner.

---

## 3. Trust & Privacy Disclosures

As required for student portfolios handling resumes and API keys:
- **Resumes & Visual References**: Prominently marked with the 48-hour automated retention purge policy.
- **Photos & Project Images**: Noted that EXIF/GPS metadata is automatically stripped server-side, with 30-day draft retention and edge bundle embedding on publish.
- **BYOK Keys**: Highlighted with AES-256-GCM envelope encryption and zero logging guarantees.

---

## 4. Verification & Testing

- `npx tsc --noEmit`: **0 errors** (including strict conformance with `exactOptionalPropertyTypes: true`).
- `npx vite build`: **0 warnings, 0 errors** (both client and SSR environments compiled).

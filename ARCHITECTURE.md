# Architecture

EventCanvas is a single Next.js app. The plan lives in the browser (IndexedDB), all planning logic is plain TypeScript that runs
without a network, and the server only exists to call the AI models safely.

```text
Browser
  app/ pages ─► components/ ─► lib/actions.ts ─► lib/store.ts ─► IndexedDB  (+ BroadcastChannel to other tabs)
                     │
                     └─► lib/engine/        pure: layout, seating, costs, safety, offline generators

  lib/ai-client.ts ── typed fetch ──┐
                                    ▼
Server (Vercel Functions)
  app/api/ai/*/route.ts ─► lib/ai/guard.ts ─► lib/ai/provider.ts ─► Groq, failing over to Gemini
                           origin check,      10-minute response cache
                           rate limit, size,
                           zod validation
```

## Layers

| Layer       | Folder                       | Rule                                                                                                 |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pages       | `src/app/**/page.tsx`        | Compose components, read the current event, call actions. No business rules.                         |
| Components  | `src/components/<feature>/`  | Presentational pieces grouped by feature (blueprint, guests, budget, vendors, assistant, event).     |
| UI kit      | `src/components/ui/`         | shadcn (Base UI) primitives, kept as generated.                                                      |
| Actions     | `src/lib/actions.ts`         | Every plan mutation, written against an immer draft. Shared by the UI **and** the AI co-planner.     |
| Store       | `src/lib/store.ts`           | Zustand + immer, undo/redo with coalescing, batched IndexedDB saves, cross-tab sync.                 |
| Engine      | `src/lib/engine/`            | Pure functions, no React, no I/O. This is where the tests concentrate.                               |
| Catalog     | `src/lib/catalog/`           | Static data: element kinds and sizes, event types, budget splits, venue templates.                   |
| AI (server) | `src/lib/ai/`, `src/app/api` | Guarded routes, request/response schemas, provider failover. `provider.ts` is `server-only`.         |
| AI (client) | `src/lib/ai-client.ts`       | Typed `aiApi.*` calls; every one returns `null` on failure so pages fall back to the offline engine. |

## Module map

**Engine (`src/lib/engine/`)**

- `geometry.ts`: boxes, centres, overlap, `inBox`, seat positions and codes.
- `layout.ts`: auto-layout (scored placement plus scan-line packing) and `findFreeSpot`.
- `seating.ts`: constraint-aware greedy seating (families together, VIPs up front, wheelchair users near doors).
- `validation.ts`: fire-safety and accessibility checks that produce the safety score.
- `costs.ts`: blueprint-driven costs, budget summary and payment dues.
- `planning.ts`: vendor checklist, countdown tasks, run of show.
- `factory.ts`: builds a new `EventPlan` from the create-event form or an AI plan.
- `offline.ts`: deterministic generators used whenever the AI is unavailable (ideas, budget tips, letters).

**App logic (`src/lib/`)**

- `actions.ts`: add/move/swap/remove/duplicate elements, zones, budget suggestions, `markDuePaid`.
- `assistant-tools.ts`: runs the co-planner's tool calls in the browser by validating input against `ai/chat-tools.ts`, then calling actions.
- `guests.ts`: guest defaults and the loose CSV importer.
- `booking.ts`, `seat-link.ts`, `seat-visuals.ts`: seat booking, the privacy-preserving "find my seat" link, seat colours.
- `math.ts`, `format.ts`, `utils.ts`: small shared helpers.

**AI (`src/lib/ai/`)**

- `guard.ts`: same-origin check, per-IP rate limit, body-size cap, zod validation.
- `requests.ts` / `schemas.ts`: what the browser may send / what the model must return.
- `chat-tools.ts`: the 12 co-planner tools, shared by the chat route and the browser.
- `provider.ts`: Groq first, Gemini fallback via model middleware, response cache, shared planner persona.

## Key decisions

- **One mutation path.** Buttons, keyboard shortcuts and AI tool calls all go through `lib/actions.ts`, so a change made by the AI
  behaves exactly like one made by hand, including undo.
- **Offline first.** Every AI feature has a deterministic fallback in `engine/offline.ts`; the AI improves results but is never
  required.
- **AI never places furniture.** The model decides _what_ goes into a venue; `engine/layout.ts` decides _where_, so aisles and
  exits stay safe.
- **Client-side tools.** The chat route streams tool calls; the browser executes them against the local plan and sends results
  back. The server never sees or stores the plan beyond the request.

## Quality gates

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage` and `npm run build` run in CI on every push
(`.github/workflows/ci.yml`).

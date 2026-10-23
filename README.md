# EventCanvas: AI celebration planner on a living blueprint

**Hack2Skill PromptWar · Challenge 5: Celebration & Event Planner**

**Live demo: https://eventcanvas-nine.vercel.app** (open a demo event from the home page)

Plan weddings, birthdays and community events the way BookMyShow shows a theatre: as a **seat map**. You lay out the venue on a real-scale blueprint, and everything else is wired to it. Place 10 tables and the budget updates. Put a DJ booth down and "DJ" appears on your vendor checklist. Seat a guest and they get a "find my seat" link. An **AI co-planner (Groq, with Gemini as fallback)** can edit the plan for you in plain words.

| Challenge requirement | Where it lives |
|---|---|
| Budgets | Linked budget: blueprint rentals + guest-driven catering + vendor quotes, payment reminders, AI optimizer with one-click apply |
| Timelines | Planning countdown (auto-compressed to your date) + minute-by-minute run of show tied to blueprint spots and vendors |
| Vendor checklists | Auto checklist from event type **and** placed items, drag-and-drop status board, zone assignment, AI enquiry drafts |
| Personalized ideas | Themes with palettes, games, regional menus by dietary mix, favours, hashtags, plus a writer for invites, speeches and WhatsApp reminders (English/Tamil/Hindi) |

## Features

- **One-prompt plan**: describe the event in one line; AI drafts the type, date, city, budget split, venue and blueprint
- **Blueprint Studio**: drag-and-drop canvas (Konva) with 28 items, real feet, zones, rotate/resize, undo/redo, keyboard shortcuts
- **AI auto-layout**: the AI picks *what* goes in the room; a deterministic engine places it with 3 ft aisles, exit clearance and capacity rules (it never invents coordinates)
- **Live safety checks**: overlaps, tight aisles, exit count and blockage, crowding, accessibility, scored 0–100
- **Layout versions**: Plan A vs Plan B (e.g. rain backup), compared side by side
- **Seat-level guest map**: click a guest, click a seat (occupied seats swap); CSV import
- **Smart seating**: families together, VIPs near the stage, wheelchair users near doors, kids near the kids zone, plus plain-language rules ("keep Ravi and Suresh apart") parsed by AI
- **Find-my-seat links**: a mini map with the guest's table highlighted; data rides in the URL hash (never sent to a server) and holds only that guest's name
- **Public seat booking**: BookMyShow-style attendee page with VIP/general pricing and a QR ticket
- **Live mode**: event clock (simulate the day), check-ins by seat, late-vendor alerts
- **PDF export**: blueprint, run of show, budget, vendors, seating chart, open tasks

## How the AI works

```
Browser ──► /api/ai/*  ──► Groq  openai/gpt-oss-120b   (primary)
                       └─► Gemini gemini-3.5-flash      (automatic fallback)
                       └─► built-in offline generators  (no key, or both fail)
```

- Structured output (zod schemas) for plans, layouts, seating rules, ideas and budget advice
- The co-planner chat streams with **client-side tools** (`add_items`, `move_item`, `auto_seat`, `set_allocation`, …). The browser executes them against the local plan, so the canvas changes while the AI is talking, and **Ctrl+Z** undoes any AI change.
- API keys stay on the server; the browser never sees them.
- Groq's free tier allows about **8,000 tokens per minute** for `gpt-oss-120b`. When Groq rejects a call (rate limit or outage), the same request switches to Gemini immediately instead of waiting. Adding `GOOGLE_GENERATIVE_AI_API_KEY` is strongly recommended for live demos.

## Run locally

```bash
npm install
cp .env.example .env.local   # then paste your GROQ_API_KEY (free: https://console.groq.com/keys)
npm run dev                  # http://localhost:3000
npm test                     # engine unit tests (layout, seating, budget, safety, links)
```

No key? Everything still works with the built-in generators; only the chat co-planner needs a key.

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel link
vercel env add GROQ_API_KEY production
vercel --prod
```

Optional: `GOOGLE_GENERATIVE_AI_API_KEY` for the Gemini fallback, `GROQ_MODEL` / `GEMINI_MODEL` to override models.

## Data & limits (demo build)

Plans are stored in the browser (**IndexedDB**) and synced live between tabs with `BroadcastChannel`. That means:

- Plans stay on the device that created them (use a second **tab** to demo bookings and check-ins syncing live).
- Find-my-seat links work on any device, because the data is inside the link.
- Real multi-device booking would need a shared database. The store is isolated in `src/lib/store.ts` for that swap.

## 3-minute demo script

1. Home → **💍 Wedding reception** demo → Overview (countdown, linked budget, safety score)
2. **Blueprint**: drag a photo booth in; watch rentals and the vendor hints update; push a table into another to see the red safety warning; **Compare** Plan A vs Plan B
3. **Guests**: click a guest, then a seat; **Auto-seat** with "seat the Temple committee near the stage and keep the Pillai family and Nair family at different tables"
4. **Budget** → **Find savings** → **Apply to plan** (tables removed from the blueprint)
5. **AI co-planner**: "Move the DJ booth away from the VIP tables" (the canvas updates live)
6. Home → **🪔 Diwali community night** → **Share & booking** → open the booking page in a new tab, book seats, see them appear in the host tab
7. **Live mode**: drag the event clock; **Export PDF**

## Engineering quality

| Area | What's in place |
|---|---|
| **Testing** | 60 Vitest tests in 9 suites: layout/seating/budget engine, safety rules, API routes (validation, rate limits, offline fallbacks), request guard and AI cache, store undo/redo, every co-planner tool, and React components in jsdom. `npm run test:coverage` prints coverage; CI runs it on every push. |
| **Security** | Every AI route goes through `src/lib/ai/guard.ts`: same-origin check, per-IP rate limit, body-size cap, and zod schema validation (`src/lib/ai/requests.ts`). API keys live only in `server-only` modules. Prompts fence user text and tell the model to treat it as data. CSP, `X-Frame-Options`, `nosniff`, Referrer and Permissions policies in `next.config.ts`. Model output is rendered as text, never HTML. Production dependencies audit clean. |
| **Accessibility** | Skip link and landmarks; every form label wraps its control; seat assignment and seat booking both have keyboard/screen-reader paths alongside the canvas; the canvas exposes a text summary and item list; Studio items are selectable from a list and nudgeable with arrow keys; keyboard drag-and-drop on the vendor board; the closed co-planner panel is `inert`, its log is a live region; honours `prefers-reduced-motion`. |
| **Efficiency** | Canvas items are memoised (editing one table redraws one table); Konva and Recharts load on demand; IndexedDB writes are debounced; validation/budget work is memoised per change; identical AI requests are cached for 10 minutes; chat context is compacted for Groq's 8k tokens/min free tier. |
| **Code quality** | Strict TypeScript, ESLint with zero warnings, pure engine functions separated from UI, shared actions used by both the UI and the AI tools, CI workflow (`.github/workflows/ci.yml`) running lint, type-check, tests, audit and build. |

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · react-konva · Zustand + immer · AI SDK 7 (`@ai-sdk/groq`, `@ai-sdk/google`) · Recharts · dnd-kit · Vitest

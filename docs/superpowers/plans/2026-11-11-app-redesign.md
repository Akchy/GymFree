# GymFree Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure GymFree into Home · History · Plan · Exercises with a bottom tab bar / left sidebar, a bold-dark look (plus light), one History page (Workouts | Stats) with editable past workouts, a volume-per-session chart, and "Continue this workout" — leaving Workout mode's look unchanged.

**Architecture:** Plain TypeScript + the `h`/`svg` DOM helper, hash routing in `src/ui/app.ts`. New pure helpers live in `src/core/history.ts`; one shared set-editor component (`src/ui/set-editor.ts`) powers both the entry screen (`/log/<dayId>`) and the workout edit view. History views live in `src/ui/views/history.ts`; the old Progress view becomes the History › Stats section. Theme tokens in `src/styles.css` are replaced; Workout mode's `.reel` gets its own frozen copy of today's tokens.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5 + jsdom, Playwright 1.63, Supabase JS (sync unchanged apart from merge).

**Spec:** `docs/superpowers/specs/2026-11-11-app-redesign-design.md` (read it first; this plan argues from it).

## Global Constraints

- Workout mode (`src/ui/views/workout.ts`, `.reel*` CSS) must look and behave as today, except: save goes to History, and drafts with `editingId` update instead of add (Task 9).
- No new runtime dependencies; no framework.
- Theme stays CSS custom properties on `:root`, with `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` and `:root[data-theme='dark']` / `[data-theme='light']` exactly as `src/styles.css` structures them now; the Settings theme switch (`setTheme`) keeps working.
- Bold-dark tokens (dark): `--bg #0b0b0c`, `--surface #161618`, `--text #f2f2f2`, `--accent #c8f169`, `--accent-text #0b0b0c`. Light theme: builder picks values, but `--accent` used as text/fill on `--bg` must reach WCAG contrast ≥ 4.5:1 for text use (enforced by test in Task 3).
- Headings and big numbers: `font-weight: 800`, `letter-spacing: -0.03em`. Radius 12–18px, few borders.
- Nav: four items **Home `/`**, **History `/history`**, **Plan `/plan`**, **Exercises `/exercises`**; Settings is a gear on Home (phones) and pinned at the sidebar bottom (wide). Breakpoint: bottom bar `< 768px`, sidebar `≥ 768px`. Tap targets ≥ 44px. No horizontal scroll at 360px width.
- Routes: `/history` (Workouts), `/history?view=stats` (Stats), `/history/<id>` (detail), `/history/<id>/edit` (edit), `/log/<dayId>` and `/log/free` (entry screen). Redirects: `/progress` → `/history?view=stats`; `/log` (no day) → `/`.
- Every created/edited workout gets `updatedAt` (ISO string). Deletes still push to `deletedWorkoutIds`.
- Run `npm run typecheck` and `npm test` green at the end of every task; `npm run test:e2e` at the end of Task 10.
- The working tree had uncommitted user changes before this plan; commit only the files each task lists.

## Review Focus

1. **Pounds users editing a workout** — opening an lb workout and saving without touching a weight must keep the stored kg exactly (no lb→kg rounding drift). Test in Task 4.
2. **Sync arriving mid-edit** — newer data from another device while `/history/<id>/edit` is open must not wipe the user's unsaved edits (held back like the log form). Test in Task 7.
3. **Stale or deleted workout link** — `/history/<id>` or `/history/<id>/edit` for an id that no longer exists shows "Page not found"-style recovery, never a crash or blank page. Test in Task 7.
4. **Editing away every set** — saving an edit with no reps left must be refused with the same message as the entry screen, not save an empty workout (use Delete for that). Test in Task 7.
5. **Changing reps on a timed-in-workout-mode set** — the old `seconds` no longer describes the set, so it is dropped when reps change (and kept when untouched), keeping "seconds per rep" honest. Test in Task 4.

---

### Task 1: Workout `updatedAt`, merge by edit time, history helpers

**Files:**
- Modify: `src/core/types.ts` (`WorkoutLog`), `src/core/state.ts:157-172` (`workoutLog`), `src/core/merge.ts`
- Create: `src/core/history.ts`
- Test: `tests/unit/merge.test.ts`, `tests/unit/state.test.ts`, create `tests/unit/history.test.ts`

**Interfaces:**
- Produces:
  - `WorkoutLog.updatedAt?: string` (ISO timestamp; missing on old data).
  - `upsertWorkout(state: AppState, log: WorkoutLog, nowIso: string): void` — replaces the workout with `log.id` (or appends), setting `updatedAt = nowIso`; keeps `state.workouts` sorted by date then id.
  - `removeWorkout(state: AppState, id: string): void` — removes it and pushes `id` to `deletedWorkoutIds` (no duplicate ids).
  - `interface WeekGroup { weekStart: string; label: string; workouts: WorkoutLog[] }`
  - `groupByWeek(workouts: readonly WorkoutLog[], today: string): WeekGroup[]` — newest week first, workouts newest first within a week (date desc, then `updatedAt` desc); labels `"This week"`, `"Last week"`, else `"Week of <D Mon>"` e.g. `"Week of 12 Oct"`. Weeks start Monday (`startOfWeek`).

- [ ] **Step 1: Write failing tests**

```ts
// merge.test.ts
it('keeps the more recently edited copy of a workout, whichever device saved last', () => {
  const base = onboardedState();
  const w = { id: 'w1', date: '2026-10-26', dayId: null, entries: [{ exerciseId: 'push-up', sets: [{ reps: 10, weightKg: 0 }] }], durationMin: 30, notes: '' };
  const a = structuredClone(base); a.workouts = [{ ...w, notes: 'edited', updatedAt: '2026-10-27T10:00:00.000Z' }];
  const b = structuredClone(base); b.workouts = [{ ...w, updatedAt: '2026-10-26T18:00:00.000Z' }];
  const merged = mergeVersions({ state: a, updatedAt: '2026-10-27T10:00:01.000Z' }, { state: b, updatedAt: '2026-10-27T11:00:00.000Z' });
  expect(merged.workouts[0].notes).toBe('edited');
});
it('treats a workout without updatedAt as oldest, and falls back to the newer version on a tie', ...);
// state.test.ts
it('keeps a valid updatedAt and drops an invalid one', () => {
  expect(workoutLog({ id: 'a', date: '2026-10-01', entries: [], updatedAt: '2026-10-01T00:00:00.000Z' })?.updatedAt).toBe('2026-10-01T00:00:00.000Z');
  expect(workoutLog({ id: 'a', date: '2026-10-01', entries: [], updatedAt: 'nope' })).not.toHaveProperty('updatedAt');
});
// history.test.ts
it('upsertWorkout replaces by id and stamps updatedAt'); // workouts.length unchanged, notes replaced, updatedAt === nowIso
it('upsertWorkout appends a new workout in date order');
it('removeWorkout records the id once'); // call twice → deletedWorkoutIds equals ['w1']
it('groupByWeek labels this week, last week and older weeks', () => {
  // today '2026-10-27' (Tue): 2026-10-26 → "This week", 2026-10-20 → "Last week", 2026-10-13 → "Week of 12 Oct"
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/merge.test.ts tests/unit/state.test.ts tests/unit/history.test.ts` — expect FAIL (missing module / property).
- [ ] **Step 3: Implement.** In `workoutLog`, include `updatedAt` only when `typeof v.updatedAt === 'string' && !Number.isNaN(Date.parse(v.updatedAt))`. In `mergeVersions`, when both versions hold the same id, keep the copy with the larger `Date.parse(updatedAt)` (missing → `-Infinity`); on a tie keep `newer`'s copy. Update the header comment. Write `src/core/history.ts`.
- [ ] **Step 4: Run** the same command — PASS; then `npm run typecheck && npm test`.
- [ ] **Step 5: Commit** `git add src/core/types.ts src/core/state.ts src/core/merge.ts src/core/history.ts tests/unit/merge.test.ts tests/unit/state.test.ts tests/unit/history.test.ts && git commit -m "feat: per-workout updatedAt, merge by edit time, history helpers"`

---

### Task 2: Volume-per-session series and bar chart

**Files:**
- Modify: `src/core/progress.ts`, `src/ui/chart.ts`
- Test: `tests/unit/progress.test.ts`, `tests/unit/dom-figure-chart.test.ts`

**Interfaces:**
- Produces:
  - `type VolumeUnit = 'kg' | 'reps' | 's'`
  - `sessionVolumeSeries(workouts: readonly WorkoutLog[], exerciseId: string): { unit: VolumeUnit; points: SeriesPoint[] }` — one point per workout containing the exercise, date ascending. Timed exercise → `'s'`, sum of set amounts (`reps` field). Otherwise if any logged set of this exercise anywhere has `weightKg > 0` → `'kg'`, sum of `reps × weightKg` (bodyweight sets contribute 0 in a weighted series — builder's mixed-weight call, documented in a comment). Otherwise `'reps'`, sum of reps. Values rounded to 1 decimal.
  - `barChart(series: readonly SeriesPoint[], label: string, unit = ''): HTMLElement` — `<figure class="chart-wrap">` with `<svg class="chart bars" role="img" aria-label=label>`, one `<rect class="bar">` per point (each with `<title>` `"<date>: <value><unit>"`), bars start at 0 (not min), caption `"Last: <value><unit> · Best: <max><unit>"`. Empty series → `<p class="muted">No data yet.</p>` like `lineChart`.

- [ ] **Step 1: Write failing tests** — `sessionVolumeSeries` for: bench 3×(10×40) → `{unit:'kg', points:[{value:1200}]}`; push-ups 15+12 → `{unit:'reps', value:27}`; plank (timed) 60+45 → `{unit:'s', value:105}`; exercise absent in a workout → no point for it. `barChart` with 3 points → 3 `rect.bar`, tallest rect is the max value, caption `'Last: 30 kg · Best: 40 kg'` for unit `' kg'`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/progress.test.ts tests/unit/dom-figure-chart.test.ts` — FAIL.
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run** — PASS; `npm run typecheck && npm test`.
- [ ] **Step 5: Commit** `feat: volume-per-session series and bar chart`.

---

### Task 3: Bold-dark palette, light theme, frozen Workout-mode colours

**Files:**
- Modify: `src/styles.css` (token blocks lines 1–60; `.reel` block ~line 435)
- Test: create `tests/unit/theme-contrast.test.ts`

**Interfaces:**
- Produces: tokens `--bg --surface --surface-2 --text --muted --border --accent --accent-text --accent-soft --danger --figure --prop` (adds `--surface-2` for wheel/inputs on surfaces), plus `--font-heavy: 800`. Later tasks style with these only.

- [ ] **Step 1: Write failing test** — read `src/styles.css` with `fs`, extract the hex values of `--bg`, `--text`, `--accent`, `--accent-text`, `--muted` from (a) the first `:root {` block (light) and (b) the `:root[data-theme='dark']` block; assert dark `--bg` is `#0b0b0c` and `--accent` is `#c8f169`; for both themes assert contrast(text,bg) ≥ 7, contrast(muted,bg) ≥ 4.5, contrast(accent,bg) ≥ 3 (fills/large numbers) and contrast(accent-text,accent) ≥ 4.5. Also assert the `.reel {` rule declares `--accent: #0f766e` and `--surface: #ffffff` (today's light values) and that a dark-scheme `.reel` override declares `--accent: #2dd4bf` and `--surface: #181c21`. Include a 10-line WCAG relative-luminance helper in the test.
- [ ] **Step 2: Run** `npx vitest run tests/unit/theme-contrast.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Replace the three token blocks with bold-dark (dark) and a light counterpart (suggestion: `--bg #f4f4f1`, `--surface #ffffff`, `--text #0b0b0c`, `--accent #4d7c0f`, `--accent-text #ffffff` — adjust until the test passes). Set `body` font weights/letter-spacing for `h1`, `.stat-value`. Add to `.reel` (and the two dark selectors scoped as `.reel`) the old token values copied verbatim from today's file, so Workout mode renders identically.
- [ ] **Step 4: Run** — PASS; `npm test`. Then `npm run dev`, open `/#/workout/<day>` at 390×844 in a browser and compare against a screenshot taken before this task — Workout mode identical.
- [ ] **Step 5: Commit** `feat: bold-dark palette with light theme; freeze workout mode colours`.

---

### Task 4: Shared set editor (wheel rows)

**Files:**
- Create: `src/ui/set-editor.ts`
- Modify: `src/ui/views/log.ts` (move `DraftSet`/`DraftEntry` types out; import from set-editor)
- Test: create `tests/unit/set-editor.test.ts`

**Interfaces:**
- Consumes: `numberWheel(input, step)` from `src/ui/number-wheel.ts`; `lastWeight` from `log.ts`; `toDisplayWeight/fromDisplayWeight/round` from units.
- Produces:
  - `export interface DraftSet { reps: number | null; weightKg: number | null; seconds?: number }`
  - `export interface DraftEntry { exerciseId: string; target: PlannedExercise | null; sets: DraftSet[] }`
  - `renderSetEditor(opts: { entries: DraftEntry[]; units: 'kg' | 'lb'; workouts: readonly WorkoutLog[]; animate: boolean; onChange: () => void }): HTMLElement` — mutates `opts.entries` in place and calls `onChange` after every change. Layout per exercise (`section.set-group`): name + target line + an `ⓘ` toggle button (`aria-expanded`, `aria-label="How to do <name>"`) revealing demo + steps lazily (reuse current `renderDemo`/`renderHowTo` code); then one row per set: `<index> [reps wheel] × [weight wheel] [✕ remove]` (remove hidden when only one set); "+ Add set" (copies previous reps/weight, not seconds); "Remove exercise"; and after all groups a `select` "+ Add exercise…" (same CORE/all behaviour as today). Wheel steps: reps 1, weight 2.5 kg / 5 lb; timed exercises label the first wheel "Seconds". Weight input placeholder = last weight, like today.
  - Rules: a set's `weightKg` is rewritten only on user input to the weight wheel; a user change to reps deletes that set's `seconds`.

- [ ] **Step 1: Write failing tests**

```ts
it('renders a row of wheels per set and adds/removes sets and exercises', ...); // counts of .set-row, onChange calls
it('keeps stored kg exactly when a pounds user does not touch the weight', () => {
  const entries = [{ exerciseId: 'barbell-bench-press', target: null, sets: [{ reps: 10, weightKg: 40 }] }];
  renderSetEditor({ entries, units: 'lb', workouts: [], animate: false, onChange: () => {} });
  expect(entries[0].sets[0].weightKg).toBe(40);
});
it('drops seconds when reps change and keeps them otherwise', () => {
  // set { reps: 10, weightKg: 40, seconds: 30 }: change weight → seconds still 30; change reps to 8 → seconds undefined
});
it('opens how-to only when the info button is pressed', ...); // .how-to empty until click; aria-expanded toggles
```
(Use real exercise ids from `src/data/exercises.ts`; check with `grep "id: '" src/data/exercises.ts | head`.)
- [ ] **Step 2: Run** `npx vitest run tests/unit/set-editor.test.ts` — FAIL.
- [ ] **Step 3: Implement** `renderSetEditor`, lifting the row/table code out of `renderLogForm` (`log.ts:232-318`) into the new compact layout; `log.ts` keeps working by calling it (its form otherwise unchanged in this task).
- [ ] **Step 4: Run** — PASS; `npm run typecheck && npm test` (existing log tests may need selector updates only; behaviour must stay).
- [ ] **Step 5: Commit** `feat: shared wheel-row set editor`.

---

### Task 5: Entry screen replaces the Log form; `/log` picker removed

**Files:**
- Modify: `src/ui/views/log.ts` (`renderLogForm`; delete `renderLogPicker`), `src/ui/app.ts` (routes), `src/ui/views/log.ts` `WorkoutDraft`/`readDraft`
- Test: `tests/unit/views.test.ts` (`describe('workout logging')`), `tests/unit/app.test.ts`

**Interfaces:**
- Consumes: `renderSetEditor`, `DraftEntry` (Task 4); `upsertWorkout` (Task 1).
- Produces:
  - `WorkoutDraft.editingId?: string` — when set, saving updates that workout (same id, keeps the draft's date) instead of adding. `readDraft` keeps it only if it is a string matching `cleanId` rules, and the entry screen's `persistDraft` must carry it forward when it rewrites the draft.
  - Entry screen layout (top to bottom): title (day label + name, or "Free workout"); timer row (existing clock); date + duration row; `renderSetEditor`; notes; error; **Save workout** button. Remove the long instruction paragraph; keep the "Picked up your unsaved workout" note + discard link and the phone-only "Switch to workout mode" link.
  - Save: builds the log, `ctx.update(s => upsertWorkout(s, log, new Date().toISOString()))`, clears the draft, toasts `'Workout saved. Nice job!'`, navigates to `/history`.
  - Routes: `/log` → `navigate('/')`; `/log/<dayId>` unchanged.

- [ ] **Step 1: Update/write failing tests** — replace "lists plan days and a free workout option" with `'/log redirects home'`; `'saving goes to History and stamps updatedAt'` (navigate called with `'/history'`, saved workout has `updatedAt`); `'a draft with editingId updates that workout instead of adding one'` (state has w1; draft `{...editingId:'w1'}`; save → `workouts.length` unchanged, entries replaced, date kept); `readDraft` keeps a valid `editingId` and drops `{editingId: 5}`. Update app.test route table (`['/log', ...]` row becomes a redirect expectation).
- [ ] **Step 2: Run** `npx vitest run tests/unit/views.test.ts tests/unit/app.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; `npm run typecheck && npm test`.
- [ ] **Step 5: Commit** `feat: compact entry screen; drop log picker`.

---

### Task 6: History page — Workouts | Stats

**Files:**
- Create: `src/ui/views/history.ts`
- Modify: `src/ui/views/progress.ts` (becomes `renderStats(ctx): HTMLElement` returning the stats sections without `<main>`/`h1`/history list; chart uses `sessionVolumeSeries` + `barChart`, keeping the "Seconds per rep" metric option), `src/ui/app.ts` (routes `/history`, `/progress` redirect), `src/ui/views/notfound.ts` and any other links to `/progress` or `/log` picker (`grep -rn "#/progress\|'/progress'\|#/log'" src`)
- Test: `tests/unit/views.test.ts` (`describe('progress')` → `describe('history')`), `tests/unit/app.test.ts`

**Interfaces:**
- Consumes: `groupByWeek` (Task 1), `sessionVolumeSeries`/`barChart` (Task 2).
- Produces: `renderHistory(ctx: ViewContext, view: 'workouts' | 'stats'): HTMLElement` — `<main class="container">` with `h1` "History", a segmented control (`div.segmented[role=tablist]` with two `a[role=tab]` links `#/history` and `#/history?view=stats`, `aria-selected`), then either:
  - Workouts: per `WeekGroup` a heading `"<label> · <n> workout(s)"` and rows `a.history-row[href="#/history/<id>"]` showing day name (plan day name, else "Free workout"), `"Mon 9 Nov"`-style date, duration `"48 min"` if known, and `"<n> ex"`. Batches of 20 via `createBatches` (keep long-history test). Empty: "No workouts yet." + link to Home.
  - Stats: `renderStats(ctx)`. Volume chart label `"<Exercise>: volume per session"`, units: `kg` series converted to display units (`toDisplayWeight`) with unit text `" kg"`/`" lb"`, `reps` → `" reps"`, `s` → `" s"`.
- Delete buttons leave the list (deleting moves to the detail page, Task 7).

- [ ] **Step 1: Write failing tests** — groups and row text for a 3-week fixture; tab links and `aria-selected`; stats view shows bars for an exercise (`rect.bar` count = sessions) and PRs/muscle/body-weight sections still present; long history still reachable in batches; `/progress` → `#/history?view=stats`; nav `aria-current` on History for `/history/abc`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/views.test.ts tests/unit/app.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; typecheck + full tests.
- [ ] **Step 5: Commit** `feat: History page with Workouts and Stats`.

---

### Task 7: Workout detail, edit and delete

**Files:**
- Modify: `src/ui/views/history.ts`, `src/ui/app.ts` (routes; extend `onLogForm()` regex to also match `^/history/[^/?]+/edit`)
- Test: `tests/unit/views.test.ts`, `tests/unit/app.test.ts`

**Interfaces:**
- Consumes: `renderSetEditor`/`DraftEntry` (Task 4), `draftToEntries` (log.ts), `upsertWorkout`/`removeWorkout` (Task 1).
- Produces:
  - `renderWorkoutDetail(ctx: ViewContext, id: string): HTMLElement` — back link `‹ History` (`#/history`), **Edit** link (`#/history/<id>/edit`), title (day name or "Free workout"), meta `"<Weekday D Mon> · <n> min"`, chips (`<n> exercises`, `<n> sets`, volume via `formatWeight`), one line per exercise: name + sets joined by `" · "` (`"10 × 40"`, bodyweight `"15"`, timed via `amountText`) + unit suffix; notes if any. A "Continue this workout" slot is added in Task 9.
  - `renderWorkoutEdit(ctx: ViewContext, id: string): HTMLElement` — `<form>` with top bar **Cancel** (link to `#/history/<id>`) and **Save** (submit); date (max today) and duration wheel (step 5); `renderSetEditor` on a deep copy of the entries (as `DraftEntry` with `target: null`); notes; error `p[role=alert]`; **Delete this workout** (`button.danger`, `confirm('Delete this workout? This can’t be undone.')` → `removeWorkout`, toast, navigate `/history`). Save validates: valid non-future date else `'Please choose a valid date (not in the future).'`; ≥1 set with reps else `'Enter the reps (or seconds) for at least one set before saving.'`; then `upsertWorkout` (same id) and navigate `/history/<id>`, toast `'Workout updated.'`.
  - Unknown id in either route → `renderNotFound({ path, hasData: true })`.

- [ ] **Step 1: Write failing tests** — detail shows lines/chips for a fixture; edit changes reps on a set and Save → state workout updated, `updatedAt` set, same id, `workouts.length` same; Cancel leaves state unchanged; removing all sets → error text above, no update call; delete after confirm → gone and id in `deletedWorkoutIds`; unknown id (`/history/nope`, `/history/nope/edit`) → not-found page; **sync mid-edit**: in app.test, open `/history/<id>/edit`, change a wheel, apply remote data via the FakeCloud/`applyRemote` path used by the existing "held back while logging" test (`grep -n "pendingRemote\|held" tests/unit/app.test.ts`) → the edited value is still on screen, and after Save the remote change and the edit are both present.
- [ ] **Step 2: Run** `npx vitest run tests/unit/views.test.ts tests/unit/app.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; typecheck + full tests.
- [ ] **Step 5: Commit** `feat: view, edit and delete past workouts`.

---

### Task 8: Navigation shell and Home

**Files:**
- Create: `src/ui/nav.ts`
- Modify: `src/ui/app.ts` (replace `nav()`/hamburger/theme button/`setMenuOpen` and `NAV`; render `renderNav` + view inside `div.shell`), `src/ui/views/dashboard.ts`, `src/styles.css` (remove `.topbar`/`.menu-toggle` rules; add `.appnav`, `.shell`, bottom bar with `padding-bottom: env(safe-area-inset-bottom)`, main content bottom padding so the bar never covers content)
- Test: `tests/unit/app.test.ts`, `tests/unit/views.test.ts` (`describe('dashboard')`)

**Interfaces:**
- Produces:
  - `NAV_ITEMS: readonly { href: '/' | '/history' | '/plan' | '/exercises'; label: string; icon: string }[]` (icons: inline SVG path strings, 24×24, `currentColor`).
  - `activeNav(path: string): string | null` — `'/'` for `/` and `/log...`, `'/history'` for `/history...` , `'/plan'` for `/plan...`, `'/exercises'` for `/exercises...`, `'/settings'` for `/settings`, else null.
  - `renderNav(path: string): HTMLElement` — `<nav class="appnav" aria-label="Main">`: brand `a.brand` "GymFree" (sidebar only), four `a` items with icon + label and `aria-current="page"` when active, and `a.nav-settings[href="#/settings"]` (sidebar only, CSS-hidden < 768px).
  - Workout mode (`.reel`) still renders with no nav.
  - Home (`renderDashboard`): header row with greeting `h1` + date line, and `a.settings-link[href="#/settings"][aria-label="Settings"]` gear (CSS-hidden ≥ 768px). Today card states per spec: training day → **Start workout** (`startWorkoutHref(day.id)`), in-progress badge if `ctx.repo.hasDraft(day.id)`; done today → "Done for today. Great work!"; rest day → "Rest day: recover well"; no plan → "Create a plan". Under Start (and on rest days) a `<details class="other-workouts">` with `<summary>Different workout</summary>` listing other plan days (`orderedDays`, each `a[href=startWorkoutHref(id)]` with in-progress badge) and `a[href="#/log/free"]` "Free workout". Stats as big numbers (existing three). Install card, spin wheel, nutrition, tips stay.

- [ ] **Step 1: Write failing tests** — app renders `nav.appnav` with exactly the four labels in order, no `.menu-toggle`, `aria-current` correct for `/`, `/log/free`, `/history/x`, `/plan/edit/x`; no nav on workout mode; dashboard has settings gear link; rest-day card still offers "Different workout" with every plan day + Free workout; in-progress badge appears for a day with a draft. Remove/replace hamburger tests in app.test.
- [ ] **Step 2: Run** `npx vitest run tests/unit/app.test.ts tests/unit/views.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; typecheck + full tests; `npm run dev` and check 360px (bottom bar, no sideways scroll) and 1280px (sidebar) in both themes.
- [ ] **Step 5: Commit** `feat: bottom tab bar / sidebar navigation and new Home`.

---

### Task 9: Continue this workout

**Files:**
- Modify: `src/ui/views/history.ts` (detail button), `src/ui/views/workout.ts` (save path only)
- Test: `tests/unit/workout.test.ts`, `tests/unit/views.test.ts`

**Interfaces:**
- Consumes: `WorkoutDraft.editingId` (Task 5), `upsertWorkout` (Task 1), `isPhone` (device.ts).
- Produces:
  - `canContinue(log: WorkoutLog, plan: readonly PlanDay[], today: string): boolean` (exported from history.ts) — `log.date === today && log.dayId !== null` and the plan day exists and every `log.entries[].exerciseId` is in that day's exercises.
  - `workoutToDraft(log: WorkoutLog): WorkoutDraft` — entries/sets copied, `date: log.date`, `durationMin: null`, `notes: log.notes`, `activeMs: (log.durationMin ?? 0) * 60_000`, `resumedAt: null`, `editingId: log.id`.
  - Detail page: when `isPhone() && canContinue(...)`, a `button.primary` "Continue this workout". On click: if `ctx.repo.hasDraft(dayId)` and that draft's `editingId !== log.id`, `confirm('Replace your unsaved session for this day?')` (cancel → nothing); then `ctx.repo.setDraft(dayId, workoutToDraft(log))` and `ctx.navigate('/workout/<dayId>')`.
  - Workout mode save: if `restored?.editingId` names an existing workout, `upsertWorkout` with that id and `restored.date` (not today), else today's add path, both via `upsertWorkout(s, log, new Date().toISOString())`; then navigate `/history` (instead of `/progress`). Workout mode's `persist()` must copy `restored?.editingId` into every draft it writes, or the link is lost on the first set. No visual change to workout mode.

- [ ] **Step 1: Write failing tests** — `canContinue` true/false cases (other date, free workout, missing day, extra exercise); detail shows the button only on phone (`matchMedia` stub as existing workout tests do) and only when `canContinue`; click with a clashing draft + confirm false → draft untouched; confirm true → draft replaced and navigate `/workout/<day>`; workout mode with an `editingId` draft → save keeps `workouts.length`, same id, combined sets, `durationMin` ≥ old duration; logging a set keeps `editingId` in the stored draft; workout mode normal save navigates to `/history`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/workout.test.ts tests/unit/views.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; typecheck + full tests.
- [ ] **Step 5: Commit** `feat: continue a workout saved today`.

---

### Task 10: Restyle remaining pages, e2e, housekeeping

**Files:**
- Modify: `src/styles.css` (cards, buttons, inputs, choice groups, plan/exercises/settings/welcome/onboarding/not-found to the new tokens and heavy type; segmented control, history rows, set-editor rows, detail chips), `tests/e2e/app.spec.ts`, `.gitignore` (add `.superpowers/`), `README.md`/`docs/DEVELOPMENT.md` only if they name Log/Progress pages (`grep -n "Progress\|Log a workout" README.md docs/DEVELOPMENT.md`).
- Test: `tests/e2e/app.spec.ts`

- [ ] **Step 1: Update e2e** — "edit the plan… then log a workout set by set" ends on History and the workout row is visible; replace "header fits the screen: menu reachable" with "bottom bar fits at 360px, no sideways scroll, each tab reachable" and "sidebar shows at 1280px"; add "edit a past workout": open History → row → Edit → change reps wheel → Save → detail shows new value; existing workout-mode swipe test unchanged and must pass untouched.
- [ ] **Step 2: Run** `npm run test:e2e` — new/changed tests FAIL where styling/flows are missing.
- [ ] **Step 3: Restyle** remaining pages with the tokens from Task 3 (no structural changes to Plan, Exercises, Settings, onboarding, welcome).
- [ ] **Step 4: Run** `npm run typecheck && npm test && npm run test:e2e && npm run build` — all PASS. Manually check light + dark at 390×844 and 1280×800: Home, History (both tabs), detail, edit, entry screen, Plan, Exercises, Settings, onboarding; and Workout mode identical to before.
- [ ] **Step 5: Commit** `feat: restyle remaining pages; e2e for new navigation and editing`.

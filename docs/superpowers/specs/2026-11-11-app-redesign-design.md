# GymFree redesign: simpler structure, bold-dark look

Date: 2026-11-11
Status: draft for approval

## Why

The app works, but it's harder to use than it should be:

- **Log is cluttered.** One form holds instructions, a timer, date, duration, a demo and "How to do it" for every exercise, full set tables, an add-exercise dropdown and notes.
- **Progress overlaps with Log.** Log is for entering workouts, while Progress holds the history plus charts. Users don't know where to go to see "what have I done and when."
- **Saved workouts can't be edited.** One accidental save mid-workout means logging the whole thing again as a duplicate.
- **The exercise chart feels flat.** It plots weight, so training at the same weight for weeks draws a long horizontal line that doesn't feel like progress.
- **The menu is in the wrong place.** The top-right hamburger feels dated. Current apps use a bottom bar on phones (WhatsApp, Telegram) or a left sidebar on bigger screens.

The user asked for a design that is simple and elegant, with a simple page structure.

## Goals

1. A new page structure: **Home · History · Plan · Exercises**, with Settings behind a gear.
2. Navigation as a **bottom tab bar on phones** and a **left sidebar on bigger screens**.
3. A new visual style, **bold dark**, with a matching light theme.
4. One **History** page that replaces both Log and Progress.
5. **Past workouts can be edited and deleted.**
6. The exercise chart shows **volume per session**, not weight.
7. A single compact way to enter sets, used both for logging and for editing.

## Non-goals

- **Workout mode (`src/ui/views/workout.ts`, the full-screen phone reel) is unchanged.** The user likes it as it is. It keeps its current look and behaviour, and still has no navigation bar.
- Plan, Exercises, Settings and the welcome/onboarding flow keep their content and behaviour. They only get the new visual style.
- No change to the data model's meaning, sync (Supabase) or storage, beyond what editing needs (the `updatedAt` field below).
- No new features beyond those listed here. The paused "share as image" idea is separate.

## Anti-goals (would count as failure even if it works)

- The new History or entry screen ends up as cluttered as the old Log form.
- Workout mode looks or behaves differently afterwards.
- A saved workout can be changed or deleted by accident (one stray tap).
- The light theme is an afterthought, with unreadable lime-on-white text, for example.

## Decisions made with the user

### Navigation

- Four destinations: **Home, History, Plan, Exercises.**
- **Phone:** a fixed bottom tab bar with an icon and label for each. The active tab uses the accent colour.
- **Bigger screens:** the same four items in a left sidebar, with the "GymFree" brand at the top and **Settings** pinned at the bottom.
- **Settings on phones:** a gear icon at the top right of Home.
- The top bar and hamburger menu are removed.
- The user considered and rejected a big centre "Start" button in the tab bar. Starting a workout is a button on Home (see below).

### Visual style: "bold dark"

- A near-black background (about `#0b0b0c`), slightly lighter surfaces for cards and rows (about `#161618`), and off-white text.
- **One bright lime accent** (about `#c8f169`), used for the active tab, primary buttons, key numbers and chart marks.
- **Big, heavy headings and numbers** (800 weight, tight letter-spacing). Stats are shown as large numbers with small muted labels.
- Rounded surfaces (12–18px radius) and few borders.
- **A light theme is required**, and the existing light/dark/system switch in Settings keeps working. Builder's call: light theme colours, with the constraint that the accent stays readable on a light background (for example a darker olive/lime for text and fills, or lime fills with dark text).
- Keep the theme as CSS custom properties on `:root`, the way `src/styles.css` does now, and replace the current teal palette.

The mockups for reference are in `.superpowers/brainstorm/*/content/style.html` (option 3), `history.html` and `edit.html`.

### Home

- Greeting and date at the top, with a gear for Settings on phones.
- A **Today card**:
  - **Training day:** the day name, the number of exercises, an estimated time, and a big **Start workout** button. On a phone it opens Workout mode for that day. On a laptop it opens the entry screen (below).
  - Under the button, a small **"Different workout"** link opens a short list of the other plan days plus **Free workout**. *(My call: the user rarely does this but might, so it's available without being prominent.)*
  - **Rest day:** says it's a rest day and still shows "Different workout".
  - **Done today:** keeps today's "Done for today" message.
  - **No plan:** "Create a plan," as today.
  - If an unsaved draft exists for a day, show that it's in progress, as the Log picker does now.
- Quick stats (workouts this week, week streak, total workouts) as big numbers.
- *(My call:)* the other existing Home content (install prompt, spin wheel, nutrition estimate, tips) stays, restyled.

### History (replaces Log and Progress)

A segmented switch at the top: **Workouts | Stats**.

**Workouts:**
- Past workouts newest first, **grouped by week** ("This week · 3 workouts", "Last week · …").
- Each row shows the day name (or "Free workout"), date, duration and number of exercises.
- Tapping a row opens the **workout detail** (below).

**Stats** holds everything else that's on Progress today:
- The per-exercise chart, now **volume per session** (sum of reps × weight across the exercise's sets in that workout), drawn as bars, one per session. The user chose this over a running total and a calendar.
  - *(My call:)* bodyweight exercises with no weight chart **reps per session**. Timed exercises chart **total seconds per session**. The existing "seconds per rep" pace option can stay as a second metric where it applies.
- Personal records.
- Sets per muscle group (last 30 days).
- Body weight entry and chart.

### Workout detail and editing (user chose "read first, then Edit")

- **Read view** (opened from History): day name, date, duration, totals (exercises, sets, volume), then one compact line per exercise listing its sets ("10 × 40 · 10 × 40 · 8 × 40 kg"). Notes are shown if present. A back link returns to History, and an **Edit** button sits at the top right.
- **Edit view:** **Cancel** and **Save** at the top. You can edit the date and duration. Each exercise shows its sets as compact rows of **reps × weight using the existing scroll-wheel number pickers** (`src/ui/number-wheel.ts`); the user asked specifically for wheel style. You can also remove a set, add a set, remove an exercise, add an exercise, and edit notes. **Delete this workout** goes at the bottom with a confirmation.
- Nothing changes until Save. Cancel discards the edits.
- **"Continue this workout"** (confirmed by the user) lets an accidental save be finished instead of logged again:
  - **When it shows:** on a phone, in the read view of a workout that was **saved today** and has a plan day (`dayId`). It doesn't show for older workouts or free workouts.
  - **What it does:** reopens the workout in Workout mode with its logged sets filled in. The timer resumes from the saved duration.
  - **Unsaved session already open:** if an unsaved draft already exists for that day, ask first ("Replace your unsaved session?") before overwriting it.
  - **Exercises not in the plan:** *(my call)* if the saved workout has exercises that aren't in the current plan day, or the plan day no longer exists, hide the button and leave editing to the edit view, so Workout mode doesn't need to show extra cards.
  - **Saving:** Workout mode **updates that workout** (same `id`, date unchanged) instead of creating a new one, then goes to History.
  - **Look:** Workout mode's appearance and its normal flow stay as they are. Only its draft-loading and save code change to support this.

### Entry screen (replaces the old Log form)

Used for a free workout, and for any workout on a laptop, where Workout mode isn't available:

- It reuses the **edit view's layout**: compact wheel rows, Add set / Add exercise, and Save at the bottom, plus the existing timer at the top and an editable date and duration.
- The "How to do it" demo and steps move behind a small ⓘ on each exercise and stay closed by default. *(My call.)*
- Drafts keep working as now: unsaved progress is restored, with the option to discard it.
- After saving, go to History › Workouts. Today it goes to /progress.

## Constraints

- TypeScript plus the existing small DOM helper (`h`, `svg` in `src/ui/dom.ts`); no framework is added.
- Hash routing in `src/ui/app.ts`. The `/log` and `/progress` routes are replaced. Builder's call on the new route names (for example `/history`, `/history/<id>`, `/history/<id>/edit`), but **old `/log/...` and `/progress` links should redirect** sensibly, not land on "Page not found".
- Workouts sync to Supabase as one JSON blob per user, merged by `mergeVersions` (`src/core/merge.ts`). Today, when two devices have both changed, each workout is taken from whichever device saved most recently overall, so an edit on one device could be silently overwritten by an unrelated save on another. *(My call:)* add an `updatedAt` timestamp to `WorkoutLog`. It is set on create and on every edit, and the merge keeps the copy with the newer `updatedAt`. Old workouts without it count as oldest. Update `sanitizeState` and the merge/sync tests to match. Deletes keep using `deletedWorkoutIds`, so a deleted workout must not come back.
- Existing unit and e2e tests (`tests/unit`, `tests/e2e`) must be updated to match, and new behaviour (edit, delete, volume chart, nav) needs tests.
- Mobile first: no horizontal scroll at phone width, and tap targets of at least 44px.
- Accessibility as now: labelled controls, `aria-current` on the active nav item, keyboard reachable.

## Left to the builder

- How mixed-weight sessions add up in the volume chart, whether a timed set keeps its `seconds` after editing, and which nav item is active on sub-routes (for example, a workout detail highlights History).

- Exact light-theme palette, icons for the tab bar, spacing and type scale.
- Breakpoint for switching between the bottom bar and the sidebar.
- Route names and how redirects are done.
- How the edit view is structured in code, and whether the entry screen and edit view share one component. Sharing is preferred.
- Chart implementation details. The existing chart code can be adapted.

## Housekeeping

- Add `.superpowers/` to `.gitignore` (mockups live there).

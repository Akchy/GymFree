import { randomId } from '../../core/encoding';
import { isISODate, parseISODate, weekdayOf } from '../../core/dates';
import { editedDuration, groupByWeek, removeWorkout, saveWorkout } from '../../core/history';
import { minutesPerExercise } from '../../core/planner';
import { workingSeconds, workoutVolume } from '../../core/progress';
import { cleanText, MAX_NOTES } from '../../core/state';
import { WEEKDAY_NAMES, type PlanDay, type WorkoutLog } from '../../core/types';
import { toDisplayWeight, formatWeight } from '../../core/units';
import { amountText, durationText, getExercise, isTimed } from '../../data/exercises';
import { createBatches } from '../batches';
import type { ViewContext } from '../context';
import { isPhone, startWorkoutHref } from '../device';
import { h, svg } from '../dom';
import { NAV_ITEMS } from '../nav';
import { renderSetEditor, type DraftEntry } from '../set-editor';
import { nextPlanDay, otherWorkouts } from './dashboard';
import { draftToEntries, readDraft, type WorkoutDraft } from './log';
import { renderNotFound } from './notfound';
import { renderStats } from './progress';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 9 Nov". */
function dateText(iso: string): string {
  const d = parseISODate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The History page: a list of workouts by week, or the Stats tab. */
export function renderHistory(ctx: ViewContext, view: 'workouts' | 'stats'): HTMLElement {
  const tab = (href: string, label: string, current: boolean) =>
    h('a', current ? { href, 'aria-current': 'true' } : { href }, label);
  return h(
    'main',
    { class: 'container' },
    h('h1', {}, 'History'),
    h(
      'nav',
      { class: 'segmented', 'aria-label': 'History view' },
      tab('#/history', 'Workouts', view === 'workouts'),
      tab('#/history?view=stats', 'Stats', view === 'stats'),
    ),
    view === 'stats' ? renderStats(ctx) : workoutList(ctx),
  );
}

/** A dumbbell, the same one as the Exercises tab. */
function dumbbell(): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', width: 36, height: 36, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svg('path', { d: NAV_ITEMS.find((i) => i.href === '/exercises')!.icon }),
  );
}

/** Shown instead of an empty list: the next plan day, ready to start. */
function firstWorkoutCard(ctx: ViewContext): HTMLElement {
  const next = nextPlanDay(ctx.state.plan, weekdayOf(ctx.today()));
  const parts: (HTMLElement | null)[] = [];
  if (!next) {
    parts.push(h('p', { class: 'muted' }, 'Make a weekly plan first, then start it from here.'), h('a', { href: '#/onboarding', class: 'button primary' }, 'Create a plan'));
  } else {
    const { day, inDays } = next;
    const minutes = Math.round(day.exercises.reduce((sum, pe) => sum + minutesPerExercise(pe), 0));
    const when = inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `On ${WEEKDAY_NAMES[day.weekday as number]}`;
    parts.push(
      h('p', { class: 'first-day' }, h('span', { class: 'muted' }, `${when} · `), h('strong', {}, day.name)),
      h('p', { class: 'muted' }, `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'} · ~${minutes} min`),
      h('a', { href: startWorkoutHref(day.id), class: 'button primary' }, 'Start workout'),
      otherWorkouts(ctx, day.id),
    );
  }
  return h(
    'section',
    { class: 'card first-workout', 'aria-labelledby': 'first-workout-title' },
    h('div', { class: 'first-icon' }, dumbbell()),
    h('h2', { id: 'first-workout-title' }, 'Your first workout is waiting'),
    h('p', { class: 'muted' }, 'Every workout you save shows up here, grouped by week.'),
    ...parts,
  );
}

function workoutList(ctx: ViewContext): HTMLElement {
  const { state } = ctx;
  if (!state.workouts.length) {
    return firstWorkoutCard(ctx);
  }
  const row = (w: WorkoutLog) => {
    const dayName = titleOf(ctx, w);
    return h(
      'a',
      { class: 'history-row', href: `#/history/${encodeURIComponent(w.id)}` },
      h('strong', {}, dayName),
      h('span', { class: 'muted' }, dateText(w.date)),
      w.durationMin ? h('span', { class: 'muted' }, `${w.durationMin} min`) : null,
      h('span', { class: 'muted' }, `${w.entries.length} ex`),
    );
  };
  // Batches count workouts; the first workout of each week brings that week's heading.
  const headings = new Map<string, string>();
  const flat: WorkoutLog[] = [];
  for (const g of groupByWeek(state.workouts, ctx.today())) {
    headings.set(g.workouts[0].id, `${g.label} · ${g.workouts.length} workout${g.workouts.length === 1 ? '' : 's'}`);
    flat.push(...g.workouts);
  }
  const list = h('div', { class: 'history-list' });
  const batches = createBatches(list, (w: WorkoutLog) => {
    const frag = document.createDocumentFragment();
    const heading = headings.get(w.id);
    if (heading) frag.append(h('h2', { class: 'history-week' }, heading));
    frag.append(row(w));
    return frag;
  }, 20);
  batches.show(flat);
  return h('div', {}, list, batches.more);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function titleOf(ctx: ViewContext, w: WorkoutLog): string {
  if (w.dayId === null) return 'Free workout';
  return ctx.state.plan.find((d) => d.id === w.dayId)?.name ?? 'Workout';
}

function notFound(id: string): HTMLElement {
  return renderNotFound({ path: `/history/${encodeURIComponent(id)}`, hasData: true });
}

/** One workout, read-only, with a link to edit it. */
export function renderWorkoutDetail(ctx: ViewContext, id: string): HTMLElement {
  const w = ctx.state.workouts.find((x) => x.id === id);
  if (!w) return notFound(id);
  const units = ctx.state.settings.units;
  const sets = w.entries.reduce((n, e) => n + e.sets.length, 0);
  /** Each set as a small pill: the amount, and underneath how long it took (if timed in workout mode). */
  const line = (e: WorkoutLog['entries'][number]) => {
    const ex = getExercise(e.exerciseId);
    const timed = isTimed(ex);
    const pill = (x: WorkoutLog['entries'][number]['sets'][number]) =>
      h(
        'span',
        { class: 'detail-set' },
        h('b', {}, timed ? amountText(ex, x.reps) : x.weightKg > 0 ? `${x.reps} × ${toDisplayWeight(x.weightKg, units)} ${units}` : `${x.reps} reps`),
        // A timed exercise's amount already is its time.
        !timed && x.seconds ? h('small', {}, `⏱ ${durationText(x.seconds)}`) : null,
      );
    return h('li', { class: 'detail-exercise' }, h('strong', {}, ex?.name ?? e.exerciseId), h('div', { class: 'detail-sets' }, ...e.sets.map(pill)));
  };
  const working = workingSeconds(w);
  const dayId = w.dayId;
  let resume: HTMLButtonElement | null = null;
  const planDay = ctx.state.plan.find((d) => d.id === dayId);
  if (dayId && planDay && isPhone() && canContinue(w, ctx.state.plan, ctx.today())) {
    resume = h('button', { type: 'button', class: 'primary' }, 'Continue this workout');
    resume.addEventListener('click', () => {
      const existing = readDraft(ctx.repo.draft(dayId));
      // Already continuing this very workout: keep the newer unsaved sets.
      if (existing?.editingId !== w.id) {
        if (ctx.repo.hasDraft(dayId) && !confirm('Replace your unsaved session?')) return;
        ctx.repo.setDraft(dayId, workoutToDraft(w, planDay));
      }
      ctx.navigate(`/workout/${dayId}`);
    });
  }
  return h(
    'main',
    { class: 'container' },
    h('div', { class: 'actions top-bar' }, h('a', { href: '#/history' }, '‹ History'), h('a', { href: `#/history/${encodeURIComponent(w.id)}/edit`, class: 'button secondary' }, 'Edit')),
    h('h1', {}, titleOf(ctx, w)),
    h('p', { class: 'muted detail-meta' }, w.durationMin ? `${dateText(w.date)} · ${w.durationMin} min` : dateText(w.date)),
    h('div', { class: 'chips' }, ...[plural(w.entries.length, 'exercise'), plural(sets, 'set'), workoutVolume(w) > 0 ? formatWeight(workoutVolume(w), units) : null, working ? `⏱ ${durationText(working)} working` : null].filter((t): t is string => t !== null).map((t) => h('span', { class: 'chip' }, t))),
    h('ul', { class: 'detail-list' }, ...w.entries.map(line)),
    w.notes ? h('p', { class: 'detail-notes' }, w.notes) : null,
    resume,
  );
}

/** Today's workout of a plan day whose exercises are all still in that day: workout mode can pick it up again. */
export function canContinue(log: WorkoutLog, plan: readonly PlanDay[], today: string): boolean {
  if (log.date !== today || log.dayId === null) return false;
  const day = plan.find((d) => d.id === log.dayId);
  return !!day && log.entries.every((e) => day.exercises.some((pe) => pe.exerciseId === e.exerciseId));
}

/** The workout as a draft that workout mode can carry on and save over the same workout. */
export function workoutToDraft(log: WorkoutLog, day: PlanDay): WorkoutDraft {
  const logged = new Set(log.entries.map((e) => e.exerciseId));
  const rest = day.exercises.filter((pe) => !logged.has(pe.exerciseId)).map((pe) => ({ exerciseId: pe.exerciseId, sets: [{ reps: null, weightKg: null }] }));
  return {
    entries: [...structuredClone(log.entries), ...rest],
    date: log.date,
    durationMin: null,
    notes: log.notes,
    activeMs: (log.durationMin ?? 0) * 60_000,
    resumedAt: null,
    editingId: log.id,
  };
}

/** Edit a past workout: the same wheels as the entry screen, on a copy that is only saved on Save. */
export function renderWorkoutEdit(ctx: ViewContext, id: string): HTMLElement {
  const w = ctx.state.workouts.find((x) => x.id === id);
  if (!w) return renderNotFound({ path: `/history/${encodeURIComponent(id)}/edit`, hasData: true });
  const back = `#/history/${encodeURIComponent(w.id)}`;
  const entries: DraftEntry[] = structuredClone(w.entries).map((e) => ({ exerciseId: e.exerciseId, target: null, sets: e.sets }));
  const date = h('input', { type: 'date', id: 'edit-date', value: w.date, max: ctx.today(), required: true });
  const notes = h('textarea', { id: 'edit-notes', maxlength: MAX_NOTES, rows: 2 }, w.notes);
  const editor = renderSetEditor({ entries, units: ctx.state.settings.units, workouts: ctx.state.workouts, animate: ctx.animate(), onChange: () => {}, showTime: true });
  const error = h('p', { class: 'error', role: 'alert' });
  const del = h('button', { type: 'button', class: 'danger' }, 'Delete this workout');
  del.addEventListener('click', async () => {
    if (!confirm('Delete this workout? This can’t be undone.')) return;
    await ctx.update((s) => removeWorkout(s, w.id), { render: false });
    ctx.toast('Workout deleted.');
    ctx.navigate('/history');
  });
  const form = h(
    'form',
    { class: 'container' },
    h('div', { class: 'actions' }, h('a', { href: back }, 'Cancel'), h('button', { type: 'submit', class: 'primary' }, 'Save')),
    h('h1', {}, titleOf(ctx, w)),
    h('div', { class: 'row' }, h('label', { for: 'edit-date' }, 'Date ', date)),
    h('p', { class: 'muted edit-hint' }, 'The workout’s duration is worked out from the set times.'),
    editor,
    h('div', { class: 'field' }, h('label', { for: 'edit-notes' }, 'Notes (optional)'), notes),
    error,
    del,
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const logged = draftToEntries(entries);
    if (!isISODate(date.value) || date.value > ctx.today()) return void (error.textContent = 'Please choose a valid date (not in the future).');
    if (!logged.length) return void (error.textContent = 'Enter the reps (or seconds) for at least one set before saving.');
    const log: WorkoutLog = {
      id: w.id,
      date: date.value,
      dayId: w.dayId,
      entries: logged,
      durationMin: editedDuration(w, logged),
      notes: cleanText(notes.value, MAX_NOTES),
    };
    let savedId = w.id;
    await ctx.update((s) => saveWorkout(s, log, new Date().toISOString(), true, () => (savedId = randomId(8))), { render: false });
    ctx.toast('Workout updated.');
    ctx.navigate(`/history/${encodeURIComponent(savedId)}`);
  });
  return h('main', {}, form);
}

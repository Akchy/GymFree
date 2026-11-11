import { randomId } from '../../core/encoding';
import { isISODate, parseISODate } from '../../core/dates';
import { groupByWeek, removeWorkout, saveWorkout } from '../../core/history';
import { workoutVolume } from '../../core/progress';
import { clampNumber, cleanText, MAX_NOTES } from '../../core/state';
import type { PlanDay, WorkoutLog } from '../../core/types';
import { toDisplayWeight, formatWeight } from '../../core/units';
import { amountText, getExercise, isTimed } from '../../data/exercises';
import { createBatches } from '../batches';
import type { ViewContext } from '../context';
import { isPhone } from '../device';
import { h } from '../dom';
import { numberWheel } from '../number-wheel';
import { renderSetEditor, type DraftEntry } from '../set-editor';
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
  const tab = (href: string, label: string, selected: boolean) =>
    h('a', { href, role: 'tab', 'aria-selected': String(selected) }, label);
  return h(
    'main',
    { class: 'container' },
    h('h1', {}, 'History'),
    h(
      'div',
      { class: 'segmented', role: 'tablist' },
      tab('#/history', 'Workouts', view === 'workouts'),
      tab('#/history?view=stats', 'Stats', view === 'stats'),
    ),
    view === 'stats' ? renderStats(ctx) : workoutList(ctx),
  );
}

function workoutList(ctx: ViewContext): HTMLElement {
  const { state } = ctx;
  if (!state.workouts.length) {
    return h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'No workouts yet.'), h('a', { href: '#/' }, 'Home'));
  }
  const row = (w: WorkoutLog) => {
    const dayName = state.plan.find((d) => d.id === w.dayId)?.name ?? 'Free workout';
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
  return ctx.state.plan.find((d) => d.id === w.dayId)?.name ?? 'Free workout';
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
  const line = (e: WorkoutLog['entries'][number]) => {
    const ex = getExercise(e.exerciseId);
    const timed = isTimed(ex);
    const weighted = !timed && e.sets.some((x) => x.weightKg > 0);
    const text = e.sets
      .map((x) => (timed ? amountText(ex, x.reps) : x.weightKg > 0 ? `${x.reps} × ${toDisplayWeight(x.weightKg, units)}` : String(x.reps)))
      .join(' · ');
    return h('li', { class: 'detail-exercise' }, h('strong', {}, ex?.name ?? e.exerciseId), h('span', {}, weighted ? `${text} ${units}` : text));
  };
  const dayId = w.dayId;
  let resume: HTMLButtonElement | null = null;
  if (dayId && isPhone() && canContinue(w, ctx.state.plan, ctx.today())) {
    resume = h('button', { type: 'button', class: 'primary' }, 'Continue this workout');
    resume.addEventListener('click', () => {
      const existing = readDraft(ctx.repo.draft(dayId));
      if (ctx.repo.hasDraft(dayId) && existing?.editingId !== w.id && !confirm('Replace your unsaved session?')) return;
      ctx.repo.setDraft(dayId, workoutToDraft(w));
      ctx.navigate(`/workout/${dayId}`);
    });
  }
  return h(
    'main',
    { class: 'container' },
    h('div', { class: 'actions' }, h('a', { href: '#/history' }, '‹ History'), h('a', { href: `#/history/${encodeURIComponent(w.id)}/edit` }, 'Edit')),
    h('h1', {}, titleOf(ctx, w)),
    h('p', { class: 'muted detail-meta' }, w.durationMin ? `${dateText(w.date)} · ${w.durationMin} min` : dateText(w.date)),
    h('div', { class: 'chips' }, ...[plural(w.entries.length, 'exercise'), plural(sets, 'set'), formatWeight(workoutVolume(w), units)].map((t) => h('span', { class: 'chip' }, t))),
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
export function workoutToDraft(log: WorkoutLog): WorkoutDraft {
  return {
    entries: structuredClone(log.entries),
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
  const duration = h('input', { type: 'number', id: 'edit-duration', min: 0, max: 600, inputmode: 'numeric', value: w.durationMin ?? '' });
  const notes = h('textarea', { id: 'edit-notes', maxlength: MAX_NOTES, rows: 2 }, w.notes);
  const editor = renderSetEditor({ entries, units: ctx.state.settings.units, workouts: ctx.state.workouts, animate: ctx.animate(), onChange: () => {} });
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
    h('div', { class: 'row' }, h('label', { for: 'edit-date' }, 'Date ', date), h('label', { for: 'edit-duration' }, 'Duration (min)'), numberWheel(duration, 5)),
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
      durationMin: duration.value !== '' ? Math.round(clampNumber(duration.value, 0, 600, 0)) : null,
      notes: cleanText(notes.value, MAX_NOTES),
    };
    await ctx.update((s) => saveWorkout(s, log, new Date().toISOString(), true, () => randomId(8)), { render: false });
    ctx.toast('Workout updated.');
    ctx.navigate(back.slice(1));
  });
  return h('main', {}, form);
}

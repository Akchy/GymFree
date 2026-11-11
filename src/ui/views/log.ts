import { isISODate } from '../../core/dates';
import { randomId } from '../../core/encoding';
import { clampNumber, cleanId, cleanText, MAX_NOTES, MAX_WEIGHT_KG, setSeconds } from '../../core/state';
import type { LoggedExercise, LoggedSet, WorkoutLog } from '../../core/types';
import { getExercise } from '../../data/exercises';
import type { ViewContext } from '../context';
import { h } from '../dom';
import { numberWheel } from '../number-wheel';
import { renderSetEditor, type DraftEntry, type DraftSet } from '../set-editor';
import { isPhone } from '../device';
import { saveWorkout } from '../../core/history';
import { dayLabel } from './plan';

export { lastWeight } from '../set-editor';

/** A clock left running while the app was closed counts up to an hour (as in workout mode). */
const MAX_GAP_MS = 60 * 60 * 1000;

/** mm:ss, or h:mm:ss from an hour. */
function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return s < 3600 ? `${pad(Math.floor(s / 60))}:${pad(s % 60)}` : `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** A workout being filled in, kept on the device until it is saved or discarded. */
export interface WorkoutDraft {
  entries: { exerciseId: string; sets: DraftSet[] }[];
  date: string;
  durationMin: number | null;
  notes: string;
  /** Workout mode's clock: time spent in it so far, and when the current visit began (ms). */
  activeMs: number;
  resumedAt: number | null;
  /** Set when the draft is an existing workout being edited: saving updates it instead of adding. */
  editingId?: string;
}

const optionalNum = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? clampNumber(v, 0, max, 0) : null);

/** Validates a stored draft (it comes from device storage, so it is treated as untrusted). */
export function readDraft(raw: unknown): WorkoutDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const entries = (Array.isArray(d.entries) ? d.entries : []).slice(0, 40).flatMap((e) => {
    const exerciseId = (e as Record<string, unknown>)?.exerciseId;
    if (typeof exerciseId !== 'string' || !getExercise(exerciseId)) return [];
    const sets = (Array.isArray((e as Record<string, unknown>).sets) ? ((e as Record<string, unknown>).sets as unknown[]) : []).slice(0, 20).map((st) => {
      const x = (st ?? {}) as Record<string, unknown>;
      const reps = optionalNum(x.reps, 1000);
      const set: DraftSet = { reps: reps === null ? null : Math.round(reps), weightKg: optionalNum(x.weightKg, MAX_WEIGHT_KG) };
      const seconds = setSeconds(x.seconds);
      if (seconds !== null) set.seconds = seconds;
      return set;
    });
    return [{ exerciseId, sets: sets.length ? sets : [{ reps: null, weightKg: null }] }];
  });
  const editingId = cleanId(d.editingId);
  return {
    ...(editingId ? { editingId } : {}),
    entries,
    date: isISODate(d.date) ? d.date : '',
    durationMin: optionalNum(d.durationMin, 600),
    notes: cleanText(d.notes, MAX_NOTES),
    activeMs: Math.round(optionalNum(d.activeMs, 600 * 60_000) ?? 0),
    resumedAt: typeof d.resumedAt === 'number' && Number.isFinite(d.resumedAt) && d.resumedAt > 0 ? d.resumedAt : null,
  };
}

/** Converts the form draft into logged entries: sets without reps are skipped. */
export function draftToEntries(entries: readonly DraftEntry[]): LoggedExercise[] {
  return entries
    .map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets.filter((s) => (s.reps ?? 0) > 0).map((s): LoggedSet => (s.seconds ? { reps: s.reps as number, weightKg: s.weightKg ?? 0, seconds: s.seconds } : { reps: s.reps as number, weightKg: s.weightKg ?? 0 })),
    }))
    .filter((e) => e.sets.length);
}

export function renderLogForm(ctx: ViewContext, dayId: string): HTMLElement {
  const { state } = ctx;
  const units = state.settings.units;
  const day = state.plan.find((d) => d.id === dayId) ?? null;
  const targetFor = (exerciseId: string) => day?.exercises.find((pe) => pe.exerciseId === exerciseId) ?? null;
  // Each exercise starts with one empty set; the user adds sets as they go.
  const planned: DraftEntry[] = (day?.exercises ?? []).map((pe) => ({ exerciseId: pe.exerciseId, target: pe, sets: [{ reps: null, weightKg: null }] }));
  const plannedIds = planned.map((e) => e.exerciseId).join();
  // An unfinished workout from earlier (app closed, page left) picks up where it stopped.
  const restored = readDraft(ctx.repo.draft(dayId));
  const entries: DraftEntry[] = restored ? restored.entries.map((e) => ({ ...e, target: targetFor(e.exerciseId) })) : planned;

  const date = h('input', { type: 'date', id: 'log-date', value: restored?.date && restored.date <= ctx.today() ? restored.date : ctx.today(), max: ctx.today(), required: true });
  const duration = h('input', { type: 'number', id: 'log-duration', min: 0, max: 600, inputmode: 'numeric', value: restored?.durationMin ?? '' });
  const notes = h('textarea', { id: 'log-notes', maxlength: MAX_NOTES, rows: 2 }, restored?.notes ?? '');

  // ----- workout timer: the same clock as workout mode, shared through the draft -----
  // Time from earlier runs (here or in workout mode), plus the current run since `resumedAt`.
  // Here the clock keeps running when the page is left (to look up an exercise, say).
  let activeMs = restored?.activeMs ?? 0;
  let resumedAt: number | null = null;
  if (restored?.resumedAt != null) {
    activeMs += clampNumber(Date.now() - restored.resumedAt, 0, MAX_GAP_MS, 0);
    resumedAt = Date.now();
  }
  const clockMs = () => activeMs + (resumedAt === null ? 0 : Date.now() - resumedAt);
  const clockMinutes = () => Math.round(clampNumber(clockMs() / 60_000, 0, 600, 0));

  // Duration follows the timer until it is typed or turned by hand; then the hand-set value wins.
  let durationManual = restored?.durationMin != null;
  let filling = false;
  const onDurationEdit = () => {
    if (!filling) durationManual = duration.value !== '';
  };
  duration.addEventListener('input', onDurationEdit);
  duration.addEventListener('change', onDurationEdit);
  const durationHint = h('small', { class: 'muted', id: 'log-duration-hint' });
  const fillDuration = () => {
    durationHint.textContent = !durationManual && clockMs() > 0 ? 'From the timer' : '';
    if (durationManual || clockMs() === 0) return;
    const v = String(clockMinutes());
    if (duration.value === v) return;
    filling = true;
    duration.value = v;
    duration.dispatchEvent(new Event('change')); // moves the wheel; not a change by the user
    filling = false;
  };

  const clockTime = h('span', { class: 'log-clock-time', role: 'timer', 'aria-label': 'Workout time' });
  const clockBtn = h('button', { type: 'button', class: 'secondary' });
  const clockBox = h('div', { class: 'log-clock' }, h('span', { class: 'muted' }, 'Workout timer'), clockTime, clockBtn);
  const paintClock = () => {
    clockTime.textContent = clockText(clockMs());
    const running = resumedAt !== null;
    clockBtn.textContent = running ? 'Pause' : clockMs() > 0 ? 'Resume' : 'Start timer';
    clockBtn.setAttribute('aria-label', `${clockBtn.textContent} workout timer`);
    clockBox.classList.toggle('running', running);
    fillDuration();
  };

  /** Keeps the workout on the device while it is being filled in (removed once nothing is entered). */
  const persistDraft = () => {
    const touched =
      entries.some((e) => e.sets.some((st) => st.reps !== null || st.weightKg !== null)) ||
      entries.map((e) => e.exerciseId).join() !== plannedIds ||
      notes.value.trim() !== '' ||
      (durationManual && duration.value !== '') ||
      activeMs > 0 ||
      resumedAt !== null;
    const draft: WorkoutDraft = {
      ...(restored?.editingId ? { editingId: restored.editingId } : {}),
      entries: entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets })),
      date: date.value,
      durationMin: durationManual && duration.value !== '' ? Number(duration.value) : null,
      notes: notes.value,
      activeMs,
      resumedAt,
    };
    ctx.repo.setDraft(dayId, touched ? draft : null);
  };

  clockBtn.addEventListener('click', () => {
    if (resumedAt === null) resumedAt = Date.now();
    else {
      activeMs += Date.now() - resumedAt;
      resumedAt = null;
    }
    paintClock();
    persistDraft();
  });
  paintClock();
  // Ticks while this form is on screen; a re-render or another page leaves it behind.
  const tick = setInterval(() => (clockBox.isConnected ? paintClock() : clearInterval(tick)), 500);

  const editor = renderSetEditor({ entries, units, workouts: state.workouts, animate: ctx.animate(), onChange: () => persistDraft() });
  persistDraft();

  const discard = h('button', { type: 'button', class: 'link' }, 'Discard and start over');
  discard.addEventListener('click', () => {
    if (!confirm('Discard the unsaved workout?')) return;
    ctx.repo.setDraft(dayId, null);
    ctx.navigate(`/log/${dayId}`);
  });
  const error = h('p', { class: 'error', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'primary' }, 'Save workout');

  const form = h(
    'form',
    { class: 'container' },
    h('h1', { class: 'log-title' }, day ? [dayLabel(day), h('span', { class: 'day-title' }, day.name)] : 'Free workout'),
    day && isPhone() ? h('p', {}, h('a', { href: `#/workout/${day.id}` }, 'Switch to workout mode')) : null,
    restored ? h('p', { class: 'note-inline', role: 'status' }, 'Picked up your unsaved workout from earlier. ', discard) : null,
    clockBox,
    h(
      'div',
      { class: 'row' },
      h('label', { for: 'log-date' }, 'Date ', date),
      h('label', { for: 'log-duration' }, 'Duration (min)'),
      numberWheel(duration, 5),
      durationHint,
    ),
    editor,
    h('div', { class: 'field' }, h('label', { for: 'log-notes' }, 'Notes (optional)'), notes),
    error,
    h('div', { class: 'actions' }, save),
  );
  form.addEventListener('input', persistDraft);
  form.addEventListener('change', persistDraft);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const logged = draftToEntries(entries);
    if (!isISODate(date.value) || date.value > ctx.today()) return void (error.textContent = 'Please choose a valid date (not in the future).');
    if (!logged.length) return void (error.textContent = 'Enter the reps (or seconds) for at least one set before saving.');
    save.disabled = true;
    const log: WorkoutLog = {
      id: restored?.editingId ?? randomId(8),
      date: date.value,
      dayId: day?.id ?? null,
      entries: logged,
      // Typed by hand, else the timer's time (from here or workout mode), else none.
      durationMin: durationManual && duration.value !== '' ? Math.round(clampNumber(duration.value, 0, 600, 0)) : clockMs() > 0 ? clockMinutes() : null,
      notes: cleanText(notes.value, MAX_NOTES),
    };
    await ctx.update((s) => saveWorkout(s, log, new Date().toISOString(), !!restored?.editingId, () => randomId(8)), { render: false });
    ctx.repo.setDraft(dayId, null);
    ctx.toast('Workout saved. Nice job!');
    ctx.navigate('/history');
  });
  return h('main', {}, form);
}

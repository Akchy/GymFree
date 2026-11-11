/** Shared per-exercise set editor: one compact row of wheels per set (used by the entry screen and by editing past workouts). */
import { clampNumber, MAX_WEIGHT_KG } from '../core/state';

/** Longest time a set can be edited to (one hour). */
const MAX_SET_SEC = 3600;
import type { PlannedExercise, WorkoutLog } from '../core/types';
import { fromDisplayWeight, round, toDisplayWeight } from '../core/units';
import { CORE_EXERCISES, EXERCISES, getExercise, isTimed } from '../data/exercises';
import { renderDemo } from './demo';
import { clear, h } from './dom';
import { howTo as renderHowTo } from './howto';
import { numberWheel } from './number-wheel';
import { exerciseOptions, prescriptionText } from './views/plan';

export interface DraftSet {
  reps: number | null;
  weightKg: number | null;
  /** How long the set took, if it was timed in workout mode. */
  seconds?: number;
}

export interface DraftEntry {
  exerciseId: string;
  target: PlannedExercise | null;
  sets: DraftSet[];
}

/** Heaviest weight from the most recent session of an exercise (to prefill the form). */
export function lastWeight(workouts: readonly WorkoutLog[], exerciseId: string): number {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const e = w.entries.find((x) => x.exerciseId === exerciseId && x.sets.length);
    if (e) return Math.max(...e.sets.map((x) => x.weightKg));
  }
  return 0;
}

export interface SetEditorOptions {
  entries: DraftEntry[];
  units: 'kg' | 'lb';
  workouts: readonly WorkoutLog[];
  animate: boolean;
  onChange: () => void;
  /** Show and edit each set's time (editing a past workout). Without it, changing the reps clears the time. */
  showTime?: boolean;
}

/** Edits `opts.entries` in place and calls `onChange` after every change. */
export function renderSetEditor(opts: SetEditorOptions): HTMLElement {
  const { entries, units, workouts, animate, onChange, showTime = false } = opts;
  const maxWeight = toDisplayWeight(MAX_WEIGHT_KG, units);
  const list = h('div', { class: 'stack set-groups' });

  const rerender = () => {
    paint();
    onChange();
  };

  const paint = () => {
    clear(list);
    entries.forEach((entry, ei) => {
      const ex = getExercise(entry.exerciseId);
      if (!ex) return;
      const name = ex.name;
      const last = lastWeight(workouts, entry.exerciseId);
      const timed = isTimed(ex);
      const unit = timed ? 'seconds' : 'reps';
      const repsHint = entry.target ? (entry.target.repsMin === entry.target.repsMax ? String(entry.target.repsMin) : `${entry.target.repsMin}–${entry.target.repsMax}`) : timed ? 'sec' : 'reps';
      const rows = entry.sets.map((set, si) => {
        const reps = h('input', { type: 'number', min: 0, max: 1000, step: 1, value: set.reps ?? '', placeholder: repsHint, inputmode: 'numeric', 'aria-label': `${name} set ${si + 1} ${unit}`, class: 'num' });
        const readReps = () => {
          const next = reps.value === '' ? null : Math.round(clampNumber(reps.value, 0, 1000, 0));
          if (next === set.reps) return;
          set.reps = next;
          if (!showTime) delete set.seconds; // the old time no longer describes this set (unless it can be edited)
        };
        reps.addEventListener('input', readReps); // while typing, so a draft is never behind
        reps.addEventListener('change', readReps);
        const weight = h('input', {
          type: 'number', min: 0, max: maxWeight, step: 'any', inputmode: 'decimal', class: 'num',
          value: set.weightKg === null ? '' : toDisplayWeight(set.weightKg, units),
          placeholder: last > 0 ? String(toDisplayWeight(last, units)) : '0',
          'aria-label': `${name} set ${si + 1} weight (${units})`,
        });
        // Only ever runs on user input: untouched weights keep their exact stored kg.
        const readWeight = (correct: boolean) => {
          if (weight.value === '') return void (set.weightKg = null);
          const typed = Number(weight.value);
          const kg = clampNumber(fromDisplayWeight(typed, units), 0, MAX_WEIGHT_KG, 0);
          set.weightKg = round(kg, 3);
          // Show the correction rather than silently saving a different number.
          if (correct && !(typed >= 0 && typed <= maxWeight)) weight.value = String(toDisplayWeight(kg, units));
        };
        weight.addEventListener('input', () => readWeight(false));
        weight.addEventListener('change', () => readWeight(true));
        // A timed exercise's amount already is its time, so only sets counted in reps get a time wheel.
        let time: HTMLInputElement | null = null;
        if (showTime && !timed) {
          const input = h('input', { type: 'number', min: 0, max: MAX_SET_SEC, step: 1, inputmode: 'numeric', class: 'num', value: set.seconds ?? '', placeholder: '–', 'aria-label': `${name} set ${si + 1} time (seconds)` });
          const readTime = () => {
            const sec = input.value === '' ? 0 : Math.round(clampNumber(input.value, 0, MAX_SET_SEC, 0));
            if (sec > 0) set.seconds = sec;
            else delete set.seconds;
          };
          input.addEventListener('input', readTime);
          input.addEventListener('change', readTime);
          time = input;
        }
        const remove = h('button', { type: 'button', class: 'icon danger', 'aria-label': `Remove set ${si + 1} of ${name}` }, '✕');
        remove.addEventListener('click', () => {
          entry.sets.splice(si, 1);
          rerender();
        });
        return h(
          'div',
          { class: 'set-row' },
          h('span', { class: 'set-index' }, String(si + 1)),
          h('span', { class: 'set-wheel' }, numberWheel(reps)),
          h('span', { class: 'set-x', 'aria-hidden': 'true' }, '×'),
          h('span', { class: 'set-wheel' }, numberWheel(weight, units === 'kg' ? 2.5 : 5)),
          time ? h('span', { class: 'set-wheel set-time' }, numberWheel(time, 5)) : null,
          entry.sets.length > 1 ? remove : null,
        );
      });
      const addSet = h('button', { type: 'button', class: 'secondary' }, '+ Add set');
      addSet.addEventListener('click', () => {
        const prev = entry.sets[entry.sets.length - 1];
        // A set added by hand copies the reps and weight, not the time of the one before.
        entry.sets.push(prev ? { reps: prev.reps, weightKg: prev.weightKg } : { reps: null, weightKg: null });
        rerender();
      });
      const removeEx = h('button', { type: 'button', class: 'link danger' }, 'Remove exercise');
      removeEx.addEventListener('click', () => {
        entries.splice(ei, 1);
        rerender();
      });
      const howTo = h('div', { class: 'how-to', hidden: true });
      const info = h('button', { type: 'button', class: 'icon info', 'aria-expanded': 'false', 'aria-label': `How to do ${name}` }, 'ⓘ');
      info.addEventListener('click', () => {
        const open = info.getAttribute('aria-expanded') !== 'true';
        info.setAttribute('aria-expanded', String(open));
        howTo.hidden = !open;
        if (open && !howTo.firstChild) howTo.append(renderDemo(ex, { animate }), renderHowTo(ex, (d) => [h('ol', {}, ...d.steps.map((step) => h('li', {}, step))), h('p', { class: 'note-inline' }, '💡 ', d.tip)]));
      });
      list.appendChild(
        h(
          'section',
          { class: `card set-group log-entry${showTime && !timed ? ' with-time' : ''}` },
          h('div', { class: 'set-head' }, h('div', {}, h('h2', {}, name), entry.target ? h('p', { class: 'muted' }, `Target: ${prescriptionText(entry.target)}`) : null), info),
          howTo,
          h('div', { class: 'set-cols muted' }, h('span', {}, 'Set'), h('span', {}, timed ? 'Seconds' : 'Reps'), h('span', {}, showTime && !timed ? units : `Weight (${units})`), showTime && !timed ? h('span', {}, 'Time (s)') : null),
          ...rows,
          h('div', { class: 'row' }, addSet, removeEx),
        ),
      );
    });
  };
  paint();

  const placeholder = h('option', { value: '' }, '+ Add exercise…');
  // The full library is only built if asked for.
  const picker = h('select', { 'aria-label': 'Add exercise' }, placeholder, ...exerciseOptions(CORE_EXERCISES), h('option', { value: 'all' }, `Show all ${EXERCISES.length} exercises…`));
  picker.addEventListener('change', () => {
    if (picker.value === 'all') {
      picker.replaceChildren(placeholder, ...exerciseOptions(EXERCISES));
      picker.value = '';
      return;
    }
    if (!getExercise(picker.value)) return;
    entries.push({ exerciseId: picker.value, target: null, sets: [{ reps: null, weightKg: null }] });
    picker.value = '';
    rerender();
  });

  return h('div', { class: 'set-editor' }, list, picker);
}

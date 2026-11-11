import { addDays, startOfWeek } from './dates';
import type { AppState, WorkoutLog } from './types';

export interface WeekGroup {
  weekStart: string;
  label: string;
  workouts: WorkoutLog[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Replaces the workout with the same id (or adds it), stamping the edit time. */
export function upsertWorkout(state: AppState, log: WorkoutLog, nowIso: string): void {
  const stamped = { ...log, updatedAt: nowIso };
  const i = state.workouts.findIndex((w) => w.id === log.id);
  if (i >= 0) state.workouts[i] = stamped;
  else state.workouts.push(stamped);
  state.workouts.sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
}

/** Deletes a workout and remembers the id so syncing doesn't bring it back. */
export function removeWorkout(state: AppState, id: string): void {
  state.workouts = state.workouts.filter((w) => w.id !== id);
  if (!state.deletedWorkoutIds.includes(id)) state.deletedWorkoutIds.push(id);
}

/** Groups workouts by Monday-start week, newest week first and newest workout first within it. */
export function groupByWeek(workouts: readonly WorkoutLog[], today: string): WeekGroup[] {
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);
  const byWeek = new Map<string, WorkoutLog[]>();
  for (const w of workouts) {
    const key = startOfWeek(w.date);
    byWeek.set(key, [...(byWeek.get(key) ?? []), w]);
  }
  return [...byWeek.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((weekStart) => ({
      weekStart,
      label: weekStart === thisWeek ? 'This week' : weekStart === lastWeek ? 'Last week' : weekLabel(weekStart),
      workouts: byWeek
        .get(weekStart)!
        .sort((x, y) => y.date.localeCompare(x.date) || (y.updatedAt ?? '').localeCompare(x.updatedAt ?? '')),
    }));
}

function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-').map(Number);
  return `Week of ${d} ${MONTHS[m - 1]}`;
}

/**
 * Combines two versions of one user's data that changed independently (for example the
 * phone logged a workout while the computer changed a setting).
 *
 * - Workouts: kept from both, except ones deleted on either device; if both have the same
 *   workout, the copy edited most recently (`updatedAt`) is used; a copy without `updatedAt`
 *   counts as oldest, and on a tie the newer version's copy wins.
 * - Body-weight entries: combined by date; on the same date the newer version wins.
 * - Everything else (goal, profile, plan, settings): taken from the newer version.
 */
import { sanitizeState } from './state';
import type { AppState, BodyLog, WorkoutLog } from './types';

export interface Version {
  state: AppState;
  /** When this version was saved (ISO timestamp). */
  updatedAt: string;
}

export function mergeVersions(a: Version, b: Version): AppState {
  const [older, newer] = Date.parse(a.updatedAt) <= Date.parse(b.updatedAt) ? [a.state, b.state] : [b.state, a.state];
  const deleted = new Set([...older.deletedWorkoutIds, ...newer.deletedWorkoutIds]);

  const workouts = new Map<string, WorkoutLog>();
  const editedAt = (w: WorkoutLog) => (w.updatedAt ? Date.parse(w.updatedAt) : -Infinity);
  for (const w of [...older.workouts, ...newer.workouts]) {
    if (deleted.has(w.id)) continue;
    const have = workouts.get(w.id);
    // Later entries come from the newer version, so `>=` makes it win ties.
    if (!have || editedAt(w) >= editedAt(have)) workouts.set(w.id, w);
  }

  const bodyLogs = new Map<string, BodyLog>();
  for (const b of [...older.bodyLogs, ...newer.bodyLogs]) bodyLogs.set(b.date, b);
  const sortedLogs = [...bodyLogs.values()].sort((x, y) => x.date.localeCompare(y.date));

  return sanitizeState({
    ...newer,
    workouts: [...workouts.values()].sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id)),
    deletedWorkoutIds: [...deleted],
    bodyLogs: sortedLogs,
    profile: { ...newer.profile, weightKg: sortedLogs.at(-1)?.weightKg ?? newer.profile.weightKg },
  });
}

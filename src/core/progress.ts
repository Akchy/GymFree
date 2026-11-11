/** Progress statistics derived from workout and body-weight logs. */
import { getExercise, isTimed } from '../data/exercises';
import { addDays, daysBetween, startOfWeek } from './dates';
import type { BodyLog, LoggedExercise, LoggedSet, MuscleGroup, WorkoutLog } from './types';

/** Epley one-rep-max estimate. */
export function estimateOneRepMax(set: LoggedSet): number {
  if (set.reps <= 0 || set.weightKg <= 0) return 0;
  if (set.reps === 1) return set.weightKg;
  return set.weightKg * (1 + set.reps / 30);
}

/** Weight × reps; timed exercises (seconds, not reps) add no volume. */
export function entryVolume(entry: LoggedExercise): number {
  if (isTimed(getExercise(entry.exerciseId))) return 0;
  return entry.sets.reduce((sum, s) => sum + s.reps * s.weightKg, 0);
}

export function workoutVolume(log: WorkoutLog): number {
  return log.entries.reduce((sum, e) => sum + entryVolume(e), 0);
}

/** Reps across the workout; timed exercises are left out (their sets hold seconds). */
export function totalReps(log: WorkoutLog): number {
  return log.entries.reduce((sum, e) => (isTimed(getExercise(e.exerciseId)) ? sum : sum + e.sets.reduce((s, x) => s + x.reps, 0)), 0);
}

export interface PersonalRecord {
  exerciseId: string;
  bestWeightKg: number;
  bestReps: number;
  bestOneRepMax: number;
  date: string;
}

export function personalRecords(workouts: readonly WorkoutLog[]): PersonalRecord[] {
  const prs = new Map<string, PersonalRecord>();
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.entries) {
      // For a timed exercise the record is the longest set (bestReps holds seconds), not a 1RM.
      const timed = isTimed(getExercise(e.exerciseId));
      for (const s of e.sets) {
        if (s.reps <= 0) continue;
        const cur = prs.get(e.exerciseId) ?? { exerciseId: e.exerciseId, bestWeightKg: 0, bestReps: 0, bestOneRepMax: 0, date: w.date };
        const orm = timed ? 0 : estimateOneRepMax(s);
        if (orm > cur.bestOneRepMax || (orm === cur.bestOneRepMax && s.reps > cur.bestReps)) cur.date = w.date;
        cur.bestWeightKg = Math.max(cur.bestWeightKg, s.weightKg);
        cur.bestReps = Math.max(cur.bestReps, s.reps);
        cur.bestOneRepMax = Math.max(cur.bestOneRepMax, orm);
        prs.set(e.exerciseId, cur);
      }
    }
  }
  return [...prs.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/** Per-workout progress for one exercise: estimated 1RM if weighted, otherwise best reps (or longest set if timed). */
export function exerciseSeries(workouts: readonly WorkoutLog[], exerciseId: string): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const weighted = !isTimed(getExercise(exerciseId)) && sorted.some((w) => w.entries.some((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.weightKg > 0)));
  for (const w of sorted) {
    const sets = w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    if (!sets.length) continue;
    const value = weighted ? Math.max(...sets.map(estimateOneRepMax)) : Math.max(...sets.map((s) => s.reps));
    points.push({ date: w.date, value: Math.round(value * 10) / 10 });
  }
  return points;
}

/**
 * Time spent working in a workout (rests left out): the sum of its set times. A timed
 * exercise typed in by hand still counts, since its amount is seconds. Null if no set was timed.
 */
export function workingSeconds(log: WorkoutLog): number | null {
  let total = 0;
  let timed = false;
  for (const e of log.entries) {
    const byAmount = isTimed(getExercise(e.exerciseId));
    for (const s of e.sets) {
      const sec = s.seconds ?? (byAmount ? s.reps : 0);
      if (sec > 0) {
        total += sec;
        timed = true;
      }
    }
  }
  return timed ? total : null;
}

/**
 * Average seconds per rep for one exercise, per workout, from sets timed in workout mode.
 * Rising means slower reps (more control, or tiring); falling means faster. Not for timed exercises.
 */
export function secondsPerRepSeries(workouts: readonly WorkoutLog[], exerciseId: string): SeriesPoint[] {
  if (isTimed(getExercise(exerciseId))) return [];
  const points: SeriesPoint[] = [];
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    let sec = 0;
    let reps = 0;
    for (const e of w.entries) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (!s.seconds || s.reps <= 0) continue;
        sec += s.seconds;
        reps += s.reps;
      }
    }
    if (reps > 0) points.push({ date: w.date, value: Math.round((sec / reps) * 10) / 10 });
  }
  return points;
}

export function loggedExerciseIds(workouts: readonly WorkoutLog[]): string[] {
  return [...new Set(workouts.flatMap((w) => w.entries.filter((e) => e.sets.length).map((e) => e.exerciseId)))];
}

export function workoutsInWeek(workouts: readonly WorkoutLog[], today: string): number {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  return workouts.filter((w) => w.date >= start && w.date <= end).length;
}

/** Consecutive weeks (ending this week, or last week if this week is still empty) with at least one workout. */
export function weekStreak(workouts: readonly WorkoutLog[], today: string): number {
  const weeks = new Set(workouts.map((w) => startOfWeek(w.date)));
  let week = startOfWeek(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function muscleGroupCounts(workouts: readonly WorkoutLog[], today: string, days = 30): Record<string, number> {
  const counts: Partial<Record<MuscleGroup, number>> = {};
  for (const w of workouts) {
    const age = daysBetween(w.date, today);
    if (age < 0 || age >= days) continue;
    for (const e of w.entries) {
      const ex = getExercise(e.exerciseId);
      const done = e.sets.filter((s) => s.reps > 0).length;
      if (!ex || !done) continue;
      counts[ex.primary] = (counts[ex.primary] ?? 0) + done;
    }
  }
  return counts;
}

export interface WeightChange {
  first: BodyLog;
  latest: BodyLog;
  changeKg: number;
}

export function weightChange(logs: readonly BodyLog[]): WeightChange | null {
  if (!logs.length) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  return { first, latest, changeKg: Math.round((latest.weightKg - first.weightKg) * 10) / 10 };
}

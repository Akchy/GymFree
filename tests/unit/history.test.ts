import { describe, expect, it } from 'vitest';
import { groupByWeek, removeWorkout, saveWorkout, upsertWorkout } from '../../src/core/history';
import type { WorkoutLog } from '../../src/core/types';
import { onboardedState } from './helpers';

const w = (id: string, date: string, extra: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id,
  date,
  dayId: null,
  entries: [],
  durationMin: null,
  notes: '',
  ...extra,
});

describe('upsertWorkout', () => {
  it('replaces by id and stamps updatedAt', () => {
    const s = onboardedState();
    s.workouts = [w('w1', '2026-10-20', { notes: 'old' })];
    upsertWorkout(s, w('w1', '2026-10-20', { notes: 'new' }), '2026-10-27T10:00:00.000Z');
    expect(s.workouts).toHaveLength(1);
    expect(s.workouts[0].notes).toBe('new');
    expect(s.workouts[0].updatedAt).toBe('2026-10-27T10:00:00.000Z');
  });

  it('appends a new workout in date order', () => {
    const s = onboardedState();
    s.workouts = [w('a', '2026-10-10'), w('c', '2026-10-20')];
    upsertWorkout(s, w('b', '2026-10-15'), '2026-10-27T10:00:00.000Z');
    expect(s.workouts.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('saveWorkout', () => {
  const now = '2026-10-27T10:00:00.000Z';
  it('updates an existing workout in place when editing', () => {
    const s = onboardedState();
    s.workouts = [w('w1', '2026-10-20', { notes: 'old' })];
    saveWorkout(s, w('w1', '2026-10-20', { notes: 'new' }), now, true, () => 'fresh');
    expect(s.workouts.map((x) => [x.id, x.notes])).toEqual([['w1', 'new']]);
  });
  it('saves under a fresh id when the edited workout is gone or deleted', () => {
    const s = onboardedState();
    s.workouts = [];
    saveWorkout(s, w('w1', '2026-10-20'), now, true, () => 'fresh');
    expect(s.workouts.map((x) => x.id)).toEqual(['fresh']);
    s.workouts = [w('w1', '2026-10-20')];
    s.deletedWorkoutIds = ['w1'];
    saveWorkout(s, w('w1', '2026-10-20', { notes: 'x' }), now, true, () => 'fresh2');
    expect(s.workouts.map((x) => x.id).sort()).toEqual(['fresh2', 'w1']);
  });
  it('keeps the given id for a new (not editing) workout', () => {
    const s = onboardedState();
    s.workouts = [];
    saveWorkout(s, w('n1', '2026-10-20'), now, false, () => 'fresh');
    expect(s.workouts.map((x) => x.id)).toEqual(['n1']);
  });
});

describe('removeWorkout', () => {
  it('records the id once', () => {
    const s = onboardedState();
    s.workouts = [w('w1', '2026-10-20')];
    removeWorkout(s, 'w1');
    removeWorkout(s, 'w1');
    expect(s.workouts).toEqual([]);
    expect(s.deletedWorkoutIds).toEqual(['w1']);
  });
});

describe('groupByWeek', () => {
  it('labels this week, last week and older weeks', () => {
    const groups = groupByWeek([w('a', '2026-10-13'), w('b', '2026-10-26'), w('c', '2026-10-20')], '2026-10-27');
    expect(groups.map((g) => g.label)).toEqual(['This week', 'Last week', 'Week of 12 Oct']);
    expect(groups.map((g) => g.weekStart)).toEqual(['2026-10-26', '2026-10-19', '2026-10-12']);
  });

  it('orders workouts newest first, ties by updatedAt', () => {
    const groups = groupByWeek(
      [
        w('a', '2026-10-26', { updatedAt: '2026-10-26T08:00:00.000Z' }),
        w('b', '2026-10-27'),
        w('c', '2026-10-26', { updatedAt: '2026-10-26T09:00:00.000Z' }),
      ],
      '2026-10-27',
    );
    expect(groups[0].workouts.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});

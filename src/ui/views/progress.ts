import { daysBetween, isISODate } from '../../core/dates';
import {
  loggedExerciseIds,
  muscleGroupCounts,
  personalRecords,
  type PersonalRecord,
  secondsPerRepSeries,
  sessionVolumeSeries,
  weekStreak,
  weightChange,
  workoutVolume,
  workoutsInWeek,
} from '../../core/progress';
import { clampNumber } from '../../core/state';
import type { MuscleGroup } from '../../core/types';
import { formatWeight, fromDisplayWeight, round, toDisplayWeight } from '../../core/units';
import { amountText, getExercise, isTimed } from '../../data/exercises';
import { barChart, lineChart } from '../chart';
import type { ViewContext } from '../context';
import { h } from '../dom';
import { numberWheel } from '../number-wheel';
import { MUSCLE_LABELS } from '../labels';

/** The Stats tab of History: summary numbers, volume chart, records, muscle sets and body weight. */
export function renderStats(ctx: ViewContext): HTMLElement {
  const { state } = ctx;
  const units = state.settings.units;
  const today = ctx.today();
  const recent = state.workouts.filter((w) => {
    const age = daysBetween(w.date, today);
    return age >= 0 && age < 30;
  });
  const volume30 = recent.reduce((s, w) => s + workoutVolume(w), 0);

  // Exercise chart
  const ids = loggedExerciseIds(state.workouts);
  const chartBox = h('div', {});
  const exSel = h('select', { 'aria-label': 'Exercise to chart' }, ...ids.map((id) => h('option', { value: id }, getExercise(id)?.name ?? id)));
  // What to chart: the usual progress, or seconds per rep where sets were timed.
  const metricSel = h(
    'select',
    { 'aria-label': 'What to chart' },
    h('option', { value: 'progress' }, 'Strength / reps'),
    h('option', { value: 'pace' }, 'Seconds per rep'),
  ) as HTMLSelectElement;
  const drawChart = () => {
    const ex = getExercise(exSel.value);
    const pace = secondsPerRepSeries(state.workouts, exSel.value);
    metricSel.hidden = !pace.length;
    if (!pace.length) metricSel.value = 'progress';
    if (metricSel.value === 'pace') {
      chartBox.replaceChildren(
        lineChart(pace, `${ex?.name}: seconds per rep`, ' s per rep'),
        h('p', { class: 'muted small' }, 'From sets timed in workout mode. Higher means slower, more controlled reps; a sudden drop can mean rushing.'),
      );
      return;
    }
    const { unit, points } = sessionVolumeSeries(state.workouts, exSel.value);
    const shown = unit === 'kg' ? points.map((p) => ({ ...p, value: toDisplayWeight(p.value, units) })) : points;
    chartBox.replaceChildren(barChart(shown, `${ex?.name}: volume per session`, unit === 'kg' ? ` ${units}` : ` ${unit}`));
  };
  exSel.addEventListener('change', drawChart);
  metricSel.addEventListener('change', drawChart);
  if (ids.length) drawChart();

  // Body weight
  const bwDate = h('input', { type: 'date', id: 'bw-date', value: today, max: today });
  // The wheel rests on the last logged body weight (or the profile's) until turned.
  const lastBw = [...state.bodyLogs].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? state.profile.weightKg;
  const bwValue = h('input', {
    type: 'number', id: 'bw-value', min: 20, max: units === 'kg' ? 400 : 880, step: 'any', inputmode: 'decimal', required: true,
    placeholder: Math.round(toDisplayWeight(lastBw ?? 70, units) * 2) / 2, // on the wheel's 0.5 grid
  });
  const bwError = h('p', { class: 'error', role: 'alert' });
  const bwForm = h(
    'form',
    { class: 'row' },
    h('label', { for: 'bw-date' }, 'Date ', bwDate),
    h('label', { for: 'bw-value' }, `Weight (${units})`), numberWheel(bwValue, 0.5),
    h('button', { type: 'submit', class: 'secondary' }, 'Add'),
  );
  bwForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = clampNumber(bwValue.value, 1, 2000, NaN);
    if (!isISODate(bwDate.value) || Number.isNaN(v)) return void (bwError.textContent = 'Enter a valid date and weight.');
    const kg = round(fromDisplayWeight(v, units), 2);
    if (kg < 20 || kg > 400) return void (bwError.textContent = 'That weight looks out of range.');
    await ctx.update((s) => {
      s.bodyLogs = s.bodyLogs.filter((b) => b.date !== bwDate.value).concat({ date: bwDate.value, weightKg: kg }).sort((a, b) => a.date.localeCompare(b.date));
      s.profile.weightKg = s.bodyLogs[s.bodyLogs.length - 1].weightKg;
    });
  });
  const change = weightChange(state.bodyLogs);

  const counts = muscleGroupCounts(state.workouts, today);
  const maxCount = Math.max(1, ...Object.values(counts));
  const prs = personalRecords(state.workouts).slice(0, 10);
  const recordText = (p: PersonalRecord) => {
    const ex = getExercise(p.exerciseId);
    if (isTimed(ex)) return amountText(ex, p.bestReps);
    return p.bestWeightKg > 0 ? `${formatWeight(p.bestWeightKg, units)} (est. 1RM ${formatWeight(p.bestOneRepMax, units)})` : `${p.bestReps} reps`;
  };

  return h(
    'div',
    { class: 'stats-view' },
    h(
      'section',
      { class: 'stats', 'aria-label': 'Summary' },
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(state.workouts.length)), h('span', { class: 'stat-label' }, 'total workouts')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(workoutsInWeek(state.workouts, today))), h('span', { class: 'stat-label' }, 'this week')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(weekStreak(state.workouts, today))), h('span', { class: 'stat-label' }, 'week streak')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, formatWeight(volume30, units)), h('span', { class: 'stat-label' }, 'lifted (30 days)')),
    ),
    h('section', { class: 'card' }, h('h2', {}, 'Exercise progress'), ids.length ? h('div', {}, h('div', { class: 'row' }, exSel, metricSel), chartBox) : h('p', { class: 'muted' }, 'Log a workout to see your progress here.')),
    prs.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, 'Personal records'),
          h(
            'ul',
            { class: 'compact' },
            ...prs.map((p) => h('li', {}, h('strong', {}, getExercise(p.exerciseId)?.name ?? p.exerciseId), ': ', recordText(p), h('span', { class: 'muted' }, ` · ${p.date}`))),
          ),
        )
      : null,
    Object.keys(counts).length
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, 'Sets per muscle group (last 30 days)'),
          h('ul', { class: 'bars' }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g, n]) =>
            {
            // Set via CSSOM (allowed by the strict CSP, unlike style attributes).
            const bar = h('span', { class: 'bar' });
            bar.style.setProperty('--w', `${Math.round((n / maxCount) * 100)}%`);
            return h('li', {}, h('span', {}, MUSCLE_LABELS[g as MuscleGroup]), bar, h('span', {}, String(n)));
          })),
        )
      : null,
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Body weight'),
      change ? h('p', {}, `Latest ${formatWeight(change.latest.weightKg, units)} · change since ${change.first.date}: ${change.changeKg > 0 ? '+' : ''}${toDisplayWeight(change.changeKg, units)} ${units}`) : null,
      lineChart(state.bodyLogs.map((b) => ({ date: b.date, value: toDisplayWeight(b.weightKg, units) })), 'Body weight', ` ${units}`),
      bwForm,
      bwError,
    ),
  );
}

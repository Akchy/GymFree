import { weekdayOf } from '../../core/dates';
import { GOAL_PROFILES, estimateCalories, minutesPerExercise, routineAdvice } from '../../core/planner';
import { weekStreak, workoutsInWeek } from '../../core/progress';
import { WEEKDAY_NAMES, type PlanDay } from '../../core/types';
import { getExercise, rangeText } from '../../data/exercises';
import type { ViewContext } from '../context';
import { startWorkoutHref } from '../device';
import { h, svg } from '../dom';
import { GEAR_ICON } from '../nav';
import { MUSCLE_LABELS } from '../labels';
import { animateArrivals, dayLabel, orderedDays, reshuffleButton } from './plan';
import { renderSpinWheel } from './wheel';

export function nextPlanDay(plan: readonly PlanDay[], todayWeekday: number): { day: PlanDay; inDays: number } | null {
  const scheduled = plan.filter((d) => d.weekday !== null);
  if (!scheduled.length) return plan.length ? { day: plan[0], inDays: 0 } : null;
  let best: { day: PlanDay; inDays: number } | null = null;
  for (const day of scheduled) {
    const inDays = ((day.weekday as number) - todayWeekday + 7) % 7;
    if (!best || inDays < best.inDays) best = { day, inDays };
  }
  return best;
}

function stat(label: string, value: string | number): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, label));
}

/**
 * The roulette is kept across re-renders, so saving something else on the home page (like
 * new exercises for today) doesn't redraw it with a different set or lose the last pick.
 */
let wheel: HTMLElement | null = null;

function inProgress(ctx: ViewContext, dayId: string): HTMLElement | null {
  return ctx.repo.hasDraft(dayId) ? h('span', { class: 'badge in-progress' }, 'Unsaved workout in progress') : null;
}

/** "Different workout": any other plan day, or a free workout. */
function otherWorkouts(ctx: ViewContext, skipId?: string): HTMLElement {
  const days = orderedDays(ctx.state.plan).filter((d) => d.id !== skipId);
  return h(
    'details',
    { class: 'other-workouts' },
    h('summary', {}, 'Different workout'),
    h(
      'ul',
      { class: 'other-list' },
      ...days.map((d) => h('li', {}, h('a', { href: startWorkoutHref(d.id) }, `${d.name} · ${dayLabel(d)}`), inProgress(ctx, d.id))),
      h('li', {}, h('a', { href: '#/log/free' }, 'Free workout')),
    ),
  );
}

export function renderDashboard(ctx: ViewContext): HTMLElement {
  const { state } = ctx;
  const today = ctx.today();
  const next = nextPlanDay(state.plan, weekdayOf(today));
  const doneToday = state.workouts.some((w) => w.date === today);
  const calories = estimateCalories(state.profile, state.routine.activityLevel, state.goal);

  let todayCard: HTMLElement;
  if (!next) {
    todayCard = h('section', { class: 'card' }, h('h2', {}, 'No plan yet'), h('a', { href: '#/onboarding', class: 'button primary' }, 'Create a plan'));
  } else {
    const { day, inDays } = next;
    const startable = !doneToday && inDays === 0;
    const minutes = Math.round(day.exercises.reduce((sum, pe) => sum + minutesPerExercise(pe), 0));
    const when = inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `On ${WEEKDAY_NAMES[day.weekday as number]}`;
    todayCard = h(
      'section',
      { class: 'card highlight', 'aria-labelledby': 'today-title' },
      h('h2', { id: 'today-title' }, inDays === 0 ? (doneToday ? 'Done for today. Great work!' : "Today's workout") : 'Rest day: recover well'),
      h('p', {}, `${when}: `, h('strong', {}, day.name), ` · ${day.muscleGroups.map((g) => MUSCLE_LABELS[g]).join(', ')}`),
      h('p', { class: 'muted' }, `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'} · ~${minutes} min`),
      h(
        'ul',
        { class: 'compact' },
        ...animateArrivals(ctx, day, day.exercises.slice(0, 6).map((pe) => {
          const ex = getExercise(pe.exerciseId);
          return h('li', {}, h('a', { href: `#/exercises/${pe.exerciseId}?from=home` }, ex?.name ?? pe.exerciseId), ` · ${pe.sets} × ${rangeText(ex, pe.repsMin, pe.repsMax)}`);
        })),
      ),
      startable ? h('div', { class: 'row' }, h('a', { href: startWorkoutHref(day.id), class: 'button primary' }, 'Start workout'), reshuffleButton(ctx, day)) : null,
      startable ? inProgress(ctx, day.id) : null,
      startable ? otherWorkouts(ctx, day.id) : otherWorkouts(ctx),
    );
  }

  let installCard: HTMLElement | null = null;
  const install = ctx.install;
  if (install?.canPrompt && !install.isStandalone) {
    const btn = h('button', { type: 'button', class: 'primary' }, 'Install app');
    btn.addEventListener('click', async () => {
      if (await install.prompt()) ctx.toast('GymFree installed.');
      installCard?.remove();
    });
    installCard = h('section', { class: 'card install-card' }, h('span', {}, 'Install GymFree on this device for one-tap access, even offline.'), btn);
  }

  return h(
    'main',
    { class: 'container' },
    installCard,
    h(
      'header',
      { class: 'home-head' },
      h(
        'div',
        {},
        h('h1', {}, state.profile.name ? `Hi, ${state.profile.name}` : 'Your training'),
        h('p', { class: 'muted' }, `${new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · Goal: ${GOAL_PROFILES[state.goal].label}`),
      ),
      h('a', { href: '#/settings', class: 'settings-link', 'aria-label': 'Settings' }, svg('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg('path', { d: GEAR_ICON }))),
    ),
    h('div', { class: 'today-row' }, todayCard, (wheel ??= renderSpinWheel())),
    h(
      'section',
      { class: 'stats', 'aria-label': 'Quick stats' },
      stat('workouts this week', `${workoutsInWeek(state.workouts, today)}/${state.plan.length || state.routine.trainingDays.length}`),
      stat('week streak', weekStreak(state.workouts, today)),
      stat('total workouts', state.workouts.length),
    ),
    calories
      ? h('section', { class: 'card' }, h('h2', {}, 'Daily nutrition estimate'), h('p', {}, `≈ ${calories.target} kcal · ${calories.proteinG} g protein`), h('small', { class: 'muted' }, 'Estimate only; not medical advice.'))
      : null,
    h('section', { class: 'card' }, h('h2', {}, 'Tips for you'), h('ul', { class: 'tips' }, ...routineAdvice(state.goal, state.routine).map((t) => h('li', {}, t)))),
  );
}

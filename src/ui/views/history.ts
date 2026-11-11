import { parseISODate } from '../../core/dates';
import { groupByWeek } from '../../core/history';
import type { WorkoutLog } from '../../core/types';
import { createBatches } from '../batches';
import type { ViewContext } from '../context';
import { h } from '../dom';
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

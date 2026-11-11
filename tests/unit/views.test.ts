import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../../src/ui/app';
import { generatePlan } from '../../src/core/planner';
import { createDefaultState, MAX_WEIGHT_KG } from '../../src/core/state';
import type { DeviceStore } from '../../src/core/store';
import type { AppState, PlanDay } from '../../src/core/types';
import { WEEKDAY_NAMES } from '../../src/core/types';
import { nextPlanDay, renderDashboard } from '../../src/ui/views/dashboard';
import { draftToEntries, lastWeight, readDraft } from '../../src/ui/views/log';
import { canContinue, workoutToDraft } from '../../src/ui/views/history';
import { PHONE_QUERY } from '../../src/ui/device';
import { prescriptionText } from '../../src/ui/views/plan';
import { backupFileName, MAX_BACKUP_BYTES, renderSettings, syncStatusText } from '../../src/ui/views/settings';
import type { InstallManager } from '../../src/pwa/register';
import { BACK_TARGETS } from '../../src/ui/views/exercises';
import { byText, change, check, fakeContext, go, makeApp, onboardedState, settle } from './helpers';

let app: App;
let root: HTMLElement;
let store: DeviceStore;
const state = () => app.currentState as AppState;

beforeEach(async () => {
  ({ app, root, store } = await makeApp(onboardedState()));
});
afterEach(() => vi.restoreAllMocks());

describe('dashboard', () => {
  it('finds the next scheduled plan day', () => {
    const plan = [{ weekday: 1 }, { weekday: 3 }, { weekday: null }] as PlanDay[];
    expect(nextPlanDay(plan, 1)?.inDays).toBe(0);
    expect(nextPlanDay(plan, 2)).toEqual({ day: plan[1], inDays: 1 });
    expect(nextPlanDay(plan, 4)).toEqual({ day: plan[0], inDays: 4 });
    expect(nextPlanDay([{ weekday: null }] as PlanDay[], 4)?.inDays).toBe(0);
    expect(nextPlanDay([], 4)).toBeNull();
  });

  it("shows today's workout (Tuesday) with stats and nutrition", () => {
    expect(root.querySelector('#today-title')?.textContent).toBe("Today's workout");
    expect(byText(root, 'a', 'Start workout').getAttribute('href')).toBe(`#/log/${state().plan[0].id}`);
    expect(root.querySelector('.stats')?.textContent).toContain('0/3');
    expect(root.querySelector(`.highlight button[aria-label="New exercises for ${state().plan[0].name}"]`)).not.toBeNull();
    expect(root.textContent).toContain('kcal');
  });

  it('keeps the roulette as it is when the plan day gets new exercises', async () => {
    const labels = () => [...root.querySelectorAll('.wheel-label')].map((t) => t.textContent).join();
    const before = labels();
    const wheel = root.querySelector('.wheel-card');
    root.querySelector<HTMLButtonElement>(`.highlight button[aria-label="New exercises for ${state().plan[0].name}"]`)!.click();
    await settle(app);
    expect(root.querySelector('.wheel-card')).toBe(wheel);
    expect(labels()).toBe(before);
  });

  it('has a settings gear link on Home', () => {
    const gear = root.querySelector('a.settings-link')!;
    expect(gear.getAttribute('href')).toBe('#/settings');
    expect(gear.getAttribute('aria-label')).toBe('Settings');
  });

  it('offers a different workout under Start, with in-progress badges', () => {
    const s = state();
    const ctx = fakeContext(s);
    ctx.repo.setDraft(s.plan[1].id, { x: 1 });
    const view = renderDashboard(ctx);
    const details = view.querySelector('details.other-workouts')!;
    expect(details.querySelector('summary')?.textContent).toBe('Different workout');
    expect(details.querySelector(`a[href="#/log/${s.plan[0].id}"]`)).toBeNull(); // today's day is the Start button
    for (const d of s.plan.slice(1)) expect(details.querySelector(`a[href="#/log/${d.id}"]`)).not.toBeNull();
    expect(details.querySelector('a[href="#/log/free"]')?.textContent).toContain('Free workout');
    expect(details.querySelector('.badge.in-progress')?.textContent).toBe('Unsaved workout in progress');
    expect(details.querySelectorAll('.badge.in-progress')).toHaveLength(1);
  });

  it('shows an in-progress badge on the Start card when today has a draft', () => {
    const s = state();
    const ctx = fakeContext(s);
    ctx.repo.setDraft(s.plan[0].id, { x: 1 });
    expect(renderDashboard(ctx).querySelector('.highlight .badge.in-progress')).not.toBeNull();
  });

  it('shows rest days, completed days and empty plans', () => {
    const s = onboardedState();
    s.routine.trainingDays = [2];
    s.plan = generatePlan(s.goal, s.routine, s.profile);
    s.profile.age = null;
    const view = renderDashboard(fakeContext(s));
    expect(view.querySelector('#today-title')?.textContent).toMatch(/Rest day/);
    expect(view.textContent).toContain('Tomorrow');
    expect(view.textContent).not.toContain('kcal');
    expect(view.querySelectorAll('details.other-workouts li a')).toHaveLength(s.plan.length + 1); // every day + Free workout
    expect(byText(view, 'summary', 'Different workout')).not.toBeNull();
    expect(view.querySelector('a[href="#/log/free"]')).not.toBeNull();

    const done = onboardedState();
    done.workouts.push({ id: 'w1', date: '2026-10-27', dayId: null, entries: [], durationMin: null, notes: '' });
    expect(renderDashboard(fakeContext(done)).querySelector('#today-title')?.textContent).toMatch(/Done for today/);

    const empty = createDefaultState();
    expect(renderDashboard(fakeContext(empty)).textContent).toContain('No plan yet');

    const later = onboardedState();
    later.routine.trainingDays = [5];
    later.plan = generatePlan(later.goal, later.routine, later.profile);
    expect(renderDashboard(fakeContext(later)).textContent).toContain('On Saturday');
  });
});

describe('plan (read-only)', () => {
  beforeEach(() => go(app, '/plan'));

  it('shows a simple fixed plan with today highlighted and an edit button per day', () => {
    expect(root.querySelector('h1')?.textContent).toBe('My weekly plan');
    const sections = root.querySelectorAll('section.plan-view');
    expect(sections).toHaveLength(3);
    expect([...sections].map((s) => byText(s as HTMLElement, 'a', 'Edit').getAttribute('href'))).toEqual(
      state().plan.map((d) => `#/plan/edit/${d.id}`),
    );
    expect(sections[0].classList.contains('today')).toBe(true);
    expect(sections[0].querySelector('.badge')?.textContent).toBe('Today');
    expect(root.querySelectorAll('input, select')).toHaveLength(0);
    expect(byText(sections[0] as HTMLElement, 'a', 'Start this workout').getAttribute('href')).toBe(`#/log/${state().plan[0].id}`);
    const firstItem = sections[0].querySelector('.exercise-item summary')!;
    expect(firstItem.textContent).toMatch(/sets × .* reps · \d+ s rest/);
  });

  it('expands an exercise in place to show how to do it', () => {
    const details = root.querySelector<HTMLDetailsElement>('.exercise-item')!;
    expect(details.querySelector('.how-to')!.childElementCount).toBe(0);
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    const howTo = details.querySelector('.how-to')!;
    expect(howTo.querySelector('.demo')).not.toBeNull();
    expect(howTo.querySelectorAll('ol li').length).toBeGreaterThan(1);
    const link = byText(howTo as HTMLElement, 'a', 'Open full guide');
    expect(link.getAttribute('href')).toMatch(/\?from=plan$/);
    details.dispatchEvent(new Event('toggle')); // re-toggle doesn't duplicate content
    expect(howTo.querySelectorAll('ol')).toHaveLength(1);
    details.open = false;
    details.dispatchEvent(new Event('toggle'));
    expect(howTo.querySelectorAll('ol')).toHaveLength(1);
  });

  it('shows an empty state and cardio notes', async () => {
    await app['context']().update((s) => {
      s.plan[0].cardioMinutes = 20;
      s.plan[1].weekday = null;
    });
    await go(app, '/plan');
    expect(root.textContent).toContain('+ 20 min cardio');
    expect(root.textContent).toContain('Any day');
    await app['context']().update((s) => (s.plan = []));
    expect(root.textContent).toContain('Your plan is empty');
  });

  it('swaps in new exercises and can undo it', async () => {
    const before = state().plan[0].exercises.map((e) => e.exerciseId);
    const section = root.querySelector('section.plan-view')!;
    section.querySelector<HTMLButtonElement>(`button[aria-label="New exercises for ${state().plan[0].name}"]`)!.click();
    await settle(app);
    const after = state().plan[0].exercises.map((e) => e.exerciseId);
    expect(after).toHaveLength(before.length);
    expect(after).not.toEqual(before);
    // Only the newly arrived rows flip in; kept exercises stay still.
    const rows = [...root.querySelectorAll('section.plan-view')[0].querySelectorAll('.exercise-list > li')];
    expect(rows.map((li) => li.classList.contains('shuffle-in'))).toEqual(after.map((id) => !before.includes(id)));
    expect(root.querySelector('section.plan-view .shuffle-icon.spinning')).not.toBeNull();
    byText(root, '.toast button', 'Undo').click();
    await settle(app);
    expect(state().plan[0].exercises.map((e) => e.exerciseId)).toEqual(before);
  });

  it('hides "New exercises" for days without muscles or exercises', async () => {
    await app['context']().update((s) => (s.plan[0].muscleGroups = []));
    expect(root.querySelectorAll('section.plan-view')[0].textContent).not.toContain('New exercises');
    expect(root.querySelectorAll('section.plan-view')[1].textContent).toContain('New exercises');
  });

  it('formats prescriptions', () => {
    expect(prescriptionText({ exerciseId: 'bench-press', sets: 3, repsMin: 8, repsMax: 12, restSec: 90 })).toBe('3 sets × 8–12 reps · 90 s rest');
    expect(prescriptionText({ exerciseId: 'bench-press', sets: 5, repsMin: 5, repsMax: 5, restSec: 180 })).toBe('5 sets × 5 reps · 180 s rest');
    expect(prescriptionText({ exerciseId: 'plank', sets: 3, repsMin: 30, repsMax: 45, restSec: 30 })).toBe('3 sets × 30–45 s · 30 s rest');
  });
});

describe('day editor', () => {
  beforeEach(() => go(app, `/plan/edit/${state().plan[0].id}`));

  it('edits only the chosen day and has a Done button back to the fixed plan', async () => {
    expect(root.querySelectorAll('.plan-day')).toHaveLength(1);
    expect(byText(root, 'a', 'Done').getAttribute('href')).toBe('#/plan');
    expect(root.querySelector('.plan-day tbody a')?.getAttribute('href')).toMatch(new RegExp(`\\?from=plan-edit:${state().plan[0].id}$`));
    await go(app, `/plan/edit/${state().plan[1].id}`);
    expect(root.querySelector<HTMLInputElement>('.day-name')!.value).toBe(state().plan[1].name);
    await go(app, '/plan/edit/nope');
    expect(root.querySelector('h1')?.textContent).toBe('Day not found');
    await go(app, '/plan/edit');
    expect(root.querySelector('h1')?.textContent).toBe('My weekly plan');
  });

  it('groups the exercise picker under muscle headers', () => {
    check(root.querySelector<HTMLInputElement>('.plan-day input[id^="all-"]')!, true);
    const picker = root.querySelector<HTMLSelectElement>('.plan-day select[aria-label^="Add exercise"]')!;
    const groups = [...picker.querySelectorAll('optgroup')];
    expect(groups.map((g) => g.label)).toEqual(expect.arrayContaining(['Chest', 'Legs', 'Cardio']));
    expect(groups.find((g) => g.label === 'Cardio')!.querySelector('option[value="burpee"]')?.textContent).toBe('Burpee');
  });

  it('keeps the scroll position when an edit re-renders the page', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    change(root.querySelector<HTMLSelectElement>('.plan-day select[aria-label^="Add exercise"]')!, 'burpee');
    check(root.querySelector<HTMLInputElement>('.plan-day input[id^="all-"]')!, true);
    change(root.querySelector<HTMLSelectElement>('.plan-day select[aria-label^="Add exercise"]')!, 'burpee');
    await settle(app);
    expect(state().plan[0].exercises.at(-1)?.exerciseId).toBe('burpee');
    expect(scrollTo).not.toHaveBeenCalled();
    await go(app, '/plan');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('renames a day and changes its weekday', async () => {
    change(root.querySelector<HTMLInputElement>('.day-name')!, '  Chest Day  ');
    await settle(app);
    expect(state().plan[0].name).toBe('  Chest Day  ');
    change(root.querySelector<HTMLInputElement>('.day-name')!, '');
    await settle(app);
    expect(state().plan[0].name).toBe('Workout');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Weekday"]')!, '6');
    await settle(app);
    expect(state().plan[0].weekday).toBe(6);
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Weekday"]')!, '');
    await settle(app);
    expect(state().plan[0].weekday).toBeNull();
  });

  it('toggles muscle groups and suggests matching exercises', async () => {
    const id = state().plan[0].id;
    for (const g of state().plan[0].muscleGroups) check(root.querySelector<HTMLInputElement>(`#m-${id}-${g}`)!, false);
    await settle(app);
    check(root.querySelector<HTMLInputElement>(`#m-${id}-calves`)!, true);
    await settle(app);
    expect(state().plan[0].muscleGroups).toEqual(['calves']);
    byText(root, 'button', 'Suggest exercises for these muscles').click();
    await settle(app);
    expect(state().plan[0].exercises.map((e) => e.exerciseId)).toEqual(['calf-raise']);
  });

  it('suggests a different set when pressed again for the same muscles', async () => {
    const press = async () => {
      byText(root, 'button', 'Suggest exercises for these muscles').click();
      await settle(app);
      return state().plan[0].exercises.map((e) => e.exerciseId).join();
    };
    const first = await press();
    const second = await press();
    expect(second).not.toBe(first);
  });

  it('edits sets, reps and rest with clamping', async () => {
    const card = root.querySelector('.plan-day')!;
    const name = card.querySelector('tbody a')!.textContent;
    change(card.querySelector<HTMLInputElement>(`input[aria-label="Sets for ${name}"]`)!, '99');
    await settle(app);
    expect(state().plan[0].exercises[0].sets).toBe(10);
    change(root.querySelector<HTMLInputElement>(`input[aria-label="Minimum reps for ${name}"]`)!, '20');
    await settle(app);
    expect(state().plan[0].exercises[0]).toMatchObject({ repsMin: 20, repsMax: 20 });
    change(root.querySelector<HTMLInputElement>(`input[aria-label="Maximum reps for ${name}"]`)!, '5');
    await settle(app);
    expect(state().plan[0].exercises[0]).toMatchObject({ repsMin: 5, repsMax: 5 });
    change(root.querySelector<HTMLInputElement>(`input[aria-label="Rest seconds for ${name}"]`)!, '45');
    await settle(app);
    expect(state().plan[0].exercises[0].restSec).toBe(45);
    change(root.querySelector<HTMLInputElement>('input[aria-label="Cardio minutes"]')!, '12');
    await settle(app);
    expect(state().plan[0].cardioMinutes).toBe(12);
  });

  it('reorders, removes and adds exercises', async () => {
    const before = state().plan[0].exercises.map((e) => e.exerciseId);
    root.querySelectorAll<HTMLButtonElement>('.plan-day')[0].querySelectorAll<HTMLButtonElement>('button[aria-label^="Move"]')[1].click();
    await settle(app);
    expect(state().plan[0].exercises.slice(0, 2).map((e) => e.exerciseId)).toEqual([before[1], before[0]]);
    root.querySelector<HTMLButtonElement>('.plan-day button[aria-label^="Remove"]')!.click();
    await settle(app);
    expect(state().plan[0].exercises).toHaveLength(before.length - 1);

    const picker = root.querySelector<HTMLSelectElement>('.plan-day select[aria-label^="Add exercise"]')!;
    const allBox = root.querySelector<HTMLInputElement>('.plan-day input[id^="all-"]')!;
    const filteredCount = picker.options.length;
    check(allBox, true);
    expect(picker.options.length).toBeGreaterThan(filteredCount);
    change(picker, 'burpee');
    await settle(app);
    expect(state().plan[0].exercises.at(-1)?.exerciseId).toBe('burpee');
    change(root.querySelector<HTMLSelectElement>('.plan-day select[aria-label^="Add exercise"]')!, '');
    await settle(app);
    expect(state().plan[0].exercises.at(-1)?.exerciseId).toBe('burpee');
  });

  it('deletes the day and returns to the plan', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    root.querySelector<HTMLButtonElement>('.plan-day button.link.danger')!.click();
    await settle(app);
    expect(state().plan).toHaveLength(3);
    confirmSpy.mockReturnValue(true);
    const id = state().plan[0].id;
    root.querySelector<HTMLButtonElement>('.plan-day button.link.danger')!.click();
    await settle(app);
    expect(state().plan.map((d) => d.id)).not.toContain(id);
    expect(root.querySelector('h1')?.textContent).toBe('My weekly plan');
  });
});

describe('plan actions', () => {
  beforeEach(() => go(app, '/plan'));

  it('adds a day and opens its editor, and regenerates the plan', async () => {
    byText(root, 'button', '+ Add training day').click();
    await settle(app);
    expect(state().plan).toHaveLength(4);
    expect(root.querySelector('h1')?.textContent).toBe('Edit Custom day');
    expect(root.textContent).toContain('No exercises yet.');
    await go(app, '/plan');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const ids = state().plan.map((d) => d.id);
    byText(root, 'button', 'Regenerate the whole plan').click();
    await settle(app);
    expect(state().plan.map((d) => d.id)).toEqual(ids);
    confirmSpy.mockReturnValue(true);
    byText(root, 'button', 'Regenerate the whole plan').click();
    await settle(app);
    expect(state().plan.map((d) => d.id)).not.toEqual(ids);
  });
});

describe('exercise library', () => {
  it('filters by muscle, equipment and search', async () => {
    await go(app, '/exercises');
    const count = () => root.querySelectorAll('.exercise-card').length;
    const total = () => parseInt(root.querySelector('main > p.muted')!.textContent!, 10);
    const mineCount = total();
    check(root.querySelector<HTMLInputElement>('#only-mine')!, false);
    expect(total()).toBeGreaterThan(mineCount);
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Muscle group"]')!, 'biceps');
    expect([...root.querySelectorAll('.exercise-card strong')].map((e) => e.textContent)).toContain('Barbell Curl');
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'zottman preacher';
    search.dispatchEvent(new Event('input'));
    expect(count()).toBe(1);
    expect(root.textContent).toContain('1 exercise');
    expect(root.querySelector('.exercise-card img')).not.toBeNull();
  });

  it('builds cards a batch at a time and starts over when the filter changes', async () => {
    await go(app, '/exercises');
    check(root.querySelector<HTMLInputElement>('#only-mine')!, false);
    const cards = () => root.querySelectorAll('.exercise-card').length;
    const more = root.querySelector<HTMLButtonElement>('.load-more')!;
    expect(cards()).toBe(24);
    more.click();
    expect(cards()).toBe(48);
    expect(more.textContent).toMatch(/Show more \(\d+ left\)/);
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'concentration';
    search.dispatchEvent(new Event('input'));
    expect(cards()).toBeLessThan(24);
    expect(more.hidden).toBe(true);
  });

  it('loads the steps of a library exercise on demand', async () => {
    await go(app, '/exercises/close-grip-ez-bar-curl');
    await vi.waitFor(() => expect(root.querySelectorAll('ol li').length).toBeGreaterThan(1));
    expect(root.textContent).not.toContain('Loading…');
  });

  it('uses photo thumbnails, with the stick figure as fallback', async () => {
    await go(app, '/exercises');
    check(root.querySelector<HTMLInputElement>('#only-mine')!, false);
    const pushUp = byText(root, '.exercise-card', /Push-up/);
    expect(pushUp.querySelector('img')?.getAttribute('src')).toBe('/exercises/push-up-0.webp');
    expect(pushUp.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'burpee';
    search.dispatchEvent(new Event('input'));
    const burpee = byText(root, '.exercise-card', /Burpee/);
    expect(burpee.querySelector('svg.exercise-figure')).not.toBeNull();
    expect(root.textContent).toContain('public domain');
  });

  it('shows details, toggles animation/stop images and adds to a plan day', async () => {
    await go(app, '/exercises/burpee');
    expect(root.querySelector('h1')?.textContent).toBe('Burpee');
    expect(root.querySelectorAll('ol li').length).toBeGreaterThan(1);
    expect(root.querySelector('.demo-large svg.animated')).not.toBeNull();
    const toggle = byText(root, 'button', 'Show still images');
    toggle.click();
    expect(root.querySelector('.demo-large svg.static')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toBe('Play animation');
    toggle.click();
    expect(root.querySelector('.demo-large svg.animated')).not.toBeNull();
    expect(byText(root, 'a', '← All exercises').getAttribute('href')).toBe('#/exercises');
    byText(root, 'button', 'Add to plan').click();
    await settle(app);
    expect(state().plan[0].exercises.some((e) => e.exerciseId === 'burpee')).toBe(true);
    byText(root, 'button', 'Add to plan').click();
    await settle(app);
    expect(state().plan[0].exercises.filter((e) => e.exerciseId === 'burpee')).toHaveLength(1);
    expect(root.querySelector('.toast')?.textContent).toContain('Burpee added');
  });

  it('respects the animations setting', async () => {
    await go(app, '/settings');
    check(root.querySelector<HTMLInputElement>('#animations')!, false);
    await settle(app);
    await go(app, '/exercises/push-up');
    expect(root.querySelector('.demo-large .demo.photo.static')).not.toBeNull();
  });

  it('shows the professional photos as a cross-fade or start/end pair', async () => {
    await go(app, '/exercises/push-up');
    const anim = root.querySelector('.demo-large .demo.photo.animated')!;
    expect([...anim.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['/exercises/push-up-0.webp', '/exercises/push-up-1.webp']);
    byText(root, 'button', 'Show still images').click();
    const still = root.querySelector('.demo-large .demo.photo.static')!;
    expect([...still.querySelectorAll('figcaption')].map((f) => f.textContent)).toEqual(['1. Start', '2. End']);
    expect(still.querySelector('img')?.getAttribute('alt')).toBe('Push-up: start position');
  });

  it('goes back to wherever the user came from', async () => {
    for (const [from, href, label] of [
      ['plan', '#/plan', '← Back to my plan'],
      ['plan-edit:abc', '#/plan/edit/abc', '← Back to editing'],
      ['home', '#/', '← Back to home'],
      ['nonsense', '#/exercises', '← All exercises'],
    ]) {
      await go(app, `/exercises/push-up?from=${from}`);
      expect(byText(root, 'a', label).getAttribute('href')).toBe(href);
    }
    await go(app, '/exercises/nope?from=plan');
    expect(byText(root, 'a', '← Back to my plan')).toBeTruthy();
    expect(BACK_TARGETS.plan[0]).toBe('#/plan');
  });
});

describe('workout logging', () => {
  it('/log redirects home', async () => {
    await go(app, '/log');
    expect(window.location.hash).toBe('#/');
    expect(root.querySelector('.link-card')).toBeNull();
  });

  it('starts each exercise with one empty set and shows targets as hints', async () => {
    const day = state().plan[0];
    await go(app, `/log/${day.id}`);
    expect(root.querySelector('h1')?.textContent).toBe(`${day.weekday === null ? 'Any day' : WEEKDAY_NAMES[day.weekday]}${day.name}`);
    const entries = root.querySelectorAll('.log-entry');
    expect(entries).toHaveLength(day.exercises.length);
    for (const entry of entries) expect(entry.querySelectorAll('.set-row')).toHaveLength(1);
    const first = entries[0];
    const reps = first.querySelector<HTMLInputElement>('input[aria-label$="set 1 reps"]')!;
    expect(reps.value).toBe('');
    expect(reps.placeholder).toBe(`${day.exercises[0].repsMin}–${day.exercises[0].repsMax}`);
    expect(first.textContent).toContain('Target: ');
    expect(first.querySelector('button[aria-label^="Remove set"]')).toBeNull();
  });

  it('shows how to do each exercise inside the log', async () => {
    await go(app, `/log/${state().plan[0].id}`);
    const first = root.querySelector('.log-entry')!;
    const info = first.querySelector<HTMLButtonElement>('button[aria-label^="How to do"]')!;
    expect(first.querySelector('.how-to')!.childElementCount).toBe(0);
    info.click();
    expect(first.querySelector('.how-to .demo')).not.toBeNull();
    expect(first.querySelectorAll('.how-to ol li').length).toBeGreaterThan(1);
    info.click();
    info.click();
    expect(first.querySelectorAll('.how-to ol')).toHaveLength(1);
  });

  it('logs only the sets the user filled in', async () => {
    const day = state().plan[0];
    await go(app, `/log/${day.id}`);
    const first = root.querySelector('.log-entry')!;
    const name = first.querySelector('h2')!.textContent;
    change(first.querySelector<HTMLInputElement>(`input[aria-label="${name} set 1 reps"]`)!, '8');
    change(first.querySelector<HTMLInputElement>(`input[aria-label="${name} set 1 weight (kg)"]`)!, '22.5');
    byText(first as HTMLElement, 'button', '+ Add set').click();
    const again = root.querySelector('.log-entry')!;
    expect(again.querySelectorAll('.set-row')).toHaveLength(2);
    expect(again.querySelector<HTMLInputElement>(`input[aria-label="${name} set 2 reps"]`)!.value).toBe('8');
    change(again.querySelector<HTMLInputElement>(`input[aria-label="${name} set 2 reps"]`)!, '6');
    change(again.querySelector<HTMLInputElement>(`input[aria-label="${name} set 2 weight (kg)"]`)!, '');
    byText(again as HTMLElement, 'button', '+ Add set').click();
    root.querySelector('.log-entry')!.querySelector<HTMLButtonElement>('button[aria-label^="Remove set 3"]')!.click();
    byText(root.querySelectorAll('.log-entry')[1] as HTMLElement, 'button', 'Remove exercise').click();
    expect(root.querySelectorAll('.log-entry')).toHaveLength(day.exercises.length - 1);
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'plank');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'not-real');
    expect(root.querySelectorAll('.log-entry')[day.exercises.length - 1].querySelector('.set-cols span:nth-child(2)')?.textContent).toBe('Seconds');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Plank set 1 seconds"]')!, '45');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Plank set 1 seconds"]')!, '');
    change(root.querySelector<HTMLInputElement>('#log-duration')!, '50');
    root.querySelector<HTMLTextAreaElement>('#log-notes')!.value = 'Felt strong';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);

    expect(window.location.hash).toBe('#/history');
    const log = state().workouts[0];
    expect(typeof log.updatedAt).toBe('string');
    expect(log).toMatchObject({ date: '2026-10-27', dayId: day.id, durationMin: 50, notes: 'Felt strong' });
    expect(log.entries).toEqual([{ exerciseId: day.exercises[0].exerciseId, sets: [{ reps: 8, weightKg: 22.5 }, { reps: 6, weightKg: 0 }] }]);

    // Next time: still empty inputs, but the last weight appears as a hint
    await go(app, `/log/${day.id}`);
    const w = root.querySelector<HTMLInputElement>(`input[aria-label="${name} set 1 weight (kg)"]`)!;
    expect(w.value).toBe('');
    expect(w.placeholder).toBe('22.5');
  });

  it('validates the form', async () => {
    await go(app, '/log/free');
    expect(root.querySelectorAll('.log-entry')).toHaveLength(0);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(root.querySelector('.error')?.textContent).toMatch(/at least one set/);
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'push-up');
    expect(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!.placeholder).toBe('reps');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(root.querySelector('.error')?.textContent).toMatch(/at least one set/);
    change(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '10');
    root.querySelector<HTMLInputElement>('#log-date')!.value = '2030-01-01';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(root.querySelector('.error')?.textContent).toMatch(/valid date/);
    expect(state().workouts).toHaveLength(0);
  });

  it('logs weights entered in pounds as kilograms', async () => {
    await go(app, '/settings');
    check(root.querySelector<HTMLInputElement>('#units-lb')!, true);
    await settle(app);
    await go(app, '/log/free');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'dumbbell-curl');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Dumbbell Biceps Curl set 1 reps"]')!, '10');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Dumbbell Biceps Curl set 1 weight (lb)"]')!, '22.0462');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
    expect(state().workouts[0].entries[0].sets[0].weightKg).toBeCloseTo(10, 2);
  });

  it('keeps an unfinished workout when leaving the page and picks it up again', async () => {
    const day = state().plan[0];
    await go(app, `/log/${day.id}`);
    const firstName = root.querySelector('.log-entry h2')!.textContent!;
    const reps = root.querySelector<HTMLInputElement>(`input[aria-label="${firstName} set 1 reps"]`)!;
    reps.value = '9';
    reps.dispatchEvent(new Event('input', { bubbles: true })); // typed, not yet left the field
    root.querySelector<HTMLTextAreaElement>('#log-notes')!.value = 'felt strong';
    root.querySelector('#log-notes')!.dispatchEvent(new Event('input', { bubbles: true }));

    await go(app, '/');

    await go(app, `/log/${day.id}`);
    expect(root.textContent).toContain('Picked up your unsaved workout from earlier.');
    expect(root.querySelector<HTMLInputElement>(`input[aria-label="${firstName} set 1 reps"]`)!.value).toBe('9');
    expect(root.querySelector<HTMLTextAreaElement>('#log-notes')!.value).toBe('felt strong');

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
    expect(state().workouts.at(-1)?.notes).toBe('felt strong');
    await go(app, `/log/${day.id}`);
    expect(root.textContent).not.toContain('Picked up your unsaved workout');
    expect(root.querySelector<HTMLInputElement>(`input[aria-label="${firstName} set 1 reps"]`)!.value).toBe('');
  });

  it('can discard an unfinished workout', async () => {
    await go(app, '/log/free');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'plank');
    await go(app, '/');
    await go(app, '/log/free');
    expect(root.querySelectorAll('.log-entry')).toHaveLength(1);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    byText(root, 'button', 'Discard and start over').click();
    await settle(app);
    expect(root.querySelectorAll('.log-entry')).toHaveLength(1);
    confirmSpy.mockReturnValue(true);
    byText(root, 'button', 'Discard and start over').click();
    await settle(app);
    expect(root.querySelectorAll('.log-entry')).toHaveLength(0);
    expect(root.textContent).not.toContain('Picked up');
  });

  it('saving goes to History and stamps updatedAt', async () => {
    await go(app, '/log/free');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!, 'push-up');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '5');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
    expect(window.location.hash).toBe('#/history');
    expect(state().workouts.at(-1)?.updatedAt).toEqual(expect.any(String));
  });

  it('a draft with editingId updates that workout instead of adding one', async () => {
    const s = onboardedState();
    s.workouts.push({ id: 'w1', date: '2026-10-20', dayId: null, entries: [{ exerciseId: 'push-up', sets: [{ reps: 3, weightKg: 0 }] }], durationMin: 30, notes: '' });
    const { app: a2, root: r2, repo } = await makeApp(s);
    repo.setDraft('free', { editingId: 'w1', date: '2026-10-20', durationMin: 30, notes: 'edited', entries: [{ exerciseId: 'plank', sets: [{ reps: 1, weightKg: null, seconds: 40 }] }], activeMs: 0, resumedAt: null });
    await go(a2, '/log/free');
    r2.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(a2);
    const ws = a2.currentState!.workouts;
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({ id: 'w1', date: '2026-10-20', notes: 'edited' });
    expect(ws[0].entries[0].exerciseId).toBe('plank');
    expect(ws[0].updatedAt).toEqual(expect.any(String));
    expect(window.location.hash).toBe('#/history');
  });

  it('a draft whose workout no longer exists saves as a new workout', async () => {
    const s = onboardedState();
    s.deletedWorkoutIds = ['w1'];
    const { app: a2, root: r2, repo } = await makeApp(s);
    repo.setDraft('free', { editingId: 'w1', date: '2026-10-20', durationMin: 30, notes: '', entries: [{ exerciseId: 'plank', sets: [{ reps: 1, weightKg: null, seconds: 40 }] }], activeMs: 0, resumedAt: null });
    await go(a2, '/log/free');
    r2.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(a2);
    const ws = a2.currentState!.workouts;
    expect(ws).toHaveLength(1);
    expect(ws[0].id).not.toBe('w1');
  });

  it('keeps editingId in rewritten drafts', async () => {
    const s = onboardedState();
    s.workouts.push({ id: 'w1', date: '2026-10-20', dayId: null, entries: [{ exerciseId: 'push-up', sets: [{ reps: 3, weightKg: 0 }] }], durationMin: null, notes: '' });
    const { app: a2, root: r2, repo } = await makeApp(s);
    repo.setDraft('free', { editingId: 'w1', date: '2026-10-20', durationMin: null, notes: '', entries: [{ exerciseId: 'push-up', sets: [{ reps: 3, weightKg: 0 }] }], activeMs: 0, resumedAt: null });
    await go(a2, '/log/free');
    change(r2.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '9');
    expect((repo.draft('free') as { editingId?: string }).editingId).toBe('w1');
  });

  it('readDraft keeps a valid editingId and drops a bad one', () => {
    expect(readDraft({ entries: [], editingId: 'w1' })!.editingId).toBe('w1');
    expect(readDraft({ entries: [], editingId: 5 })!.editingId).toBeUndefined();
    expect(readDraft({ entries: [], editingId: 'a/b' })!.editingId).toBeUndefined();
  });

  it('readDraft accepts only well-formed drafts', () => {
    expect(readDraft(null)).toBeNull();
    expect(readDraft('x')).toBeNull();
    const d = readDraft({
      entries: [{ exerciseId: 'push-up', sets: [{ reps: 5.4, weightKg: 5000, seconds: 41.6 }, { reps: 'x', seconds: 'slow' }] }, { exerciseId: 'nope', sets: [] }, 'junk'],
      date: '2026-13-01',
      durationMin: -3,
      notes: 'a\u0000b',
    })!;
    expect(d.entries).toEqual([{ exerciseId: 'push-up', sets: [{ reps: 5, weightKg: MAX_WEIGHT_KG, seconds: 42 }, { reps: null, weightKg: null }] }]);
    expect(d.date).toBe('');
    expect(d.durationMin).toBe(0);
    expect(d.notes).toBe('ab');
  });

  it('caps weights at the same limit the saved data uses, and shows the correction', async () => {
    const save = async (units: 'kg' | 'lb', typed: string) => {
      await go(app, '/settings');
      check(root.querySelector<HTMLInputElement>(`#units-${units}`)!, true);
      await settle(app);
      await go(app, '/log/free');
      const picker = root.querySelector<HTMLSelectElement>('select[aria-label="Add exercise"]')!;
      change(picker, 'barbell-squat');
      change(root.querySelector<HTMLInputElement>('input[aria-label="Barbell Back Squat set 1 reps"]')!, '1');
      const weight = root.querySelector<HTMLInputElement>(`input[aria-label="Barbell Back Squat set 1 weight (${units})"]`)!;
      expect(Number(weight.max)).toBe(units === 'kg' ? MAX_WEIGHT_KG : 2204.6);
      change(weight, typed);
      const shown = weight.value;
      const before = new Set(state().workouts.map((w) => w.id));
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(app);
      return { shown, savedKg: state().workouts.find((w) => !before.has(w.id))!.entries[0].sets[0].weightKg };
    };
    expect(await save('kg', '1500')).toEqual({ shown: '1000', savedKg: 1000 });
    const lb = await save('lb', '3000');
    expect(lb.shown).toBe('2204.6');
    expect(lb.savedKg).toBeCloseTo(MAX_WEIGHT_KG, 6);
    const ok = await save('lb', '2000');
    expect(ok.shown).toBe('2000');
    expect(ok.savedKg).toBeCloseTo(907.185, 3);
  });

  it('draftToEntries drops empty sets and exercises', () => {
    expect(draftToEntries([
      { exerciseId: 'push-up', target: null, sets: [{ reps: null, weightKg: 5 }, { reps: 0, weightKg: null }] },
      { exerciseId: 'plank', target: null, sets: [{ reps: 30, weightKg: null }] },
    ])).toEqual([{ exerciseId: 'plank', sets: [{ reps: 30, weightKg: 0 }] }]);
  });

  it('lastWeight returns the most recent weight', () => {
    const s = onboardedState();
    s.workouts = [
      { id: 'a', date: '2026-10-01', dayId: null, entries: [{ exerciseId: 'push-up', sets: [{ reps: 5, weightKg: 10 }] }], durationMin: null, notes: '' },
      { id: 'b', date: '2026-10-05', dayId: null, entries: [{ exerciseId: 'push-up', sets: [{ reps: 5, weightKg: 15 }, { reps: 5, weightKg: 12 }] }], durationMin: null, notes: '' },
    ];
    expect(lastWeight(s.workouts, 'push-up')).toBe(15);
    expect(lastWeight(s.workouts, 'plank')).toBe(0);
  });
});

describe('history', () => {
  const ex = (exerciseId: string, sets: { reps: number; weightKg: number; seconds?: number }[]) => ({ exerciseId, sets });
  async function seed() {
    await app['context']().update((s) => {
      s.workouts = [
        { id: 'w0', date: '2026-10-08', dayId: null, entries: [ex('push-up', [{ reps: 12, weightKg: 0 }])], durationMin: null, notes: '' },
        { id: 'w1', date: '2026-10-20', dayId: s.plan[0].id, entries: [ex('dumbbell-curl', [{ reps: 10, weightKg: 10 }]), ex('push-up', [{ reps: 15, weightKg: 0 }])], durationMin: 48, notes: '' },
        { id: 'w2', date: '2026-10-27', dayId: null, entries: [ex('dumbbell-curl', [{ reps: 10, weightKg: 12 }])], durationMin: null, notes: '' },
      ];
    });
    await go(app, '/history');
  }

  it('groups workouts by week with rows for each', async () => {
    await seed();
    expect(root.querySelector('main h1')?.textContent).toBe('History');
    expect([...root.querySelectorAll('h2.history-week')].map((e) => e.textContent)).toEqual([
      'This week · 1 workout',
      'Last week · 1 workout',
      'Week of 5 Oct · 1 workout',
    ]);
    const rows = [...root.querySelectorAll<HTMLAnchorElement>('a.history-row')];
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['#/history/w2', '#/history/w1', '#/history/w0']);
    expect(rows[0].textContent).toContain('Free workout');
    expect(rows[0].textContent).toContain('Tue 27 Oct');
    expect(rows[0].textContent).toContain('1 ex');
    expect(rows[0].textContent).not.toContain('min');
    expect(rows[1].textContent).toContain(state().plan[0].name);
    expect(rows[1].textContent).toContain('Tue 20 Oct');
    expect(rows[1].textContent).toContain('48 min');
    expect(rows[1].textContent).toContain('2 ex');
  });

  it('has Workouts and Stats tabs', async () => {
    await seed();
    const tabs = () => [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="History view"].segmented a')];
    expect(root.querySelector('[role="tab"], [role="tablist"]')).toBeNull();
    expect(tabs().map((t) => [t.getAttribute('href'), t.getAttribute('aria-current')])).toEqual([['#/history', 'page'], ['#/history?view=stats', null]]);
    await go(app, '/history?view=stats');
    expect(tabs().map((t) => t.getAttribute('aria-current'))).toEqual([null, 'page']);
  });

  it('shows an empty state with a link home', async () => {
    await go(app, '/history');
    expect(root.textContent).toContain('No workouts yet.');
    expect(byText<HTMLAnchorElement>(root, 'a', 'Home').getAttribute('href')).toBe('#/');
  });

  it('reaches every workout in a long history, a batch at a time', async () => {
    await seed();
    const log = state().workouts[0];
    await app['context']().update((s) => {
      s.workouts = Array.from({ length: 65 }, (_, i) => ({ ...log, id: `w${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    });
    await go(app, '/history');
    const rows = () => root.querySelectorAll('a.history-row').length;
    const more = root.querySelector<HTMLButtonElement>('.load-more')!;
    expect(rows()).toBe(20);
    for (let i = 0; i < 3; i++) more.click();
    expect(rows()).toBe(65);
    expect(more.hidden).toBe(true);
  });

  it('redirects /progress to the Stats tab', async () => {
    await go(app, '/progress');
    expect(window.location.hash).toBe('#/history?view=stats');
    expect(root.querySelector('.segmented a[aria-current="page"]')?.textContent).toBe('Stats');
  });

  it('shows stats, a volume bar chart, records and muscle group bars', async () => {
    await seed();
    await go(app, '/history?view=stats');
    expect(root.querySelector('.stats')?.textContent).toContain('3total workouts');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Exercise to chart"]')!, 'dumbbell-curl');
    expect(root.querySelector('svg.chart')?.getAttribute('aria-label')).toBe('Dumbbell Biceps Curl: volume per session');
    expect(root.querySelectorAll('svg.chart rect.bar')).toHaveLength(2);
    expect(root.querySelector('svg.chart title')?.textContent).toBe('2026-10-20: 100 kg');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Exercise to chart"]')!, 'push-up');
    expect(root.querySelector('svg.chart')?.getAttribute('aria-label')).toBe('Push-up: volume per session');
    expect(root.querySelectorAll('svg.chart rect.bar')).toHaveLength(2);
    expect(root.querySelector('svg.chart title')?.textContent).toBe('2026-10-08: 12 reps');
    expect(root.textContent).toContain('Personal records');
    expect(root.querySelectorAll('.bars li')).toHaveLength(2);
    expect(root.querySelector('#bw-value')).not.toBeNull();
    expect(root.querySelector('.history-row')).toBeNull();
  });

  it('charts volume in pounds for lb users', async () => {
    await seed();
    await app['context']().update((s) => (s.settings.units = 'lb'));
    await go(app, '/history?view=stats');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Exercise to chart"]')!, 'dumbbell-curl');
    expect(root.querySelector('svg.chart title')?.textContent).toBe('2026-10-20: 220.5 lb');
  });

  it('charts seconds per rep where sets were timed', async () => {
    await seed();
    await app['context']().update((s) => {
      s.workouts[1].entries[0].sets = [{ reps: 10, weightKg: 10, seconds: 30 }];
      s.workouts[2].entries[0].sets = [{ reps: 10, weightKg: 12, seconds: 25 }, { reps: 8, weightKg: 12 }];
    });
    await go(app, '/history?view=stats');
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Exercise to chart"]')!, 'dumbbell-curl');
    const sel = root.querySelector<HTMLSelectElement>('select[aria-label="What to chart"]')!;
    expect(sel.hidden).toBe(false);
    change(sel, 'pace');
    expect(root.querySelector('svg.chart')?.getAttribute('aria-label')).toBe('Dumbbell Biceps Curl: seconds per rep');
    expect([...root.querySelectorAll('.chart title')].map((t) => t.textContent)).toEqual(['2026-10-20: 3 s per rep', '2026-10-27: 2.5 s per rep']);
    change(root.querySelector<HTMLSelectElement>('select[aria-label="Exercise to chart"]')!, 'push-up');
    expect(sel.hidden).toBe(true);
  });

  // Deleting a workout moved to its detail page (Task 7 adds the test there).

  it('records body weight and validates it', async () => {
    await go(app, '/history?view=stats');
    expect(root.textContent).toContain('Log a workout to see your progress here.');
    const form = () => root.querySelector<HTMLFormElement>('#bw-value')!.form!;
    root.querySelector<HTMLInputElement>('#bw-value')!.value = '';
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    expect(root.textContent).toContain('Enter a valid date and weight.');
    root.querySelector<HTMLInputElement>('#bw-value')!.value = '5';
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    expect(root.textContent).toContain('out of range');
    root.querySelector<HTMLInputElement>('#bw-value')!.value = '71.2';
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
    root.querySelector<HTMLInputElement>('#bw-date')!.value = '2026-10-01';
    root.querySelector<HTMLInputElement>('#bw-value')!.value = '73';
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
    expect(state().bodyLogs).toEqual([{ date: '2026-10-01', weightKg: 73 }, { date: '2026-10-27', weightKg: 71.2 }]);
    expect(state().profile.weightKg).toBe(71.2);
    expect(root.textContent).toContain('change since 2026-10-01: -1.8 kg');
  });
});

describe('workout detail and edit', () => {
  const ex = (exerciseId: string, sets: { reps: number; weightKg: number; seconds?: number }[]) => ({ exerciseId, sets });
  async function seed() {
    await app['context']().update((s) => {
      s.workouts = [
        { id: 'w1', date: '2026-10-20', dayId: s.plan[0].id, entries: [ex('dumbbell-curl', [{ reps: 10, weightKg: 40 }, { reps: 8, weightKg: 42.5 }]), ex('push-up', [{ reps: 15, weightKg: 0 }]), ex('plank', [{ reps: 45, weightKg: 0 }])], durationMin: 48, notes: 'Felt strong' },
        { id: 'w2', date: '2026-10-27', dayId: null, entries: [ex('push-up', [{ reps: 12, weightKg: 0, seconds: 30 }])], durationMin: null, notes: '' },
      ];
    });
  }
  const submit = async () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(app);
  };

  it('detail shows title, meta, chips, one line per exercise and notes', async () => {
    await seed();
    await go(app, '/history/w1');
    expect(root.querySelector('main a[href="#/history"]')?.textContent).toBe('‹ History');
    expect(byText(root, 'a', 'Edit').getAttribute('href')).toBe('#/history/w1/edit');
    expect(root.querySelector('h1')?.textContent).toBe(state().plan[0].name);
    expect(root.querySelector('.detail-meta')?.textContent).toBe('Tue 20 Oct · 48 min');
    expect([...root.querySelectorAll('.chip')].map((c) => c.textContent)).toEqual(['3 exercises', '4 sets', '740 kg']);
    const lines = [...root.querySelectorAll('.detail-exercise')].map((l) => l.textContent);
    expect(lines).toEqual(['Dumbbell Biceps Curl10 × 40 · 8 × 42.5 kg', 'Push-up15', 'Plank45 s']);
    expect(root.textContent).toContain('Felt strong');
    await go(app, '/history/w2');
    expect(root.querySelector('h1')?.textContent).toBe('Free workout');
    expect(root.querySelector('.detail-meta')?.textContent).toBe('Tue 27 Oct');
  });

  it('edits a set and saves: same id, updatedAt set, count unchanged', async () => {
    await seed();
    await go(app, '/history/w1/edit');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '20');
    await submit();
    const ws = state().workouts;
    expect(ws).toHaveLength(2);
    const w = ws.find((x) => x.id === 'w1')!;
    expect(w.entries[1].sets[0].reps).toBe(20);
    expect(w.updatedAt).toEqual(expect.any(String));
    expect(w.notes).toBe('Felt strong');
    expect(w.dayId).toBe(state().plan[0].id);
    expect(window.location.hash).toBe('#/history/w1');
  });

  it('saving an edit of a workout deleted meanwhile adds a new workout, not the old id', async () => {
    await seed();
    await go(app, '/history/w1/edit');
    await app['context']().update((s) => {
      s.workouts = s.workouts.filter((w) => w.id !== 'w1');
      s.deletedWorkoutIds.push('w1');
    }, { render: false });
    await submit();
    const ids = state().workouts.map((w) => w.id);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain('w1');
    expect(ids).toContain('w2');
    const fresh = ids.find((id) => id !== 'w2')!;
    expect(window.location.hash).toBe(`#/history/${fresh}`);
  });

  describe('continue this workout', () => {
    const today = '2026-10-27';
    const mk = (over: Partial<import('../../src/core/types').WorkoutLog> = {}) => {
      const d = state().plan[0];
      return { id: 'c1', date: today, dayId: d.id, entries: [ex(d.exercises[0].exerciseId, [{ reps: 5, weightKg: 0 }])], durationMin: 12, notes: 'n', ...over };
    };
    const phone = (on: boolean) => {
      window.matchMedia = vi.fn((q: string) => ({ matches: q === PHONE_QUERY && on })) as unknown as typeof window.matchMedia;
    };
    afterEach(() => {
      vi.restoreAllMocks();
      window.matchMedia = undefined as unknown as typeof window.matchMedia;
    });

    it('canContinue: only today, a plan day, and exercises still in the day', () => {
      const plan = state().plan;
      expect(canContinue(mk(), plan, today)).toBe(true);
      expect(canContinue(mk({ date: '2026-10-26' }), plan, today)).toBe(false);
      expect(canContinue(mk({ dayId: null }), plan, today)).toBe(false);
      expect(canContinue(mk({ dayId: 'gone' }), plan, today)).toBe(false);
      expect(canContinue(mk({ entries: [ex('not-in-day', [{ reps: 1, weightKg: 0 }])] }), plan, today)).toBe(false);
    });

    it('workoutToDraft carries the workout and its id', () => {
      expect(workoutToDraft(mk())).toMatchObject({ date: today, durationMin: null, notes: 'n', activeMs: 720_000, resumedAt: null, editingId: 'c1' });
    });

    it('shows the button only on a phone and only when continuable', async () => {
      await app['context']().update((s) => {
        s.workouts = [mk(), mk({ id: 'c2', date: '2026-10-20' })];
      });
      phone(true);
      await go(app, '/history/c1');
      expect(root.textContent).toContain('Continue this workout');
      await go(app, '/history/c2');
      expect(root.textContent).not.toContain('Continue this workout');
      phone(false);
      await go(app, '/history/c1');
      expect(root.textContent).not.toContain('Continue this workout');
    });

    it('asks before replacing another unsaved session, then opens workout mode', async () => {
      await app['context']().update((s) => {
        s.workouts = [mk()];
      });
      phone(true);
      const dayId = state().plan[0].id;
      app['repo'].setDraft(dayId, { entries: [], date: '', durationMin: null, notes: 'other', activeMs: 0, resumedAt: null });
      await go(app, '/history/c1');
      const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      byText(root, 'button.primary', 'Continue this workout').click();
      await settle(app);
      expect(spy).toHaveBeenCalledWith('Replace your unsaved session?');
      expect((app['repo'].draft(dayId) as { notes: string }).notes).toBe('other');
      byText(root, 'button.primary', 'Continue this workout').click();
      await settle(app);
      expect((app['repo'].draft(dayId) as { editingId: string }).editingId).toBe('c1');
      expect(window.location.hash).toBe(`#/workout/${dayId}`);
    });
  });

  it('Cancel links back to the detail page and leaves the workout unchanged', async () => {
    await seed();
    await go(app, '/history/w1/edit');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '99');
    expect(byText(root, 'a', 'Cancel').getAttribute('href')).toBe('#/history/w1');
    await go(app, '/history/w1');
    expect(state().workouts.find((x) => x.id === 'w1')!.entries[1].sets[0].reps).toBe(15);
    expect(state().workouts.find((x) => x.id === 'w1')!.updatedAt).toBeUndefined();
  });

  it('refuses to save with no reps left, with the entry screen message', async () => {
    await seed();
    await go(app, '/history/w2/edit');
    change(root.querySelector<HTMLInputElement>('input[aria-label="Push-up set 1 reps"]')!, '');
    await submit();
    expect(root.querySelector('p[role="alert"]')?.textContent).toBe('Enter the reps (or seconds) for at least one set before saving.');
    expect(state().workouts.find((x) => x.id === 'w2')!.updatedAt).toBeUndefined();
    expect(state().workouts.find((x) => x.id === 'w2')!.entries[0].sets[0].reps).toBe(12);
    expect(window.location.hash).toBe('#/history/w2/edit');
  });

  it('refuses a future date', async () => {
    await seed();
    await go(app, '/history/w2/edit');
    change(root.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-12-31');
    await submit();
    expect(root.querySelector('p[role="alert"]')?.textContent).toBe('Please choose a valid date (not in the future).');
  });

  it('keeps seconds when reps are untouched', async () => {
    await seed();
    await go(app, '/history/w2/edit');
    await submit();
    expect(state().workouts.find((x) => x.id === 'w2')!.entries[0].sets[0]).toEqual({ reps: 12, weightKg: 0, seconds: 30 });
  });

  it('deletes a workout after confirmation', async () => {
    await seed();
    await go(app, '/history/w1/edit');
    const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const del = byText(root, 'button.danger', 'Delete this workout');
    del.click();
    await settle(app);
    expect(state().workouts).toHaveLength(2);
    del.click();
    await settle(app);
    expect(spy).toHaveBeenLastCalledWith('Delete this workout? This can’t be undone.');
    expect(state().workouts.map((w) => w.id)).toEqual(['w2']);
    expect(state().deletedWorkoutIds).toContain('w1');
    expect(window.location.hash).toBe('#/history');
  });

  it('shows not-found for ids that no longer exist', async () => {
    for (const p of ['/history/nope', '/history/nope/edit']) {
      await go(app, p);
      expect(root.textContent).toMatch(/page not found/i);
    }
  });
});

describe('settings', () => {
  beforeEach(() => go(app, '/settings'));

  it('changes preferences and has no lock or passphrase settings', async () => {
    check(root.querySelector<HTMLInputElement>('#units-lb')!, true);
    await settle(app);
    expect(state().settings.units).toBe('lb');
    expect(store.read('local')?.state.settings.units).toBe('lb');
    expect(root.querySelector('#auto-lock')).toBeNull();
    // Sound alerts: a per-device choice, not part of the synced data
    const sounds = root.querySelector<HTMLInputElement>('#sounds')!;
    expect(sounds.checked).toBe(true); // this test browser cannot vibrate
    expect(root.textContent).toContain('sound is the only alert');
    check(sounds, false);
    expect(localStorage.getItem('gymx:sounds')).toBe('off');
    expect(JSON.stringify(state())).not.toContain('sound');
    expect(root.textContent).not.toMatch(/passphrase|Lock now|encrypt/i);
  });

  it('shows local-mode account info without sign-in when Supabase is not configured', () => {
    expect(root.textContent).toContain('Your data is stored on this device only.');
    expect(() => byText(root, 'button', 'Sign in with Google to sync')).toThrow();
  });

  it('describes every sync status', () => {
    expect(syncStatusText('synced')).toMatch(/saved to your account/);
    expect(syncStatusText('saving')).toBe('Saving…');
    expect(syncStatusText('offline')).toMatch(/back online/);
    expect(syncStatusText('local')).toMatch(/this device only/);
    expect(syncStatusText('error', 'permission denied')).toBe("Couldn't save to your account: permission denied. Your changes are kept on this device and will be retried.");
  });

  it('exports a plain backup file', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    byText(root, 'button', 'Download backup').click();
    await settle(app);
    expect(clicks).toEqual(['gym-backup-2026-10-27.json']);
    expect(backupFileName('2026-10-27')).toBe('gym-backup-2026-10-27.json');
    const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
    expect(JSON.parse(await blob.text())).toMatchObject({ version: 1, profile: { name: 'Alex' } });
  });

  it('restores a backup file', async () => {
    const restored = onboardedState();
    restored.profile.name = 'Restored';
    const backup = JSON.stringify(restored);
    const fileInput = root.querySelector<HTMLInputElement>('#import-file')!;
    const submit = () => fileInput.form!.dispatchEvent(new Event('submit', { cancelable: true }));
    const setFile = (f: File) => Object.defineProperty(fileInput, 'files', { value: [f], configurable: true });

    submit();
    expect(root.textContent).toContain('Choose a backup file.');
    setFile(new File(['x'], 'big.json'));
    Object.defineProperty(fileInput.files![0], 'size', { value: MAX_BACKUP_BYTES + 1 });
    submit();
    expect(root.textContent).toContain('too large');

    setFile(new File(['{"not":"a backup"}'], 'x.json'));
    submit();
    await settle(app);
    expect(root.textContent).toContain('That file is not a GymFree backup.');

    setFile(new File([backup], 'backup.json'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    submit();
    await settle(app);
    expect(state().profile.name).toBe('Alex');

    confirmSpy.mockReturnValue(true);
    submit();
    await settle(app);
    expect(state().profile.name).toBe('Restored');
    expect(window.location.hash).toBe('#/');
    expect(store.read('local')?.state.profile.name).toBe('Restored');
  });

  it('deletes all data only after typing DELETE', async () => {
    byText(root, 'button', 'Delete all my data').click();
    await settle(app);
    expect(store.read('local')).not.toBeNull();
    expect(root.querySelector('.toast')?.textContent).toBe('Type DELETE to confirm.');
    root.querySelector<HTMLInputElement>('#delete-confirm')!.value = 'DELETE';
    byText(root, 'button', 'Delete all my data').click();
    await settle(app);
    expect(store.read('local')).toBeNull();
    expect(app.currentState).toBeNull();
    expect(root.querySelector('h1')?.textContent).toBe('Your gym plan, built around your week.');
  });

  it('reports a failed delete instead of going back to the start', async () => {
    const destroy = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });
    const ctx = fakeContext(onboardedState(), { destroy });
    const view = renderSettings(ctx);
    view.querySelector<HTMLInputElement>('#delete-confirm')!.value = 'DELETE';
    byText(view, 'button', 'Delete all my data').click();
    await settle();
    expect(ctx.toast).toHaveBeenCalledWith('Could not delete your account data. Check your connection and try again.');
  });
});

describe('install & offline UI', () => {
  function manager(over: Partial<InstallManager>) {
    return { canPrompt: false, isStandalone: false, isIos: false, installed: false, prompt: vi.fn(async () => true), subscribe: vi.fn(), ...over } as unknown as InstallManager;
  }

  it('shows an install card on the dashboard when the browser offers it', async () => {
    const install = manager({ canPrompt: true });
    const ctx = fakeContext(onboardedState(), { install });
    const view = renderDashboard(ctx);
    const btn = byText(view, 'button', 'Install app');
    btn.click();
    await settle();
    expect(install.prompt).toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('GymFree installed.');
    expect(view.querySelector('.install-card')).toBeNull();
    expect(renderDashboard(fakeContext(onboardedState(), { install: manager({ canPrompt: true, isStandalone: true }) })).querySelector('.install-card')).toBeNull();
    expect(renderDashboard(fakeContext(onboardedState())).querySelector('.install-card')).toBeNull();
  });

  it('explains how to install in settings for each platform', async () => {
    const cases: [Partial<InstallManager> | undefined, RegExp][] = [
      [{ isStandalone: true }, /Installed/],
      [{ installed: true }, /Installed/],
      [{ isIos: true }, /Add to Home Screen/],
      [{}, /browser menu/],
      [undefined, /browser menu/],
    ];
    for (const [over, text] of cases) {
      const view = renderSettings(fakeContext(onboardedState(), { install: over ? manager(over) : undefined }));
      expect(view.textContent).toMatch(text);
    }
    const install = manager({ canPrompt: true, prompt: vi.fn(async () => false) });
    const ctx = fakeContext(onboardedState(), { install });
    byText(renderSettings(ctx), 'button', 'Install GymFree').click();
    await settle();
    expect(install.prompt).toHaveBeenCalled();
    expect(ctx.toast).not.toHaveBeenCalled();
  });
});

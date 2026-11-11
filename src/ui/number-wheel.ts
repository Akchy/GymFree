/**
 * Scroll-wheel number field: flick the wheel up or down and the middle row is the value,
 * with a tick sound (and on phones a tiny buzz) for each value that passes the middle.
 * On phones the wheel is the only way in: nothing on it can be tapped or selected and no
 * keyboard opens. Elsewhere, click the middle row to type, the row above or below to step to
 * it, and ↑ / ↓ step from the keyboard.
 *
 * Scrolling is the browser's own (momentum and all), so it behaves like any list on the
 * device. Only the rows near the middle are drawn, so a 0–1000 range costs a dozen nodes.
 *
 * The input stays a real <input type="number"> on top of the middle row, so forms, labels
 * and screen readers work as before. Turning the wheel fires `input` per value and one
 * `change` when it comes to rest, so a listener that re-renders on `change` does not rebuild
 * the wheel mid-turn.
 */
import { tick, unlockTicks } from './alerts';
import { isPhone } from './device';
import { h } from './dom';

/** Row height in px (keep in step with .num-wheel in styles.css). */
export const ROW_PX = 34;
/** Rows drawn each side of the middle. */
const DRAWN = 3;
/** Quiet time after the last scroll event that counts as the wheel coming to rest. */
const SETTLE_MS = 140;
/** Most rows a wheel offers when the field has no max. */
const MAX_ROWS = 2000;

const round = (n: number) => Math.round(n * 1000) / 1000;

function bounds(input: HTMLInputElement): { min: number; max: number } {
  const read = (attr: string, fallback: number) => (input.getAttribute(attr) ? Number(input.getAttribute(attr)) : fallback);
  return { min: read('min', -Infinity), max: read('max', Infinity) };
}

/** The value a step starts from: what is typed, else the hint ("8–12" → 8), else min (or 0). */
function startValue(input: HTMLInputElement): number {
  const { min } = bounds(input);
  if (input.value !== '') return Number(input.value);
  const hint = Number.parseFloat(input.placeholder);
  return Number.isFinite(hint) ? hint : Number.isFinite(min) ? min : 0;
}

/**
 * `steps` steps of `by` from the current value, on the step grid (with step 2.5, 7.3 goes up
 * to 7.5 and down to 5), clamped to min/max. From an empty field the first step up fills the hint.
 */
export function stepValue(input: HTMLInputElement, by: number, steps: number): number {
  const { min, max } = bounds(input);
  const start = startValue(input);
  let next: number;
  if (input.value === '' && steps > 0 && start > 0) next = start + (steps - 1) * by;
  else next = (steps > 0 ? Math.floor(start / by + 1e-9) + steps : Math.ceil(start / by - 1e-9) + steps) * by;
  return round(Math.min(max, Math.max(min, next)));
}

/** The values a wheel offers: from min (on the step grid) to max, `by` apart. */
export function wheelRange(input: HTMLInputElement, by: number): { base: number; count: number } {
  const { min, max } = bounds(input);
  const base = Number.isFinite(min) ? round(Math.ceil(min / by - 1e-9) * by) + 0 : 0; // + 0: no -0
  const count = Number.isFinite(max) ? Math.min(MAX_ROWS, Math.floor((max - base) / by + 1e-9) + 1) : MAX_ROWS;
  return { base, count: Math.max(1, count) };
}

/**
 * Turns a number input into a scroll wheel. Rows are `by` apart (the input's numeric `step`,
 * or `step` here) from min to max; an empty field rests on its hint, greyed, until turned.
 */
export function numberWheel(input: HTMLInputElement, step?: number): HTMLElement {
  const by = step ?? (Number(input.step) || 1);
  const { base, count } = wheelRange(input, by);
  const valueAt = (i: number) => round(base + i * by);
  const indexOf = (v: number) => Math.max(0, Math.min(count - 1, Math.round((v - base) / by)));

  const track = h('div', { class: 'num-wheel-track' });
  track.style.height = `${(count + 2) * ROW_PX}px`; // a blank row above the first and below the last
  const rows = Array.from({ length: DRAWN * 2 + 3 }, () => track.appendChild(h('span', { class: 'num-wheel-row' })));
  const scroller = h('div', { class: 'num-wheel-scroll', 'aria-hidden': 'true' }, track);
  const phone = isPhone();
  // On a phone the field never opens the keyboard (not even from its label): turn the wheel.
  if (phone) input.setAttribute('inputmode', 'none');
  const wrap = h(
    'span',
    { class: `num-wheel${input.classList.contains('num') ? ' compact' : ''}${phone ? ' touch' : ''}` },
    h('span', { class: 'num-wheel-band', 'aria-hidden': 'true' }),
    scroller,
    input,
  );

  /** The row in the middle, as last seen or set. */
  let at = indexOf(startValue(input));
  /** The field's value when the current turn began (null: not turning). */
  let turnFrom: string | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let lastScrollAt = 0;
  /** Set while we fire events ourselves, so our own `input` listener ignores them. */
  let emitting = false;

  const emit = (type: 'input' | 'change') => {
    emitting = true;
    try {
      input.dispatchEvent(new Event(type, { bubbles: true }));
    } finally {
      emitting = false;
    }
  };

  const draw = () => {
    const pos = scroller.scrollTop / ROW_PX;
    const first = Math.max(0, Math.floor(pos) - DRAWN);
    const typed = input.value === '' ? null : Number(input.value);
    wrap.classList.toggle('empty', input.value === '');
    rows.forEach((row, k) => {
      const i = first + k;
      if (i >= count) return void (row.hidden = true);
      row.hidden = false;
      // Positioned through el.style: the Content-Security-Policy blocks style="" attributes.
      row.style.top = `${(i + 1) * ROW_PX}px`;
      row.style.opacity = String(Math.max(0.2, 1 - Math.abs(i - pos) * 0.4));
      // A typed value off the step grid (7.3 with steps of 2.5) shows as typed.
      row.textContent = i === at && typed !== null && typed !== valueAt(i) ? String(typed) : String(valueAt(i));
      row.classList.toggle('on', i === at);
    });
  };

  const scrollToRow = (i: number, smooth: boolean) => {
    const top = i * ROW_PX;
    if (smooth && typeof scroller.scrollTo === 'function') scroller.scrollTo({ top, behavior: 'smooth' });
    else scroller.scrollTop = top;
    draw();
  };

  /** Moves the wheel to show the field's value, without firing anything. */
  const sync = () => {
    at = indexOf(startValue(input));
    scrollToRow(at, false);
  };

  const settle = () => {
    clearTimeout(settleTimer);
    const i = Math.max(0, Math.min(count - 1, Math.round(scroller.scrollTop / ROW_PX)));
    if (Math.abs(scroller.scrollTop - i * ROW_PX) > 1) scrollToRow(i, true); // snap onto the row
    if (turnFrom !== null && input.value !== turnFrom) emit('change');
    turnFrom = null;
  };

  scroller.addEventListener('scroll', () => {
    lastScrollAt = Date.now();
    const i = Math.max(0, Math.min(count - 1, Math.round(scroller.scrollTop / ROW_PX)));
    if (i !== at) {
      turnFrom ??= input.value;
      const dir = i > at ? 1 : -1;
      at = i;
      input.value = String(valueAt(i));
      tick(dir, true);
      emit('input');
    }
    draw();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
  });
  scroller.addEventListener('scrollend', settle);
  // Sound may only start after a touch: get it ready as a turn begins.
  wrap.addEventListener('pointerdown', () => unlockTicks());

  // Click the middle row to type; the row above or below to step to it (not on phones).
  scroller.addEventListener('click', (e) => {
    if (phone || Date.now() - lastScrollAt < 250 || input.disabled) return; // or the end of a flick
    const row = Math.floor((e.clientY - scroller.getBoundingClientRect().top) / ROW_PX);
    if (row === 1 || !Number.isFinite(row)) {
      input.focus();
      input.select();
    } else {
      unlockTicks();
      scrollToRow(Math.max(0, Math.min(count - 1, at + (row < 1 ? -1 : 1))), true);
    }
  });

  // ↑ / ↓ step by our step (not the browser's, which is 1 for step="any") and tick.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const dir = e.key === 'ArrowUp' ? 1 : -1;
    unlockTicks();
    const next = stepValue(input, by, dir);
    if (String(next) === input.value) return;
    input.value = String(next);
    tick(dir);
    emit('input');
    emit('change');
    sync();
  });
  // Typing (or a value set from outside) moves the wheel to match.
  input.addEventListener('input', () => !emitting && sync());
  input.addEventListener('change', () => !emitting && sync());

  // The wheel can only be scrolled once it is on screen with a size: place it then (and
  // again if it was hidden, e.g. inside a closed <details>).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => scroller.clientHeight > 0 && Math.round(scroller.scrollTop / ROW_PX) !== at && scrollToRow(at, false)).observe(scroller);
  }
  sync();
  return wrap;
}

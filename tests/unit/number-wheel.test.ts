import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTicks } from '../../src/ui/alerts';
import { field, h } from '../../src/ui/dom';
import { numberWheel, ROW_PX, stepValue, wheelRange } from '../../src/ui/number-wheel';

function make(attrs: Record<string, string | number> = {}, step?: number) {
  const input = h('input', { type: 'number', 'aria-label': 'reps', ...attrs });
  const onInput = vi.fn();
  const onChange = vi.fn();
  input.addEventListener('input', onInput);
  input.addEventListener('change', onChange);
  const wrap = numberWheel(input, step);
  document.body.appendChild(wrap);
  const scroller = wrap.querySelector<HTMLElement>('.num-wheel-scroll')!;
  // jsdom has no layout: give the scroller a plain scrollTop and scroll it by hand.
  let top = 0;
  Object.defineProperty(scroller, 'scrollTop', { get: () => top, set: (v: number) => (top = v), configurable: true });
  input.dispatchEvent(new Event('change')); // re-place the wheel on the field's value
  onChange.mockClear();
  const scrollTo = (row: number) => {
    top = row * ROW_PX;
    scroller.dispatchEvent(new Event('scroll'));
  };
  const middle = () => wrap.querySelector('.num-wheel-row.on')?.textContent;
  return { input, wrap, scroller, scrollTo, middle, onInput, onChange, top: () => top };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  localStorage.clear();
});

describe('number wheel', () => {
  it('wraps a real, labelled input over the middle row', () => {
    const { wrap, input } = make();
    expect(wrap.classList.contains('num-wheel')).toBe(true);
    expect(wrap.contains(input)).toBe(true);
    expect(wrap.querySelector('.num-wheel-scroll')!.getAttribute('aria-hidden')).toBe('true');
    const f = field('Age', wrap);
    expect(f.querySelector('label')!.htmlFor).toBe(input.id);
  });

  it('offers min to max on the step grid', () => {
    const input = h('input', { type: 'number', min: 0, max: 300 });
    expect(wheelRange(input, 2.5)).toEqual({ base: 0, count: 121 });
    const odd = h('input', { type: 'number', min: 13, max: 110 });
    expect(wheelRange(odd, 5)).toEqual({ base: 15, count: 20 });
  });

  it('rests on the field value, and on the hint (greyed) when empty', () => {
    const a = make({ min: 0, max: 300, value: 40 }, 2.5);
    expect(a.top()).toBe(16 * ROW_PX);
    expect(a.middle()).toBe('40');
    const b = make({ min: 0, max: 1000, placeholder: '8–12' });
    expect(b.middle()).toBe('8');
    expect(b.wrap.classList.contains('empty')).toBe(true);
    expect(b.input.value).toBe('');
  });

  it('turning fires input per value and change once it comes to rest', () => {
    vi.useFakeTimers();
    const { input, scrollTo, middle, onInput, onChange } = make({ min: 0, max: 20, value: 10 }, 2.5);
    scrollTo(5);
    scrollTo(6);
    scrollTo(7);
    expect(input.value).toBe('17.5');
    expect(middle()).toBe('17.5');
    expect(onInput).toHaveBeenCalledTimes(3);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('a turn that ends where it began fires no change', () => {
    vi.useFakeTimers();
    const { scrollTo, onChange } = make({ min: 0, max: 20, value: 10 }, 2.5);
    scrollTo(5);
    scrollTo(4);
    vi.advanceTimersByTime(200);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('typing moves the wheel to match', () => {
    const { input, top, middle } = make({ min: 0, max: 100, value: 10 });
    input.value = '25';
    input.dispatchEvent(new Event('input'));
    expect(top()).toBe(25 * ROW_PX);
    expect(middle()).toBe('25');
  });

  it('shows an off-grid typed value as typed', () => {
    const { middle } = make({ min: 0, max: 20, value: 7.3 }, 2.5);
    expect(middle()).toBe('7.3');
  });

  it('steps with the arrow keys by its own step, firing change, and turns the wheel', () => {
    const { input, onChange, top } = make({ min: 0, max: 20, value: 7.3, step: 'any' }, 2.5);
    const key = (k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
    key('ArrowUp');
    expect(input.value).toBe('7.5');
    key('ArrowDown');
    key('ArrowDown');
    expect(input.value).toBe('2.5');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(top()).toBe(1 * ROW_PX);
  });

  it('keeps working without sound support or with ticks switched off', () => {
    setTicks(false);
    const { input, scrollTo } = make({ min: 0, max: 10, value: 1 });
    scrollTo(2);
    expect(input.value).toBe('2');
    setTicks(true);
  });
});

describe('number wheel on a phone', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => (window.matchMedia = realMatchMedia));

  it('only turns: a tap neither focuses the field nor steps, and no keyboard is asked for', () => {
    window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const { wrap, scroller, input, top } = make({ min: 0, max: 20, value: 10 });
    expect(wrap.classList.contains('touch')).toBe(true);
    expect(input.getAttribute('inputmode')).toBe('none');
    const before = top();
    scroller.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: 0 })); // the row above
    scroller.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: ROW_PX * 1.5 })); // the middle
    expect(document.activeElement).not.toBe(input);
    expect(top()).toBe(before);
  });

  it('keeps tap-to-type off phones', () => {
    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const { wrap, input } = make({ value: 10 });
    expect(wrap.classList.contains('touch')).toBe(false);
    expect(input.hasAttribute('inputmode')).toBe(false);
  });
});

describe('stepValue', () => {
  it('snaps to the grid, clamps, and fills an empty field from its hint', () => {
    const at = (attrs: Record<string, string | number>, by: number, steps: number) => stepValue(h('input', { type: 'number', ...attrs }), by, steps);
    expect(at({ value: 7.3 }, 2.5, 1)).toBe(7.5);
    expect(at({ value: 7.3 }, 2.5, -1)).toBe(5);
    expect(at({ value: 19, max: 20 }, 2.5, 3)).toBe(20);
    expect(at({ placeholder: '40' }, 2.5, 1)).toBe(40);
    expect(at({ min: 13 }, 1, 1)).toBe(13);
  });
});

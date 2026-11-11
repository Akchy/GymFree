import { describe, expect, it, vi } from 'vitest';
import { renderSetEditor, type DraftEntry } from '../../src/ui/set-editor';
import { change } from './helpers';

const make = (entries: DraftEntry[], units: 'kg' | 'lb' = 'kg') => {
  const onChange = vi.fn();
  const root = renderSetEditor({ entries, units, workouts: [], animate: false, onChange });
  document.body.replaceChildren(root);
  return { root, onChange };
};
const bench = (): DraftEntry => ({ exerciseId: 'bench-press', target: null, sets: [{ reps: 10, weightKg: 40 }] });
const input = (root: HTMLElement, label: string) => root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const btn = (root: ParentNode, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('set editor', () => {
  it('renders a row of wheels per set and adds/removes sets and exercises', () => {
    const entries = [bench()];
    const { root, onChange } = make(entries);
    expect(root.querySelectorAll('.set-row')).toHaveLength(1);
    expect(root.querySelector('button[aria-label^="Remove set"]')).toBeNull();
    btn(root, '+ Add set').click();
    expect(root.querySelectorAll('.set-row')).toHaveLength(2);
    expect(entries[0].sets[1]).toEqual({ reps: 10, weightKg: 40 });
    expect(onChange).toHaveBeenCalledTimes(1);
    root.querySelector<HTMLButtonElement>('button[aria-label^="Remove set 2"]')!.click();
    expect(root.querySelectorAll('.set-row')).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    change(root.querySelector('select')!, 'plank');
    expect(entries).toHaveLength(2);
    expect(root.querySelectorAll('.set-group')).toHaveLength(2);
    expect(root.querySelectorAll('.set-group')[1].textContent).toContain('Seconds');
    btn(root.querySelectorAll('.set-group')[1], 'Remove exercise').click();
    expect(entries).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('keeps stored kg exactly when a pounds user does not touch the weight', () => {
    const entries = [bench()];
    const { root } = make(entries, 'lb');
    expect(entries[0].sets[0].weightKg).toBe(40);
    change(input(root, 'Barbell Bench Press set 1 reps'), '10');
    expect(entries[0].sets[0].weightKg).toBe(40);
  });

  it('drops seconds when reps change and keeps them otherwise', () => {
    const entries: DraftEntry[] = [{ exerciseId: 'bench-press', target: null, sets: [{ reps: 10, weightKg: 40, seconds: 30 }] }];
    const { root } = make(entries);
    change(input(root, 'Barbell Bench Press set 1 weight (kg)'), '45');
    expect(entries[0].sets[0]).toMatchObject({ weightKg: 45, seconds: 30 });
    change(input(root, 'Barbell Bench Press set 1 reps'), '10');
    expect(entries[0].sets[0].seconds).toBe(30);
    change(input(root, 'Barbell Bench Press set 1 reps'), '8');
    expect(entries[0].sets[0].reps).toBe(8);
    expect(entries[0].sets[0].seconds).toBeUndefined();
  });

  it('opens how-to only when the info button is pressed', () => {
    const { root } = make([bench()]);
    const info = root.querySelector<HTMLButtonElement>('button[aria-label="How to do Barbell Bench Press"]')!;
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.how-to')!.childElementCount).toBe(0);
    info.click();
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.how-to .demo')).not.toBeNull();
    expect(root.querySelectorAll('.how-to ol li').length).toBeGreaterThan(1);
    info.click();
    expect(info.getAttribute('aria-expanded')).toBe('false');
    info.click();
    expect(root.querySelectorAll('.how-to ol')).toHaveLength(1);
  });
});

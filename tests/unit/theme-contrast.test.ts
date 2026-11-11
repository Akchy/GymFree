import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles.css', 'utf8');

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Body of the first rule whose selector starts with `selector` (selector text matched literally). */
function block(selector: string, from = 0): string {
  const at = css.indexOf(selector + ' {', from);
  if (at < 0) throw new Error(`no rule ${selector}`);
  const start = css.indexOf('{', at) + 1;
  return css.slice(start, css.indexOf('}', start));
}
function token(body: string, name: string): string {
  const m = body.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`no ${name}`);
  return m[1].toLowerCase();
}

const themes = { light: block(':root'), dark: block(":root[data-theme='dark']") };

describe('theme contrast', () => {
  it('dark theme uses the bold-dark values', () => {
    expect(token(themes.dark, '--bg')).toBe('#0b0b0c');
    expect(token(themes.dark, '--accent')).toBe('#c8f169');
  });
  for (const [name, body] of Object.entries(themes)) {
    it(`${name} theme is legible`, () => {
      const t = (n: string) => token(body, n);
      expect(contrast(t('--text'), t('--bg'))).toBeGreaterThanOrEqual(7);
      expect(contrast(t('--muted'), t('--bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('--accent'), t('--bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('--accent-text'), t('--accent'))).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('workout mode keeps its frozen colours', () => {
    const reel = css.split('\n').filter((l) => l.startsWith('.reel {')).length;
    expect(reel).toBeGreaterThan(0);
    const light = block('.reel');
    expect(token(light, '--accent')).toBe('#0f766e');
    expect(token(light, '--surface')).toBe('#ffffff');
    const media = css.indexOf('@media (prefers-color-scheme: dark)', css.indexOf('.reel {'));
    const scoped = block(":root:not([data-theme='light']) .reel", media);
    expect(token(scoped, '--accent')).toBe('#2dd4bf');
    expect(token(scoped, '--surface')).toBe('#181c21');
    const forced = block(":root[data-theme='dark'] .reel");
    expect(token(forced, '--accent')).toBe('#2dd4bf');
    expect(token(forced, '--surface')).toBe('#181c21');
  });
});

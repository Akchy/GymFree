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
  it('highlights the current History tab (marked aria-current="true")', () => {
    expect(css).toMatch(/\.segmented a\[aria-current='true'\][^{]*\{[^}]*background: var\(--accent\)/);
  });
  it('workout mode uses the app palette (no colours of its own)', () => {
    expect(css).not.toMatch(/\.reel\s*\{[^}]*--accent:/);
    expect(css).not.toContain('#0f766e');
    expect(css).not.toContain('#2dd4bf');
  });
});

describe('workout mode keeps its type', () => {
  // Unguarded rules on bare elements/shared classes apply inside .reel; the redesign's heading/type changes must use the
  // :where(body:not(:has(.reel))) guard, so these rules must stay exactly as they were before the redesign (commit 3d562d0).
  const rule = (sel: string) => css.match(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  it.each(['h1', 'h2', 'h3', 'legend', '.badge', '.card', '.actions'])('unguarded %s sets no heavier weight or tighter tracking', (sel) => {
    const body = rule(sel);
    expect(body).not.toMatch(/letter-spacing/);
    expect(body).not.toMatch(/font-weight:\s*(var\(--font-heavy\)|800)/);
  });
  it('h1-h3 bare rules are the pre-redesign ones', () => {
    expect(rule('h1')).toBe(' font-size: 1.6rem; margin: 0.5rem 0; ');
    expect(rule('h2')).toBe(' font-size: 1.15rem; margin: 0 0 0.5rem; ');
    expect(rule('h3')).toBe(' font-size: 1rem; margin: 0 0 0.5rem; ');
  });
  it('heading restyle is guarded', () => {
    expect(css).toContain(':where(body:not(:has(.reel))) h2');
  });
});

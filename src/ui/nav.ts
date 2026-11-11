/** Main navigation: a bottom tab bar on phones, a sidebar from 768px (see .appnav in styles.css). */
import { h, svg } from './dom';

export const NAV_ITEMS: readonly { href: '/' | '/history' | '/plan' | '/exercises'; label: string; icon: string }[] = [
  { href: '/', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { href: '/history', label: 'History', icon: 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  { href: '/plan', label: 'Plan', icon: 'M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 2v4M16 2v4' },
  { href: '/exercises', label: 'Exercises', icon: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11' },
];

/** The nav item a route belongs to, or null (e.g. for "Page not found"). */
export function activeNav(path: string): string | null {
  const section = path.split('?')[0].split('/')[1] ?? '';
  if (section === '' || section === 'log') return '/';
  if (section === 'history' || section === 'plan' || section === 'exercises' || section === 'settings') return `/${section}`;
  return null;
}

function icon(d: string, size = 24): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svg('path', { d }),
  );
}

export const GEAR_ICON =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';

/** The app logo (same drawing as public/favicon.svg): a lime "G" whose crossbar is a dumbbell. */
export function logoMark(size = 28): SVGElement {
  return svg(
    'svg',
    { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', class: 'logo-mark' },
    svg('rect', { width: 64, height: 64, rx: 14, fill: '#0b0b0c' }),
    svg('path', { d: 'M46 20.5A17 17 0 1 0 49 34H33', fill: 'none', stroke: '#c8f169', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    svg('rect', { x: 28.5, y: 27, width: 6, height: 14, rx: 2, fill: '#f2f2f2' }),
    svg('rect', { x: 47, y: 27, width: 6, height: 14, rx: 2, fill: '#f2f2f2' }),
  );
}

export function renderNav(path: string): HTMLElement {
  const active = activeNav(path);
  return h(
    'nav',
    { class: 'appnav', 'aria-label': 'Main' },
    h('a', { href: '#/', class: 'brand' }, logoMark(), 'GymFree'),
    ...NAV_ITEMS.map((it) => h('a', { href: `#${it.href}`, class: 'nav-item', 'aria-current': active === it.href ? 'page' : null }, icon(it.icon), h('span', {}, it.label))),
    h('a', { href: '#/settings', class: 'nav-settings', 'aria-current': active === '/settings' ? 'page' : null }, icon(GEAR_ICON, 20), h('span', {}, 'Settings')),
  );
}

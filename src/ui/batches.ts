import { clear, h } from './dom';

export interface Batches<T> {
  /** Button that shows the next batch; also triggers by itself as it scrolls into view. */
  more: HTMLButtonElement;
  show(items: readonly T[]): void;
}

/** Renders a long list a batch at a time, so only what the user reaches is ever built. */
export function createBatches<T>(target: HTMLElement, renderItem: (item: T) => Node, size = 24): Batches<T> {
  let items: readonly T[] = [];
  let shown = 0;
  const more = h('button', { type: 'button', class: 'secondary load-more' });
  const observer = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entries) => {
        if (!more.isConnected) observer?.disconnect();
        else if (entries.some((x) => x.isIntersecting)) next();
      }, { rootMargin: '400px' });

  const next = () => {
    const end = Math.min(shown + size, items.length);
    target.append(...items.slice(shown, end).map(renderItem));
    shown = end;
    const left = items.length - shown;
    more.hidden = left === 0;
    more.textContent = `Show more (${left} left)`;
    // Observing again reports the button's position, in case it is still on screen.
    observer?.unobserve(more);
    if (left) observer?.observe(more);
  };
  more.addEventListener('click', next);

  return {
    more,
    show(list) {
      items = list;
      shown = 0;
      clear(target);
      next();
    },
  };
}

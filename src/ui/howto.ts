import { exerciseDetails, type Exercise, type ExerciseDetails } from '../data/exercises';
import { append, clear, h } from './dom';

type Content = Parameters<typeof append>[1];

/** Steps and tip of an exercise. Library exercises fetch theirs the first time they are shown. */
export function howTo(ex: Exercise, build: (details: ExerciseDetails) => Content): HTMLElement {
  const box = h('div', { class: 'how-to-text' });
  if (!ex.library) {
    append(box, build(ex));
    return box;
  }
  box.append(h('p', { class: 'muted' }, 'Loading…'));
  exerciseDetails(ex).then(
    (details) => {
      clear(box);
      append(box, build(details));
    },
    () => box.replaceChildren(h('p', { class: 'muted' }, 'Could not load the steps. Check your connection and try again.')),
  );
  return box;
}

/**
 * Mutable simulation clock and per-frame activity, written by the
 * simulation driver and read by animated objects inside `useFrame`
 * without going through React state.
 */
export const clock = { t: 0 };

/** Objects currently doing work in any active run, by entity id. */
export const activity = {
  active: new Map<string, 'work' | 'manual'>(),
};

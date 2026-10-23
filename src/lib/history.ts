// سجل التراجع والإعادة. التعديلات «الحيّة» (سحب منزلق مثلًا) تغيّر الحالة الحالية فورًا
// لكنها لا تُسجَّل إلا مرة واحدة عند انتهاء السحب.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** الحالة قبل بدء تعديل حي لم يُنهَ بعد. */
  live: T | null;
}

const LIMIT = 80;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], live: null };
}

function flush<T>(h: History<T>): History<T> {
  if (h.live === null) return h;
  return { past: [...h.past, h.live].slice(-LIMIT), present: h.present, future: [], live: null };
}

export function commit<T>(h: History<T>, next: T): History<T> {
  const f = flush(h);
  if (Object.is(f.present, next)) return f;
  return { past: [...f.past, f.present].slice(-LIMIT), present: next, future: [], live: null };
}

export function liveUpdate<T>(h: History<T>, next: T): History<T> {
  return { ...h, live: h.live === null ? h.present : h.live, present: next };
}

export function endLive<T>(h: History<T>): History<T> {
  return flush(h);
}

export function undo<T>(h: History<T>): History<T> {
  const f = flush(h);
  if (f.past.length === 0) return f;
  const prev = f.past[f.past.length - 1];
  return { past: f.past.slice(0, -1), present: prev, future: [f.present, ...f.future], live: null };
}

export function redo<T>(h: History<T>): History<T> {
  const f = flush(h);
  if (f.future.length === 0) return f;
  const [next, ...rest] = f.future;
  return { past: [...f.past, f.present], present: next, future: rest, live: null };
}

export const canUndo = <T,>(h: History<T>): boolean => h.live !== null || h.past.length > 0;
export const canRedo = <T,>(h: History<T>): boolean => h.live === null && h.future.length > 0;

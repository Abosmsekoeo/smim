import { useCallback, useState } from 'react';
import * as H from './lib/history';
import { initialState } from './lib/editorOps';
import type { EditorState, Source } from './lib/types';

export interface Editor {
  state: EditorState;
  canUndo: boolean;
  canRedo: boolean;
  /** تعديل يُسجَّل في التاريخ */
  set: (fn: (s: EditorState) => EditorState) => void;
  /** تعديل حي (أثناء السحب) لا يُسجَّل حتى endLive */
  live: (fn: (s: EditorState) => EditorState) => void;
  endLive: () => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
}

export function useEditor(source: Source): Editor {
  const [hist, setHist] = useState(() => H.createHistory(initialState(source)));
  const set = useCallback((fn: (s: EditorState) => EditorState) => setHist((h) => H.commit(h, fn(h.present))), []);
  const live = useCallback((fn: (s: EditorState) => EditorState) => setHist((h) => H.liveUpdate(h, fn(h.present))), []);
  const endLive = useCallback(() => setHist((h) => H.endLive(h)), []);
  const undo = useCallback(() => setHist((h) => H.undo(h)), []);
  const redo = useCallback(() => setHist((h) => H.redo(h)), []);
  const resetAll = useCallback(() => setHist((h) => H.commit(h, initialState(h.present.source))), []);
  return {
    state: hist.present,
    canUndo: H.canUndo(hist),
    canRedo: H.canRedo(hist),
    set,
    live,
    endLive,
    undo,
    redo,
    resetAll,
  };
}

import { create } from "zustand";

export interface SerChunkMeta {
  seq: number;
  timestamp: number;
  rms: number;
  peak: number;
  mean: number;
  durationSec: number;
  approxBytes: number;
  duplicate: boolean;
  sent: boolean;
}

interface SerDebugState {
  recentChunks: SerChunkMeta[];
  lastSent?: SerChunkMeta | null;
  duplicateCount: number;
  sentCount: number;
  setChunk(meta: SerChunkMeta): void;
  reset(): void;
}

const MAX_CHUNKS = 20;

export const useSerDebugStore = create<SerDebugState>((set) => ({
  recentChunks: [],
  lastSent: null,
  duplicateCount: 0,
  sentCount: 0,
  setChunk: (meta: SerChunkMeta) =>
    set((state) => {
      const recentChunks = [meta, ...state.recentChunks].slice(0, MAX_CHUNKS);
      const duplicateCount = state.duplicateCount + (meta.duplicate ? 1 : 0);
      const sentCount = state.sentCount + (meta.sent ? 1 : 0);
      const lastSent = meta.sent ? meta : state.lastSent;
      return { recentChunks, duplicateCount, sentCount, lastSent };
    }),
  reset: () =>
    set({
      recentChunks: [],
      lastSent: null,
      duplicateCount: 0,
      sentCount: 0,
    }),
}));















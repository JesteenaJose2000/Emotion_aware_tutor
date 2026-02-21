"use client";

import { useEffect, useRef } from "react";
import { MicStreamer } from "@/src/lib/audioCapture";
import { postSER } from "@/src/lib/serClient";
import { FUSION_LAMBDA } from "@/src/lib/fusion";
import { useSessionStore } from "@/store/session";
import { useToast } from "@/lib/hooks/use-toast";
import { useSerDebugStore } from "@/src/store/serDebug";

const SER_CHUNK_SECONDS = (() => {
  if (typeof process !== "undefined") {
    const raw = (process as any).env?.NEXT_PUBLIC_SER_CHUNK_SECONDS;
    const val = raw ? Number(raw) : NaN;
    if (!Number.isNaN(val) && val > 0) {
      return val;
    }
  }
  return 2.5;
})();
// Enable debug mode via environment variable OR localStorage
// To enable: Open Chrome DevTools Console and type: localStorage.setItem('SER_DEBUG', '1')
// Then refresh the page
const SER_DEBUG_STREAM =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SER_DEBUG === "1") ||
  (typeof window !== "undefined" && localStorage.getItem("SER_DEBUG") === "1");
const SER_DUPLICATE_THRESHOLD = (() => {
  if (typeof process !== "undefined") {
    const raw = (process as any).env?.NEXT_PUBLIC_SER_DUPLICATE_THRESHOLD;
    const val = raw ? Number(raw) : NaN;
    if (!Number.isNaN(val) && val > 0) {
      return val;
    }
  }
  return 1e-4;
})();

interface UseVoiceEmotionArgs {
  enabled: boolean;
  faceFer: { pos: number; neu: number; fru: number };
  minVad?: number;
}

// Simple EMA smoothing for SER values
function smoothSer(current: { pos: number; neu: number; fru: number }, newVal: { pos: number; neu: number; fru: number }, alpha: number = 0.7) {
  return {
    pos: alpha * current.pos + (1 - alpha) * newVal.pos,
    neu: alpha * current.neu + (1 - alpha) * newVal.neu,
    fru: alpha * current.fru + (1 - alpha) * newVal.fru,
  };
}

export function useVoiceEmotion({ enabled, faceFer, minVad = 0.2 }: UseVoiceEmotionArgs) {
  const streamerRef = useRef<MicStreamer | null>(null);
  const offlineWarnedRef = useRef(false);
  const faceRef = useRef(faceFer);
  const lambdaRef = useRef(FUSION_LAMBDA);
  const minVadRef = useRef(minVad);
  const smoothedSerRef = useRef<{ pos: number; neu: number; fru: number }>({ pos: 1/3, neu: 1/3, fru: 1/3 });
  const chunkCounterRef = useRef(0);
  const { toast } = useToast();
  const setSerChunk = useSerDebugStore((s) => s.setChunk);
  const resetSerDebug = useSerDebugStore((s) => s.reset);

  const setVoiceFer = useSessionStore(s => s.setVoiceFer);
  const setFusedFer = useSessionStore(s => s.setFusedFer);

  // Keep refs updated without retriggering the streamer lifecycle
  useEffect(() => { faceRef.current = faceFer; }, [faceFer.pos, faceFer.neu, faceFer.fru]);
  useEffect(() => { lambdaRef.current = FUSION_LAMBDA; }, []);
  useEffect(() => { minVadRef.current = minVad; }, [minVad]);

  // Start/stop mic streamer only when enabled changes
  useEffect(() => {
    if (!enabled) {
      if (streamerRef.current) {
        streamerRef.current.stop();
        streamerRef.current = null;
      }
      chunkCounterRef.current = 0;
      resetSerDebug();
      // When disabled, fused = face only
      setFusedFer(faceRef.current);
      return;
    }

    offlineWarnedRef.current = false;
    const onChunk = async (blob: Blob) => {
      try {
        const chunkId = ++chunkCounterRef.current;
        // Always log chunk uploads
        console.log(`[SER] uploading chunk #${chunkId} bytes=${blob.size}`);
        const res = await postSER(blob);
        // Always log SER responses
        console.log(
          `[SER] chunk #${chunkId} response vad=${res.vad?.toFixed?.(2) ?? "n/a"} pos=${res.pos.toFixed(3)} neu=${res.neu.toFixed(3)} fru=${res.fru.toFixed(3)}`
        );
        setVoiceFer(res);
        const useVoice = (res.vad ?? 0) >= (minVadRef.current ?? 0.2);
        
        // Only smooth SER values when voice is detected (VAD >= threshold)
        // This prevents silent chunks from pushing SER toward neutral
        if (useVoice) {
          const smoothedSer = smoothSer(smoothedSerRef.current, { pos: res.pos, neu: res.neu, fru: res.fru });
          smoothedSerRef.current = smoothedSer;
        }
        // If VAD is low, keep previous smoothed SER value (don't update with silent chunk)
        
        const lam = Math.max(0, Math.min(1, lambdaRef.current ?? 0.6));
        const face = faceRef.current;
        const fused = useVoice
          ? {
              pos: lam * face.pos + (1 - lam) * smoothedSerRef.current.pos,
              neu: lam * face.neu + (1 - lam) * smoothedSerRef.current.neu,
              fru: lam * face.fru + (1 - lam) * smoothedSerRef.current.fru,
            }
          : face;
        // renormalize
        const s = fused.pos + fused.neu + fused.fru;
        const norm = s > 0 ? { pos: fused.pos / s, neu: fused.neu / s, fru: fused.fru / s } : { pos: 1/3, neu: 1/3, fru: 1/3 };
        setFusedFer(norm);
      } catch (e: any) {
        if (!offlineWarnedRef.current) {
          offlineWarnedRef.current = true;
          toast({ title: "Speech emotion offline", description: "Using face-only fusion.", variant: "destructive" });
        }
        // Keep last voiceFer and just use face-only
        setFusedFer(faceRef.current);
      }
    };

    const ms = new MicStreamer(onChunk, {
      chunkSeconds: SER_CHUNK_SECONDS,
      debug: SER_DEBUG_STREAM,
      duplicateThreshold: SER_DUPLICATE_THRESHOLD,
      onChunkMeta: (meta) => setSerChunk(meta),
    });
    streamerRef.current = ms;
    ms.start().catch((err) => {
      if (!offlineWarnedRef.current) {
        offlineWarnedRef.current = true;
        toast({ title: "Microphone unavailable", description: String(err?.message || err), variant: "destructive" });
      }
      setFusedFer(faceRef.current);
    });

    return () => {
      ms.stop();
      streamerRef.current = null;
    };
  }, [enabled, setVoiceFer, setFusedFer, toast]);
}



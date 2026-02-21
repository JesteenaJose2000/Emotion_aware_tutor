"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type { FerVector } from "@/types/fer";
import { ema, mapSevenToFer, normalizeFer, softmax } from "@/lib/ferMapping";
import { postFER } from "@/src/lib/ferClient";

// MediaPipe imports are dynamic to avoid SSR issues
type FaceDetection = any;
type Camera = any;

// Global model cache to prevent multiple loads across hook instances
let globalTfModel: tf.GraphModel | tf.LayersModel | null = null;
let globalOnnxSession: any = null;
let globalModelLoading = false;

const RUNTIME = "backend"; // Options: "backend" (use Python backend), "tfjs" (use TensorFlow.js in browser), "onnx"

const INITIAL_FER: FerVector = { pos: 1 / 3, neu: 1 / 3, fru: 1 / 3 };

export function useWebcamFer() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fer, setFer] = useState<FerVector>(INITIAL_FER);
  const [enabled, setEnabled] = useState(false);

  // Separate refs for FER processing and preview
  const ferVideoRef = useRef<HTMLVideoElement>(null); // For FER processing only
  const previewVideoRef = useRef<HTMLVideoElement>(null); // For preview only
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inferIntervalRef = useRef<number | null>(null);
  const prevEmaRef = useRef<FerVector>(INITIAL_FER);
  const busyRef = useRef(false);

  // Feature flag for bbox overlay drawing
  const drawOverlay = useRef<boolean>(false);

  const modelRef = useRef<tf.GraphModel | tf.LayersModel | null>(null);
  const onnxSessionRef = useRef<any>(null);
  const modelLoadingRef = useRef<boolean>(false);

  const targetFps = 10;
  const intervalMs = Math.max(50, Math.floor(1000 / targetFps));

  const loadMediaPipe = useCallback(async () => {
    const face = await import("@mediapipe/face_mesh");
    const cam = await import("@mediapipe/camera_utils");
    return { face, cam };
  }, []);

  const setupTf = useCallback(async () => {
    try {
      await tf.setBackend("webgl");
    } catch (_) {
      // backend might already be set
    }
    await tf.ready();
  }, []);

  const loadTfModel = useCallback(async () => {
    // Check if model is already loaded globally or currently loading
    if (globalTfModel || globalModelLoading) {
      console.log('Using cached TF model');
      modelRef.current = globalTfModel;
      return;
    }
    
    console.log('Loading TF model for the first time');
    globalModelLoading = true;
    try {
      await setupTf();
      // Try custom model first, fallback to fer-tiny if not available
      const customModelUrl = "/models/fer-custom/model.json";
      const fallbackModelUrl = "/models/fer-tiny/model.json";
      let modelUrl = customModelUrl;
      let modelLoaded = false;
      
      // Try to load custom model as GraphModel
      try {
        const model = (await tf.loadGraphModel(customModelUrl)) as tf.GraphModel;
        globalTfModel = model;
        modelRef.current = model;
        console.log('Custom TF GraphModel loaded successfully');
        modelLoaded = true;
      } catch {
        // Try as LayersModel
        try {
          const model = (await tf.loadLayersModel(customModelUrl)) as tf.LayersModel;
          globalTfModel = model;
          modelRef.current = model;
          console.log('Custom TF LayersModel loaded successfully');
          modelLoaded = true;
        } catch {
          console.log('Custom model not found, trying fallback model...');
          modelUrl = fallbackModelUrl;
        }
      }
      
      // Fallback to fer-tiny if custom model not found
      if (!modelLoaded) {
        try {
          const model = (await tf.loadGraphModel(fallbackModelUrl)) as tf.GraphModel;
          globalTfModel = model;
          modelRef.current = model;
          console.log('Fallback TF GraphModel loaded successfully');
        } catch {
          // Final fallback to LayersModel
          try {
            const model = (await tf.loadLayersModel(fallbackModelUrl)) as tf.LayersModel;
            globalTfModel = model;
            modelRef.current = model;
            console.log('Fallback TF LayersModel loaded successfully');
          } catch (e) {
            throw new Error(`Failed to load model from ${customModelUrl} or ${fallbackModelUrl}: ${e}`);
          }
        }
      }
    } finally {
      globalModelLoading = false;
    }
  }, [setupTf]);

  const loadOnnxModel = useCallback(async () => {
    // Check if ONNX session is already loaded globally or currently loading
    if (globalOnnxSession || globalModelLoading) {
      onnxSessionRef.current = globalOnnxSession;
      return;
    }
    
    globalModelLoading = true;
    try {
      const ort = await import("onnxruntime-web");
      globalOnnxSession = await ort.InferenceSession.create("/models/fer-tiny/model.onnx", {
        executionProviders: ["wasm"],
      });
      onnxSessionRef.current = globalOnnxSession;
    } finally {
      globalModelLoading = false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    const constraints: MediaStreamConstraints = {
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaStreamRef.current = stream;
    
    // Set the stream on the FER video element for processing
    if (ferVideoRef.current) {
      ferVideoRef.current.srcObject = stream;
      await ferVideoRef.current.play().catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (ferVideoRef.current) {
      try {
        ferVideoRef.current.pause();
        ferVideoRef.current.srcObject = null;
      } catch {}
    }
    if (previewVideoRef.current) {
      try {
        previewVideoRef.current.pause();
        previewVideoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  const cropFace = (bbox: { x: number; y: number; w: number; h: number }) => {
    const video = ferVideoRef.current;
    if (!video) return null;
    const off = document.createElement("canvas");
    const size = 48; // Match training input size (48x48)
    off.width = size;
    off.height = size;
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      video,
      bbox.x,
      bbox.y,
      bbox.w,
      bbox.h,
      0,
      0,
      size,
      size
    );
    return off;
  };

  const detectFaceBbox = useCallback(async (): Promise<{ x: number; y: number; w: number; h: number } | null> => {
    // Minimal heuristic: full frame as fallback. Replace with MediaPipe usage for better results.
    const v = ferVideoRef.current;
    if (!v) return null;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return null;
    // TODO: integrate MediaPipe face detection for accurate bbox
    const size = Math.min(w, h) * 0.8;
    return { x: (w - size) / 2, y: (h - size) / 2, w: size, h: size };
  }, []);

  const runTfInference = useCallback(async (input: HTMLCanvasElement): Promise<FerVector | null> => {
    const model = modelRef.current;
    if (!model) return null;
    const tensor = tf.tidy(() => {
      // Load image as RGB (fromPixels returns RGB)
      const img = tf.browser.fromPixels(input).toFloat();
      // Resize to 48x48 to match training input size
      const resized = tf.image.resizeBilinear(img, [48, 48]);
      // Convert RGB to grayscale: 0.299*R + 0.587*G + 0.114*B
      const gray = resized.mean(2).expandDims(2); // Mean across channel dimension
      // Rescale by 1/255 (matching ImageDataGenerator rescale=1./255)
      const normalized = gray.div(255);
      // Batch dimension: shape should be (1, 48, 48, 1)
      const batched = normalized.expandDims(0);
      return batched;
    });
    try {
      const out = model instanceof tf.GraphModel ? (await model.executeAsync(tensor)) : (await (model as tf.LayersModel).predict(tensor));
      const logits = Array.isArray(out) ? (await (out[0] as tf.Tensor).data()) : (await (out as tf.Tensor).data());
      const probs7 = softmax(Array.from(logits as any) as number[]);
      const fer3 = mapSevenToFer([
        probs7[0] ?? 0,
        probs7[1] ?? 0,
        probs7[2] ?? 0,
        probs7[3] ?? 0,
        probs7[4] ?? 0,
        probs7[5] ?? 0,
        probs7[6] ?? 0,
      ] as any);
      return fer3;
    } catch (e) {
      return null;
    } finally {
      tensor.dispose();
      tf.engine().startScope();
      tf.engine().endScope();
    }
  }, []);

  const runBackendInference = useCallback(async (input: HTMLCanvasElement): Promise<FerVector | null> => {
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        input.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
      });
      
      if (!blob) return null;
      
      // Send to backend
      const result = await postFER(blob);
      return { pos: result.pos, neu: result.neu, fru: result.fru };
    } catch (e: any) {
      console.warn('[FER] Backend inference failed:', e?.message || e);
      return null;
    }
  }, []);

  const runOnnxInference = useCallback(async (input: HTMLCanvasElement): Promise<FerVector | null> => {
    const session = onnxSessionRef.current;
    if (!session) return null;
    const size = 96;
    const ctx = input.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, size, size);
    const ort = await import("onnxruntime-web");
    const float = new Float32Array(size * size * 3);
    for (let i = 0; i < size * size; i++) {
      float[i * 3 + 0] = data.data[i * 4 + 0] / 255;
      float[i * 3 + 1] = data.data[i * 4 + 1] / 255;
      float[i * 3 + 2] = data.data[i * 4 + 2] / 255;
    }
    const inputTensor = new ort.Tensor("float32", float, [1, size, size, 3]);
    const feeds: Record<string, any> = {};
    const inputName = session.inputNames?.[0] || "input";
    feeds[inputName] = inputTensor;
    try {
      const results = await session.run(feeds);
      const first = results[session.outputNames[0]];
      const probs7 = softmax(Array.from(first.data as Float32Array));
      const fer3 = mapSevenToFer([
        probs7[0] ?? 0,
        probs7[1] ?? 0,
        probs7[2] ?? 0,
        probs7[3] ?? 0,
        probs7[4] ?? 0,
        probs7[5] ?? 0,
        probs7[6] ?? 0,
      ] as any);
      return fer3;
    } catch {
      return null;
    }
  }, []);

  const pseudoDrift = useCallback(() => {
    const drift = 0.02;
    const rnd = () => (Math.random() - 0.5) * drift;
    const next = normalizeFer({
      pos: fer.pos + rnd(),
      neu: fer.neu + rnd(),
      fru: fer.fru + rnd(),
    });
    setFer(next);
    prevEmaRef.current = ema(prevEmaRef.current, next, 0.7);
    setFer(prevEmaRef.current);
  }, [fer]);

  const tick = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const bbox = await detectFaceBbox();
      if (!bbox) return;
      const faceCanvas = cropFace(bbox);
      if (!faceCanvas) return;
      let fer3: FerVector | null = null;
      
      if (RUNTIME === "backend") {
        fer3 = await runBackendInference(faceCanvas);
      } else if (RUNTIME === "onnx") {
        fer3 = await runOnnxInference(faceCanvas);
      } else {
        fer3 = await runTfInference(faceCanvas);
      }
      if (!fer3) {
        pseudoDrift();
        return;
      }
      const smoothed = ema(prevEmaRef.current, fer3, 0.7);
      prevEmaRef.current = smoothed;
      setFer(smoothed);

      // Optional overlay drawing
      if (drawOverlay.current && canvasRef.current && ferVideoRef.current) {
        const c = canvasRef.current;
        const ctx = c.getContext("2d");
        if (ctx) {
          c.width = ferVideoRef.current.videoWidth;
          c.height = ferVideoRef.current.videoHeight;
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 2;
          const radius = Math.min(bbox.w, bbox.h) * 0.1;
          const x = bbox.x, y = bbox.y, w = bbox.w, h = bbox.h;
          ctx.beginPath();
          // Rounded rect
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + w - radius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
          ctx.lineTo(x + w, y + h - radius);
          ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
          ctx.lineTo(x + radius, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.stroke();
        }
      }
    } catch (e: any) {
      // graceful fallback
      setError(e?.message || "Camera/FER error");
      pseudoDrift();
    } finally {
      busyRef.current = false;
    }
  }, [detectFaceBbox, pseudoDrift, runOnnxInference, runTfInference, runBackendInference]);

  const enable = useCallback(async () => {
    try {
      setError(null);
      await startCamera();
      // Only load models if using local inference
      if (RUNTIME === "backend") {
        // Backend mode: no need to load models in browser
        console.log('[FER] Using backend inference mode');
      } else if (RUNTIME === "onnx") {
        await loadOnnxModel();
      } else {
        await loadTfModel();
      }
      setEnabled(true);
      setReady(true);
      // Start loop
      if (inferIntervalRef.current) window.clearInterval(inferIntervalRef.current);
      inferIntervalRef.current = window.setInterval(tick, intervalMs) as unknown as number;
    } catch (e: any) {
      setError(e?.message || "Failed to enable camera");
      setEnabled(false);
      setReady(false);
    }
  }, [intervalMs, loadOnnxModel, loadTfModel, startCamera, tick]);

  const disable = useCallback(() => {
    setEnabled(false);
    if (inferIntervalRef.current) {
      window.clearInterval(inferIntervalRef.current);
      inferIntervalRef.current = null;
    }
    stopCamera();
    // dispose tf resources
    tf.engine().startScope();
    tf.engine().endScope();
  }, [stopCamera]);

  const cleanup = useCallback(() => {
    disable();
    // Clean up local model references
    modelRef.current = null;
    onnxSessionRef.current = null;
    modelLoadingRef.current = false;
    // Note: We don't dispose global models here as other instances might be using them
  }, [disable]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ready,
    error,
    videoRef: ferVideoRef, // For FER processing
    previewVideoRef, // For preview display
    canvasRef,
    fer,
    enable,
    disable,
    cleanup,
    enabled,
    mediaStreamRef, // Expose the media stream ref
  } as const;
}



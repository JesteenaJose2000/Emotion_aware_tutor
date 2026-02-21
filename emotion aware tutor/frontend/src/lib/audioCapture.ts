export type MicChunkHandler = (blob: Blob) => void;

export interface MicStreamerOptions {
  chunkSeconds?: number;
  debug?: boolean;
  duplicateThreshold?: number;
  onChunkMeta?: (meta: MicChunkMeta) => void;
}

interface ChunkSignature {
  rms: number;
  peak: number;
  mean: number;
}

export interface MicChunkMeta {
  seq: number;
  sampleCount: number;
  durationSec: number;
  approxBytes: number;
  rms: number;
  peak: number;
  mean: number;
  duplicate: boolean;
  sent: boolean;
  timestamp: number;
}

export class MicStreamer {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array[] = [];
  private samplesCollected = 0;
  private readonly targetSr = 16000;
  private actualSr: number = 16000; // Will be set from AudioContext
  private readonly chunkSeconds: number;
  private readonly onChunk: MicChunkHandler;
  private readonly debug: boolean;
  private chunkSeq = 0;
  private lastSignature: ChunkSignature | null = null;
  private consecutiveDuplicates = 0;
  private readonly duplicateThreshold: number;
  private readonly onChunkMeta?: (meta: MicChunkMeta) => void;
  private readonly maxConsecutiveDuplicates = 5; // Force send after N consecutive duplicates

  constructor(onChunk: MicChunkHandler, options: MicStreamerOptions = {}) {
    this.onChunk = onChunk;
    const chunkSeconds = options.chunkSeconds ?? 1.0;
    this.chunkSeconds = Math.max(0.25, chunkSeconds);
    this.debug = Boolean(options.debug);
    this.duplicateThreshold = Math.max(1e-6, options.duplicateThreshold ?? 1e-4);
    this.onChunkMeta = options.onChunkMeta;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.targetSr });
    // Get actual sample rate (browser may ignore requested rate)
    this.actualSr = this.ctx.sampleRate;
    if (this.actualSr !== this.targetSr) {
      console.log(`[MicStreamer] AudioContext sample rate is ${this.actualSr}Hz (requested ${this.targetSr}Hz). Will resample.`);
    }
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
    this.processor.onaudioprocess = (e) => {
      const inBuf = e.inputBuffer.getChannelData(0);
      // Clone slice for accumulation - this is NEW audio from the mic
      this.buffer.push(new Float32Array(inBuf));
      this.samplesCollected += inBuf.length;
      // Calculate needed samples at actual sample rate, then we'll resample to target
      const needed = Math.floor(this.actualSr * this.chunkSeconds);
      while (this.samplesCollected >= needed) {
        const rawChunk = this.flush(needed);
        // Resample to target sample rate if needed
        const chunk = this.actualSr !== this.targetSr 
          ? this.resample(rawChunk, this.actualSr, this.targetSr)
          : rawChunk;
        const signature = this.computeSignature(chunk);
        const seq = ++this.chunkSeq;
        // Always log chunk stats
        this.logChunkStats(seq, chunk, signature);
        const metaBase = this.buildMeta(seq, chunk.length, signature);
        
        // Skip completely silent chunks (all zeros) - no point sending to SER
        const isSilent = signature.rms === 0 && signature.peak === 0 && signature.mean === 0;
        if (isSilent) {
          console.log(`[MicStreamer] chunk #${seq} is completely silent (all zeros); skipping upload.`);
          // Update signature even for silent chunks
          this.lastSignature = signature;
          this.onChunkMeta?.({ ...metaBase, duplicate: true, sent: false });
          continue;
        }
        
        const isDup = this.isDuplicate(signature);
        
        // Force send if too many consecutive duplicates (prevents infinite skipping)
        const forceSend = this.consecutiveDuplicates >= this.maxConsecutiveDuplicates;
        
        if (isDup && !forceSend) {
          this.consecutiveDuplicates++;
          // Always log duplicate detection
          console.log(`[MicStreamer] chunk #${seq} duplicate detected (${this.consecutiveDuplicates}/${this.maxConsecutiveDuplicates}); skipping upload.`);
          // Update signature even for duplicates so we compare to most recent chunk
          this.lastSignature = signature;
          this.onChunkMeta?.({ ...metaBase, duplicate: true, sent: false });
          continue;
        }
        
        // Reset counter and send chunk
        if (forceSend) {
          console.log(`[MicStreamer] chunk #${seq} forcing send after ${this.consecutiveDuplicates} consecutive duplicates.`);
        }
        this.consecutiveDuplicates = 0;
        this.lastSignature = signature;
        const wav = this.encodeWavFloat32Mono(chunk, this.targetSr);
        const blob = new Blob([wav], { type: 'audio/wav' });
        this.onChunkMeta?.({ ...metaBase, duplicate: isDup && forceSend, sent: true });
        this.onChunk(blob);
      }
    };
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.buffer = [];
    this.samplesCollected = 0;
    this.chunkSeq = 0;
    this.lastSignature = null;
    this.consecutiveDuplicates = 0;
    this.actualSr = 16000; // Reset to default
  }

  private flush(needed: number): Float32Array {
    const out = new Float32Array(needed);
    let offset = 0;
    while (offset < needed && this.buffer.length > 0) {
      const buf = this.buffer.shift()!;
      const copy = Math.min(buf.length, needed - offset);
      out.set(buf.subarray(0, copy), offset);
      offset += copy;
      if (copy < buf.length) {
        // Put leftover back at the front
        const rest = buf.subarray(copy);
        this.buffer.unshift(new Float32Array(rest));
      }
    }
    // Safety check: if we couldn't get enough samples, pad with zeros
    if (offset < needed) {
      console.warn(`[MicStreamer] flush: only got ${offset}/${needed} samples, padding with zeros`);
      out.fill(0, offset);
    }
    this.samplesCollected = Math.max(0, this.samplesCollected - needed);
    return out;
  }

  private computeSignature(samples: Float32Array): ChunkSignature {
    let sumSquares = 0;
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const value = samples[i];
      sumSquares += value * value;
      sum += value;
      const mag = Math.abs(value);
      if (mag > peak) peak = mag;
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    const mean = sum / samples.length;
    return { rms, peak, mean };
  }

  private logChunkStats(seq: number, samples: Float32Array, signature: ChunkSignature) {
    // Always log chunk stats (changed from console.debug to console.log)
    console.log(
      `[MicStreamer] chunk #${seq} len=${samples.length} rms=${signature.rms.toFixed(4)} peak=${signature.peak.toFixed(4)} mean=${signature.mean.toFixed(4)}`
    );
  }

  private buildMeta(seq: number, sampleCount: number, signature: ChunkSignature): Omit<MicChunkMeta, "duplicate" | "sent"> {
    return {
      seq,
      sampleCount,
      durationSec: sampleCount / this.targetSr,
      approxBytes: 44 + sampleCount * 4,
      rms: signature.rms,
      peak: signature.peak,
      mean: signature.mean,
      timestamp: Date.now(),
    };
  }

  private isDuplicate(signature: ChunkSignature): boolean {
    if (!this.lastSignature) return false;
    
    // For very quiet audio (silence), use a more lenient threshold
    // Silence naturally produces similar signatures, but we still want to process it
    const isQuiet = signature.rms < 0.01 && this.lastSignature.rms < 0.01;
    const threshold = isQuiet ? this.duplicateThreshold * 10 : this.duplicateThreshold;
    
    const diffRms = Math.abs(signature.rms - this.lastSignature.rms);
    const diffPeak = Math.abs(signature.peak - this.lastSignature.peak);
    const diffMean = Math.abs(signature.mean - this.lastSignature.mean);
    
    // Only mark as duplicate if ALL metrics are within threshold AND there's significant audio
    // For silence, we're more lenient to allow periodic processing
    return diffRms <= threshold && diffPeak <= threshold && diffMean <= threshold && !isQuiet;
  }

  private encodeWavFloat32Mono(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numFrames = samples.length;
    const buffer = new ArrayBuffer(44 + numFrames * 4);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numFrames * 4, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 3, true); // format 3 = IEEE float
    view.setUint16(22, 1, true); // channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true); // byte rate
    view.setUint16(32, 4, true); // block align
    view.setUint16(34, 32, true); // bits per sample

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, numFrames * 4, true);
    // samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 4) {
      view.setFloat32(offset, samples[i], true);
    }
    return buffer;
  }

  private writeString(view: DataView, offset: number, s: string) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  }

  /**
   * Resample audio from one sample rate to another using linear interpolation.
   * This is a simple resampler suitable for real-time processing.
   */
  private resample(input: Float32Array, fromSr: number, toSr: number): Float32Array {
    if (fromSr === toSr) {
      return input;
    }
    
    const ratio = toSr / fromSr;
    const outputLength = Math.round(input.length * ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      
      // Linear interpolation
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    
    return output;
  }
}




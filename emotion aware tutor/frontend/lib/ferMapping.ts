import type { FerVector, SevenClassVector } from "@/types/fer";

export function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map(v => Math.exp(v - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / (sumExp || 1));
}

export function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function normalizeFer(vec: FerVector): FerVector {
  const pos = clamp01(vec.pos);
  const neu = clamp01(vec.neu);
  const fru = clamp01(vec.fru);
  const sum = pos + neu + fru;
  if (sum <= 0) return { pos: 1 / 3, neu: 1 / 3, fru: 1 / 3 };
  return { pos: pos / sum, neu: neu / sum, fru: fru / sum };
}

// Map 7-class distribution to 3-class FerVector
// Order assumption: [angry, disgust, fear, happy, sad, surprise, neutral]
export function mapSevenToFer(prob7: SevenClassVector): FerVector {
  const angry = prob7[0] || 0;
  const disgust = prob7[1] || 0;
  const fear = prob7[2] || 0;
  const happy = prob7[3] || 0;
  const sad = prob7[4] || 0;
  const surprise = prob7[5] || 0;
  const neutral = prob7[6] || 0;

  const pos = happy + surprise;
  const fru = sad + angry + fear + disgust;
  const neu = neutral;

  return normalizeFer({ pos, neu, fru });
}

export function ema(prev: FerVector, current: FerVector, alpha = 0.7): FerVector {
  // ema = α*prev + (1-α)*current
  const next: FerVector = {
    pos: alpha * prev.pos + (1 - alpha) * current.pos,
    neu: alpha * prev.neu + (1 - alpha) * current.neu,
    fru: alpha * prev.fru + (1 - alpha) * current.fru,
  };
  return normalizeFer(next);
}




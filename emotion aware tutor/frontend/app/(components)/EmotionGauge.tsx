"use client";

import { FERState } from "@/types/api";
import { cn } from "@/lib/cn";

interface EmotionGaugeProps {
  fer: FERState;
  className?: string;
}

export function EmotionGauge({ fer, className }: EmotionGaugeProps) {
  // Compute an overall "mood score" from -1 (very frustrated) to +1 (very positive)
  const moodScore = Math.max(-1, Math.min(1, fer.positive - fer.frustrated));
  // Visually, we want "positive" on the left (green) and "frustrated" on the right (red),
  // so flip the position mapping so that more frustration pushes the thumb rightward.
  const sliderPosition = 100 - ((moodScore + 1) / 2) * 100; // 0–100%

  const moodLabel =
    moodScore > 0.4
      ? "Feeling great"
      : moodScore > 0.1
      ? "Mostly positive"
      : moodScore > -0.1
      ? "Mixed / neutral"
      : moodScore > -0.4
      ? "Getting frustrated"
      : "Very frustrated";

  const moodBadgeColor =
    moodScore > 0.4
      ? "text-green-600"
      : moodScore > 0.1
      ? "text-emerald-500"
      : moodScore > -0.1
      ? "text-amber-500"
      : moodScore > -0.4
      ? "text-orange-500"
      : "text-red-500";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Mood &amp; Emotion</span>
        <span className={cn("font-semibold", moodBadgeColor)}>{moodLabel}</span>
      </div>

      {/* Single gradient meter */}
      <div className="relative h-4 w-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 via-orange-400 to-red-500 shadow-inner overflow-hidden">
        {/* Track border */}
        <div className="absolute inset-0 rounded-full ring-1 ring-black/10 pointer-events-none" />

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow-md border border-black/5 transition-all duration-500 ease-out flex items-center justify-center"
          style={{ left: `${sliderPosition}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="h-1 w-3 rounded-full bg-slate-300" />
        </div>
      </div>

      {/* Legend labels only, no percentages */}
      <div className="flex justify-between text-[11px] text-muted-foreground px-1">
        <span className="font-medium text-emerald-600">Pos</span>
        <span className="font-medium text-blue-600">Neu</span>
        <span className="font-medium text-red-600">Fru</span>
      </div>
    </div>
  );
}

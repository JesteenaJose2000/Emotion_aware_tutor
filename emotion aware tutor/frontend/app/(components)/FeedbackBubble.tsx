"use client";

import { Sparkles, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

interface FeedbackBubbleProps {
  type: "encourage" | "hint" | "neutral";
  message: string;
  className?: string;
}

export function FeedbackBubble({ type, message, className }: FeedbackBubbleProps) {
  const icons = {
    encourage: Sparkles,
    hint: Lightbulb,
    neutral: MessageSquare,
  };

  const colors = {
    encourage: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-800 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800 dark:text-green-300",
    hint: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800 dark:text-blue-300",
    neutral: "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 text-slate-800 dark:from-slate-900/20 dark:to-gray-900/20 dark:border-slate-800 dark:text-slate-300",
  };

  const Icon = icons[type];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all duration-300 animate-in slide-up",
        colors[type],
        className
      )}
    >
      <div className="flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

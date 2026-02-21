import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${remainingSeconds}s`;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getDifficultyColor(difficulty: number): string {
  if (difficulty <= 2) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  if (difficulty === 3) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
}

export function getDifficultyLabel(difficulty: number): string {
  if (difficulty <= 2) return 'Easy';
  if (difficulty === 3) return 'Medium';
  return 'Hard';
}

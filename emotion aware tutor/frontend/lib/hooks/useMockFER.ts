"use client";

import { useState, useEffect, useCallback } from "react";

interface FERState {
  positive: number;
  neutral: number;
  frustrated: number;
}

interface UseMockFERReturn {
  fer: FERState;
  smoothedFer: FERState;
  isEnabled: boolean;
}

export function useMockFER(): UseMockFERReturn {
  const [fer, setFer] = useState<FERState>({ positive: 0.34, neutral: 0.33, frustrated: 0.33 });
  const [smoothedFer, setSmoothedFer] = useState<FERState>({ positive: 0.34, neutral: 0.33, frustrated: 0.33 });
  const [isEnabled] = useState(true);

  const updateFER = useCallback(() => {
    setFer(prev => {
      // Add small random noise
      const noise = () => (Math.random() - 0.5) * 0.1;
      
      const newFer = {
        positive: Math.max(0, Math.min(1, prev.positive + noise())),
        neutral: Math.max(0, Math.min(1, prev.neutral + noise())),
        frustrated: Math.max(0, Math.min(1, prev.frustrated + noise())),
      };

      // Normalize to ensure they sum to 1
      const sum = newFer.positive + newFer.neutral + newFer.frustrated;
      newFer.positive /= sum;
      newFer.neutral /= sum;
      newFer.frustrated /= sum;

      return newFer;
    });
  }, []);

  // EMA smoothing
  const smoothFER = useCallback((newFer: FERState) => {
    const alpha = 0.1; // Smoothing factor
    setSmoothedFer(prev => ({
      positive: alpha * newFer.positive + (1 - alpha) * prev.positive,
      neutral: alpha * newFer.neutral + (1 - alpha) * prev.neutral,
      frustrated: alpha * newFer.frustrated + (1 - alpha) * prev.frustrated,
    }));
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      updateFER();
    }, 1000);

    return () => clearInterval(interval);
  }, [isEnabled, updateFER]);

  useEffect(() => {
    smoothFER(fer);
  }, [fer, smoothFER]);

  return {
    fer,
    smoothedFer,
    isEnabled,
  };
}


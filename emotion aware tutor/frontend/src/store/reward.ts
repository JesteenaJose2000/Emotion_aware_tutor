/**
 * Reward Weights Store
 * 
 * Manages dynamic reward weights for AI experimentation
 */

import { create } from 'zustand';
import { RewardPreset } from '@/src/types/ab';

interface RewardWeightsState {
  // Current weights
  alpha: number;
  beta: number;
  gamma: number;
  
  // Current preset
  preset: RewardPreset;
  
  // Actions
  setWeights: (weights: { alpha: number; beta: number; gamma: number }) => void;
  setPreset: (preset: RewardPreset) => void;
  resetToBaseline: () => void;
}

// Preset configurations
const PRESETS = {
  baseline: { alpha: 1.0, beta: 0.3, gamma: 0.5 },
  aggressive: { alpha: 1.0, beta: 0.5, gamma: 0.7 },
  conservative: { alpha: 1.0, beta: 0.2, gamma: 0.3 },
} as const;

export const useRewardWeightsStore = create<RewardWeightsState>((set, get) => ({
  // Initial state
  alpha: PRESETS.baseline.alpha,
  beta: PRESETS.baseline.beta,
  gamma: PRESETS.baseline.gamma,
  preset: 'baseline',
  
  // Actions
  setWeights: (weights) => {
    set({
      alpha: weights.alpha,
      beta: weights.beta,
      gamma: weights.gamma,
      preset: 'custom', // Mark as custom when manually adjusted
    });
  },
  
  setPreset: (preset) => {
    if (preset === 'custom') {
      set({ preset });
      return;
    }
    
    const weights = PRESETS[preset];
    set({
      alpha: weights.alpha,
      beta: weights.beta,
      gamma: weights.gamma,
      preset,
    });
  },
  
  resetToBaseline: () => {
    const weights = PRESETS.baseline;
    set({
      alpha: weights.alpha,
      beta: weights.beta,
      gamma: weights.gamma,
      preset: 'baseline',
    });
  },
}));








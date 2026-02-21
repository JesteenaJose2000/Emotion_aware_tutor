/**
 * Centralized Reward Computation
 * 
 * Implements the reward function: r_t = α·correct_t + β·(pos_t − fru_t) + γ·Δmastery_t
 * Uses dynamic weights from the reward store for AI experimentation.
 */

import { useRewardWeightsStore } from '@/src/store/reward';

/**
 * Clamp a value to [0, 1] range
 */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Clamp a value to [-1, 1] range
 */
export function clampNeg1to1(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/**
 * Compute reward based on correctness, engagement, and mastery gain
 * 
 * @param correct - Binary correctness (0 or 1)
 * @param engagement - Engagement score (pos - fru), will be clamped to [-1, 1]
 * @param deltaM - Mastery gain (change in mastery), will be clamped to [0, 1]
 * @returns Computed reward value
 */
export function computeReward(correct: number, engagement: number, deltaM: number): number {
  const { alpha, beta, gamma } = useRewardWeightsStore.getState();
  const e = clampNeg1to1(engagement);
  const d = clamp01(deltaM);
  
  return alpha * correct + beta * e + gamma * d;
}

/**
 * Compute engagement score from FER vector
 * 
 * @param fer - FER vector with positive, neutral, frustrated values
 * @returns Engagement score (positive - frustrated)
 */
export function computeEngagement(fer: { positive: number; neutral: number; frustrated: number }): number {
  return fer.positive - fer.frustrated;
}

/**
 * Compute mastery gain (delta mastery)
 * 
 * @param prevMastery - Previous mastery value
 * @param currentMastery - Current mastery value
 * @returns Mastery gain, clamped to [0, 1]
 */
export function computeMasteryGain(prevMastery: number, currentMastery: number): number {
  return clamp01(currentMastery - prevMastery);
}

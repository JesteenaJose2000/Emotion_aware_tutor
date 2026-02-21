/**
 * Reward Weight Constants
 * 
 * These constants define the weights for the reward function:
 * r_t = α·correct_t + β·(pos_t − fru_t) + γ·Δmastery_t
 * 
 * Environment variable NEXT_PUBLIC_REWARD_PRESET can override these values:
 * - "baseline": α=1.0, β=0.3, γ=0.5 (default)
 * - "aggressive": α=1.0, β=0.5, γ=0.7 (higher engagement/mastery weights)
 * - "conservative": α=1.0, β=0.2, γ=0.3 (lower engagement/mastery weights)
 */

// Base reward weights
export const ALPHA_CORRECT = 1.0;      // correctness weight
export const BETA_ENGAGEMENT = 0.3;    // (pos - fru) weight
export const GAMMA_MASTERY = 0.5;      // Δmastery weight (clamped to [0,1])

// Preset configurations
const PRESETS = {
  baseline: { alpha: 1.0, beta: 0.3, gamma: 0.5 },
  aggressive: { alpha: 1.0, beta: 0.5, gamma: 0.7 },
  conservative: { alpha: 1.0, beta: 0.2, gamma: 0.3 },
} as const;

// Get preset or use defaults
const preset = process.env.NEXT_PUBLIC_REWARD_PRESET as keyof typeof PRESETS;
const weights = preset && PRESETS[preset] ? PRESETS[preset] : PRESETS.baseline;

// Export frozen reward weights object
export const REWARD_WEIGHTS = Object.freeze({
  alpha: weights.alpha,
  beta: weights.beta,
  gamma: weights.gamma,
});

// Export individual weights for convenience
export const { alpha: ALPHA, beta: BETA, gamma: GAMMA } = REWARD_WEIGHTS;


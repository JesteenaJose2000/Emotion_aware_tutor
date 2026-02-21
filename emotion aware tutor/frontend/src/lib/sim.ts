/**
 * Simulation Utilities for A/B Testing
 * 
 * Functions to generate synthetic FER and correctness data
 */

import { SeededRNG } from './seed';
import { FERState } from '@/types/api';

/**
 * Generate synthetic FER vector with mild autocorrelation
 * 
 * @param rng - Seeded random number generator
 * @param prevFer - Previous FER vector for autocorrelation
 * @returns Synthetic FER vector
 */
export function synthFer(rng: SeededRNG, prevFer?: FERState): FERState {
  const alpha = 0.7; // Autocorrelation strength
  
  if (!prevFer) {
    // Initial random FER
    const positive = rng.nextFloat(0.2, 0.6);
    const frustrated = rng.nextFloat(0.1, 0.4);
    const neutral = 1 - positive - frustrated;
    return { positive, neutral, frustrated };
  }
  
  // Generate with autocorrelation
  const positive = alpha * prevFer.positive + (1 - alpha) * rng.nextFloat(0.2, 0.6);
  const frustrated = alpha * prevFer.frustrated + (1 - alpha) * rng.nextFloat(0.1, 0.4);
  const neutral = 1 - positive - frustrated;
  
  // Ensure values are in valid range
  return {
    positive: Math.max(0, Math.min(1, positive)),
    neutral: Math.max(0, Math.min(1, neutral)),
    frustrated: Math.max(0, Math.min(1, frustrated))
  };
}

/**
 * Generate synthetic correctness based on mastery
 * 
 * @param mastery - Current mastery level
 * @param rng - Seeded random number generator
 * @returns Binary correctness (0 or 1)
 */
export function synthCorrect(mastery: number, rng: SeededRNG): 0 | 1 {
  const prob = predictCorrectProb(mastery);
  return rng.bernoulli(prob) ? 1 : 0;
}

/**
 * Predict correctness probability based on mastery
 * 
 * @param mastery - Mastery level (0-1)
 * @returns Probability of correct answer (0.1-0.9)
 */
export function predictCorrectProb(mastery: number): number {
  // Linear relationship: P(correct) = 0.1 + 0.8 * mastery
  // Clamped to [0.1, 0.9] range
  return Math.max(0.1, Math.min(0.9, 0.1 + 0.8 * mastery));
}

/**
 * Generate synthetic response time based on difficulty and correctness
 * 
 * @param difficulty - Question difficulty (1-5)
 * @param correct - Whether answer is correct
 * @param rng - Seeded random number generator
 * @returns Response time in milliseconds
 */
export function synthResponseTime(difficulty: number, correct: boolean, rng: SeededRNG): number {
  // Base time increases with difficulty
  const baseTime = 2000 + (difficulty - 1) * 1000;
  
  // Correct answers tend to be faster
  const multiplier = correct ? 0.8 : 1.2;
  
  // Add some randomness
  const noise = rng.gaussian(0, 500);
  
  return Math.max(500, baseTime * multiplier + noise);
}

/**
 * Generate synthetic answer text based on correctness
 * 
 * @param correctAnswer - The correct answer
 * @param correct - Whether to generate correct answer
 * @param rng - Seeded random number generator
 * @returns Answer text
 */
export function synthAnswerText(correctAnswer: number, correct: boolean, rng: SeededRNG): string {
  if (correct) {
    return correctAnswer.toString();
  }
  
  // Generate plausible wrong answer
  const offset = rng.nextInt(-10, 10);
  const wrongAnswer = correctAnswer + offset;
  return Math.max(0, wrongAnswer).toString();
}





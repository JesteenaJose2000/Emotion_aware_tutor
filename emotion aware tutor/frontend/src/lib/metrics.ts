/**
 * Metrics Utilities
 * 
 * Common statistical functions for evaluation metrics and chart data.
 */

/**
 * Calculate the mean of an array of numbers
 * 
 * @param xs - Array of numbers
 * @returns Mean value, or 0 if array is empty
 */
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/**
 * Calculate rolling mean with window size k
 * 
 * @param xs - Array of numbers
 * @param k - Window size (default 5)
 * @returns Array of rolling mean values
 */
export function rollingMean(xs: number[], k = 5): number[] {
  const out: number[] = [];
  let sum = 0;
  
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= k) {
      sum -= xs[i - k];
    }
    out.push(sum / Math.min(i + 1, k));
  }
  
  return out;
}

/**
 * Calculate cumulative sum of an array
 * 
 * @param xs - Array of numbers
 * @returns Array of cumulative sums
 */
export function cumulativeSum(xs: number[]): number[] {
  const out: number[] = [];
  let s = 0;
  
  for (const v of xs) {
    s += v;
    out.push(s);
  }
  
  return out;
}

/**
 * Calculate standard deviation of an array
 * 
 * @param xs - Array of numbers
 * @returns Standard deviation, or 0 if array is empty
 */
export function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  
  const m = mean(xs);
  const variance = xs.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * Calculate median of an array
 * 
 * @param xs - Array of numbers
 * @returns Median value, or 0 if array is empty
 */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate percentile of an array
 * 
 * @param xs - Array of numbers
 * @param p - Percentile (0-100)
 * @returns Percentile value
 */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  
  const sorted = [...xs].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  
  if (Number.isInteger(index)) {
    return sorted[index];
  }
  
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}


/**
 * Histogram Utilities
 */

/**
 * Count occurrences of values in an array
 * 
 * @param xs - Array of values to count
 * @returns Object mapping values to their counts
 */
export function countBy<T extends string | number>(xs: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  xs.forEach(k => m[String(k)] = (m[String(k)] ?? 0) + 1);
  return m;
}

/**
 * Create action key from difficulty delta and feedback
 * 
 * @param diffDelta - Difficulty delta (-1, 0, or 1)
 * @param feedback - Feedback type
 * @returns Action key string
 */
export function createActionKey(diffDelta: number, feedback: string): string {
  return `${diffDelta}:${feedback}`;
}

/**
 * Parse action key back to components
 * 
 * @param actionKey - Action key string
 * @returns Object with diffDelta and feedback
 */
export function parseActionKey(actionKey: string): { diffDelta: number; feedback: string } {
  const [diffDelta, feedback] = actionKey.split(':');
  return {
    diffDelta: parseInt(diffDelta, 10),
    feedback: feedback
  };
}








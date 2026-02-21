/**
 * A/B Testing Types
 */

export type RunSummary = {
  turns: number;
  accuracyMean: number;
  engagementMean: number;
  cumulativeReward: number;
  actionCounts: Record<string, number>;
  difficultySeries: number[];
};

export type PolicyKind = "baseline" | "linucb" | "thompson";

export type RewardPreset = "baseline" | "aggressive" | "conservative" | "custom";

export type ActionKey = string; // Format: "diff_delta:feedback" e.g., "-1:hint", "0:encourage", "+1:neutral"



export const DEFAULT_FUSION_LAMBDA =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_FUSION_LAMBDA
    ? Number((process as any).env.NEXT_PUBLIC_FUSION_LAMBDA)
    : 0.6); // Default to 0.6 (60% face, 40% voice) - balanced fusion mode

/** clamp to [0,1] just in case */
export const FUSION_LAMBDA = Math.min(1, Math.max(0, DEFAULT_FUSION_LAMBDA));



 
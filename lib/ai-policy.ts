// This contract is deliberately fixed. Never substitute a model or increase effort.
export const AI_MODEL = "claude-haiku-5-5";
export const AI_EFFORT = "low";
export const AI_MAX_OUTPUT_TOKENS = 1200;
export const AI_RESERVE_CENTS = 1;
export const AI_PRODUCTION_BUDGET_CENTS = 19900;
export const AI_LOCAL_BUDGET_CENTS = 100;
export const AI_MAX_REQUEST_BYTES = 6000;
export const AI_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    line: {
      type: "string",
      description: "A funny, kind pigeon judge ruling. At most 220 characters.",
    },
    step: {
      type: "string",
      description:
        "One useful, concrete, tiny first step for this task. At most 240 characters.",
    },
  },
  required: ["line", "step"],
  additionalProperties: false,
};
export function budgetLimit(value: string | undefined) {
  const parsed = Number(value ?? AI_PRODUCTION_BUDGET_CENTS);
  return Number.isInteger(parsed) && parsed >= 0
    ? Math.min(parsed, AI_PRODUCTION_BUDGET_CENTS)
    : 0;
}
export function estimatedCostMicros(inputTokens: number, outputTokens: number) {
  // Published standard Haiku 5.5 rates: $0.10 input / $0.50 output per MTok.
  return Math.ceil(
    Math.max(0, inputTokens) * 0.1 + Math.max(0, outputTokens) * 0.5,
  );
}

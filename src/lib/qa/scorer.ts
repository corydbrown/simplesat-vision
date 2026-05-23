export type QaScorerView = {
  source: "ai" | "human";
  /** Display name. For AI: pretty-printed provider id ("Mock provider").
   *  For human: team member name. */
  displayName: string;
  rawModel: string;
};

export function resolveScorer(rawModel: string): QaScorerView {
  if (rawModel.startsWith("mock")) {
    return { source: "ai", displayName: "Mock provider", rawModel };
  }
  if (rawModel.startsWith("claude")) {
    return { source: "ai", displayName: "Claude", rawModel };
  }
  return { source: "ai", displayName: "AI", rawModel };
}

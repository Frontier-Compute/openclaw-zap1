export interface PolicyRules {
  blockedTools?: string[];
  requireApproval?: string[];
  maxSpendZat?: number;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export function evaluatePolicy(
  toolName: string,
  _params: Record<string, unknown>,
  rules: PolicyRules,
): PolicyResult {
  if (rules.blockedTools?.includes(toolName)) {
    return { allowed: false, reason: `tool "${toolName}" blocked by agent policy` };
  }

  if (rules.requireApproval?.includes(toolName)) {
    return { allowed: false, reason: `tool "${toolName}" requires operator approval` };
  }

  return { allowed: true };
}

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { readStringParam } from "openclaw/plugin-sdk/provider-web-search";

interface Zap1HookConfig {
  apiUrl: string;
  apiKey: string;
  agentId: string;
}

function getHookConfig(api: OpenClawPluginApi): Zap1HookConfig | null {
  const cfg = api.config as any;
  if (!cfg?.apiKey || !cfg?.agentId) return null;
  return {
    apiUrl: cfg.apiUrl || "https://pay.frontiercompute.io",
    apiKey: cfg.apiKey,
    agentId: cfg.agentId,
  };
}

async function attestEvent(
  cfg: Zap1HookConfig,
  eventType: string,
  fields: Record<string, unknown>,
): Promise<string | null> {
  try {
    const resp = await fetch(`${cfg.apiUrl}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        event_type: eventType,
        wallet_hash: cfg.agentId,
        ...fields,
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { leaf_hash?: string };
    return data.leaf_hash ?? null;
  } catch {
    return null;
  }
}

function sha256Hex(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  // Use sync hash for hook context - crypto.subtle not always available
  // Fall back to simple deterministic hash for non-crypto contexts
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

export function registerZap1Hooks(api: OpenClawPluginApi) {
  const cfg = getHookConfig(api);
  if (!cfg) return;

  // Hook: attest every tool result before it's persisted to session history
  api.registerHook?.("tool_result_persist", async (context: any) => {
    const toolName = context?.toolName || context?.name || "unknown";
    const resultText =
      typeof context?.result === "string"
        ? context.result
        : JSON.stringify(context?.result ?? "");

    const inputHash = sha256Hex(JSON.stringify(context?.input ?? ""));
    const outputHash = sha256Hex(resultText.slice(0, 4096));

    await attestEvent(cfg, "AGENT_ACTION", {
      agent_id: cfg.agentId,
      action_type: toolName,
      input_hash: inputHash,
      output_hash: outputHash,
    });

    return context;
  });

  // Hook: attest every outbound message before dispatch to channel
  api.registerHook?.("message_sending", async (context: any) => {
    const messageText =
      typeof context?.text === "string" ? context.text : "";

    if (messageText.length > 0) {
      const outputHash = sha256Hex(messageText.slice(0, 4096));
      await attestEvent(cfg, "AGENT_ACTION", {
        agent_id: cfg.agentId,
        action_type: "message_send",
        input_hash: sha256Hex(context?.channelId ?? "unknown"),
        output_hash: outputHash,
      });
    }

    return context;
  });

  // Hook: capture LLM output hash for audit trail
  api.registerHook?.("llm_output", async (context: any) => {
    const outputText =
      typeof context?.text === "string"
        ? context.text
        : typeof context?.content === "string"
          ? context.content
          : "";

    if (outputText.length > 0) {
      const outputHash = sha256Hex(outputText.slice(0, 8192));
      await attestEvent(cfg, "AGENT_ACTION", {
        agent_id: cfg.agentId,
        action_type: "llm_response",
        input_hash: sha256Hex(context?.model ?? "unknown"),
        output_hash: outputHash,
      });
    }

    return context;
  });
}

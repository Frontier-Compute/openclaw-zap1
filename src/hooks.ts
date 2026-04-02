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

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

    const inputHash = await sha256Hex(JSON.stringify(context?.input ?? ""));
    const outputHash = await sha256Hex(resultText.slice(0, 4096));

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
      const outputHash = await sha256Hex(messageText.slice(0, 4096));
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
      const outputHash = await sha256Hex(outputText.slice(0, 8192));
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

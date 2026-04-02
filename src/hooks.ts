import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import { evaluatePolicy, type PolicyRules } from "./policy.js";

interface Zap1HookConfig {
  apiUrl: string;
  apiKey: string;
  agentId: string;
  policyRules: PolicyRules;
  proofInterval: number;
}

function getHookConfig(api: OpenClawPluginApi): Zap1HookConfig | null {
  const cfg = api.config as any;
  if (!cfg?.apiKey || !cfg?.agentId) return null;
  return {
    apiUrl: cfg.apiUrl || "https://pay.frontiercompute.io",
    apiKey: cfg.apiKey,
    agentId: cfg.agentId,
    policyRules: cfg.policyRules || {},
    proofInterval: cfg.proofInterval || 10,
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

  let actionCounter = 0;

  // Hook: policy enforcement before tool execution
  api.registerHook?.("before_tool_call", async (context: any) => {
    const toolName = context?.toolName || context?.name || "unknown";
    const result = evaluatePolicy(toolName, context?.input || {}, cfg.policyRules);

    if (!result.allowed) {
      await attestEvent(cfg, "AGENT_ACTION", {
        agent_id: cfg.agentId,
        action_type: "policy_block",
        input_hash: await sha256Hex(toolName),
        output_hash: await sha256Hex(result.reason || "blocked"),
      });
      return { block: true, reason: result.reason };
    }

    return context;
  }, { priority: 100 });

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

    actionCounter++;
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
        input_hash: await sha256Hex(context?.channelId ?? "unknown"),
        output_hash: outputHash,
      });
      actionCounter++;
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
        input_hash: await sha256Hex(context?.model ?? "unknown"),
        output_hash: outputHash,
      });
      actionCounter++;
    }

    return context;
  });

  // Hook: attest inbound messages with sender identity
  api.registerHook?.("inbound_claim", async (context: any) => {
    const content = context?.content || "";
    if (content.length > 0) {
      const senderId = context?.senderId || "unknown";
      const channel = context?.channel || "unknown";
      const messageId = context?.messageId || "";

      await attestEvent(cfg, "AGENT_ACTION", {
        agent_id: cfg.agentId,
        action_type: "message_received",
        input_hash: await sha256Hex(`${channel}:${senderId}:${messageId}`),
        output_hash: await sha256Hex(content.slice(0, 4096)),
      });
      actionCounter++;
    }

    // Don't claim -- just observe
    return undefined;
  }, { priority: 10 });

  // Hook: attest session boundaries
  api.registerHook?.("session_start", async (_context: any) => {
    await attestEvent(cfg, "AGENT_ACTION", {
      agent_id: cfg.agentId,
      action_type: "session_start",
      input_hash: await sha256Hex(new Date().toISOString()),
      output_hash: await sha256Hex("active"),
    });
  });

  api.registerHook?.("session_end", async (_context: any) => {
    await attestEvent(cfg, "AGENT_ACTION", {
      agent_id: cfg.agentId,
      action_type: "session_end",
      input_hash: await sha256Hex(new Date().toISOString()),
      output_hash: await sha256Hex(`actions:${actionCounter}`),
    });
  });

  // Hook: inject proof summary every N actions
  api.registerHook?.("before_agent_reply", async (_context: any) => {
    if (cfg.proofInterval <= 0 || actionCounter % cfg.proofInterval !== 0 || actionCounter === 0) {
      return undefined;
    }

    try {
      const resp = await fetch(`${cfg.apiUrl}/agent/${cfg.agentId}`);
      if (!resp.ok) return undefined;
      const status = (await resp.json()) as any;

      const statsResp = await fetch(`${cfg.apiUrl}/stats`);
      if (!statsResp.ok) return undefined;
      const stats = (await statsResp.json()) as any;

      return {
        handled: true,
        reply: [
          `Attestation checkpoint (${actionCounter} actions this session):`,
          `  Events: ${status.total_events || 0}`,
          `  Actions: ${status.actions || 0}`,
          `  Anchors: ${stats.total_anchors || 0}`,
          `  Verify: ${cfg.apiUrl}/agent/${cfg.agentId}`,
        ].join("\n"),
      };
    } catch {
      return undefined;
    }
  }, { priority: 5 });
}

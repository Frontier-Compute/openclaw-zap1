import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";

interface Zap1Config {
  apiUrl?: string;
  apiKey?: string;
}

function getConfig(ctx: OpenClawPluginToolContext): Zap1Config {
  const config = ctx.pluginConfig ?? {};
  return {
    apiUrl: (config as any).apiUrl || "https://pay.frontiercompute.io",
    apiKey: (config as any).apiKey,
  };
}

async function zap1Fetch(url: string, init?: RequestInit): Promise<any> {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new Error(`ZAP1 API returned ${resp.status}`);
  return resp.json();
}

export function createZap1Tools(ctx: OpenClawPluginToolContext) {
  const cfg = getConfig(ctx);
  const base = cfg.apiUrl!;

  return [
    {
      name: "zap1_protocol_info",
      description: "Get ZAP1 protocol metadata: version, event types, hash function, FROST status.",
      parameters: { type: "object" as const, properties: {}, required: [] as string[] },
      async execute() {
        const data = await zap1Fetch(`${base}/protocol/info`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_stats",
      description: "Get current network stats: anchor count, leaf count, event type distribution.",
      parameters: { type: "object" as const, properties: {}, required: [] as string[] },
      async execute() {
        const data = await zap1Fetch(`${base}/stats`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_verify_proof",
      description: "Check if an attestation proof is valid by leaf hash. Returns validity status.",
      parameters: {
        type: "object" as const,
        properties: {
          leaf_hash: { type: "string", description: "64-char hex leaf hash to verify" },
        },
        required: ["leaf_hash"],
      },
      async execute({ leaf_hash }: { leaf_hash: string }) {
        const data = await zap1Fetch(`${base}/verify/${leaf_hash}/check`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_get_proof_bundle",
      description: "Get the full proof bundle for a leaf hash. Contains everything needed for independent verification.",
      parameters: {
        type: "object" as const,
        properties: {
          leaf_hash: { type: "string", description: "64-char hex leaf hash" },
        },
        required: ["leaf_hash"],
      },
      async execute({ leaf_hash }: { leaf_hash: string }) {
        const data = await zap1Fetch(`${base}/verify/${leaf_hash}/proof.json`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_anchor_status",
      description: "Get current Merkle tree state: root, unanchored leaves, anchor recommendation.",
      parameters: { type: "object" as const, properties: {}, required: [] as string[] },
      async execute() {
        const data = await zap1Fetch(`${base}/anchor/status`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_anchor_history",
      description: "Get all anchored Merkle roots with txids and block heights.",
      parameters: { type: "object" as const, properties: {}, required: [] as string[] },
      async execute() {
        const data = await zap1Fetch(`${base}/anchor/history`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_recent_events",
      description: "Get recent attestation events from the protocol.",
      parameters: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Number of events to return (default 10)" },
        },
        required: [] as string[],
      },
      async execute({ limit }: { limit?: number }) {
        const data = await zap1Fetch(`${base}/events?limit=${limit || 10}`);
        return JSON.stringify(data, null, 2);
      },
    },
    {
      name: "zap1_decode_memo",
      description: "Decode a Zcash shielded memo. Identifies ZAP1, ZIP 302, text, binary, and empty formats.",
      parameters: {
        type: "object" as const,
        properties: {
          memo_hex: { type: "string", description: "Hex-encoded memo bytes" },
        },
        required: ["memo_hex"],
      },
      async execute({ memo_hex }: { memo_hex: string }) {
        const resp = await fetch(`${base}/memo/decode`, {
          method: "POST",
          body: memo_hex,
        });
        if (!resp.ok) throw new Error(`Decode returned ${resp.status}`);
        return JSON.stringify(await resp.json(), null, 2);
      },
    },
    {
      name: "zap1_create_event",
      description: "Create a lifecycle attestation event and commit it to the Merkle tree. Requires API key. Supported types: CONTRACT_ANCHOR (needs serial_number, contract_sha256), DEPLOYMENT (needs serial_number, facility_id), HOSTING_PAYMENT (needs serial_number, month, year), SHIELD_RENEWAL (needs year), TRANSFER (needs new_wallet_hash, serial_number), EXIT (needs serial_number), GOVERNANCE_PROPOSAL (needs proposal_id, proposal_hash), GOVERNANCE_VOTE (needs proposal_id, vote_commitment), GOVERNANCE_RESULT (needs proposal_id, result_hash). PROGRAM_ENTRY and OWNERSHIP_ATTEST are created automatically by the scanner.",
      parameters: {
        type: "object" as const,
        properties: {
          event_type: {
            type: "string",
            description: "Event type: CONTRACT_ANCHOR, DEPLOYMENT, HOSTING_PAYMENT, SHIELD_RENEWAL, TRANSFER, EXIT, GOVERNANCE_PROPOSAL, GOVERNANCE_VOTE, GOVERNANCE_RESULT",
          },
          wallet_hash: { type: "string", description: "Participant wallet identifier" },
          serial_number: { type: "string", description: "Machine/asset serial (for most types)" },
          contract_sha256: { type: "string", description: "SHA-256 of contract artifact (for CONTRACT_ANCHOR)" },
          facility_id: { type: "string", description: "Facility identifier (for DEPLOYMENT)" },
          month: { type: "number", description: "Month 1-12 (for HOSTING_PAYMENT)" },
          year: { type: "number", description: "Year 2020-2100 (for HOSTING_PAYMENT, SHIELD_RENEWAL)" },
          new_wallet_hash: { type: "string", description: "New owner wallet hash (for TRANSFER)" },
          proposal_id: { type: "string", description: "Governance proposal ID (for governance types)" },
          proposal_hash: { type: "string", description: "Proposal content hash (for GOVERNANCE_PROPOSAL)" },
          vote_commitment: { type: "string", description: "Vote commitment hash (for GOVERNANCE_VOTE)" },
          result_hash: { type: "string", description: "Result hash (for GOVERNANCE_RESULT)" },
        },
        required: ["event_type", "wallet_hash"],
      },
      async execute(params: Record<string, string>) {
        if (!cfg.apiKey) return "Error: API key required for write operations. Set apiKey in plugin config.";
        const resp = await fetch(`${base}/event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(params),
        });
        if (!resp.ok) {
          const text = await resp.text();
          return `Error ${resp.status}: ${text}`;
        }
        return JSON.stringify(await resp.json(), null, 2);
      },
    },
    {
      name: "zap1_lifecycle",
      description: "Get the full lifecycle view for a participant wallet hash.",
      parameters: {
        type: "object" as const,
        properties: {
          wallet_hash: { type: "string", description: "Participant wallet identifier" },
        },
        required: ["wallet_hash"],
      },
      async execute({ wallet_hash }: { wallet_hash: string }) {
        const data = await zap1Fetch(`${base}/lifecycle/${wallet_hash}`);
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}

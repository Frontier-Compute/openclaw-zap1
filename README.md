# openclaw-zap1

[![npm](https://img.shields.io/npm/v/@frontiercompute/openclaw-zap1)](https://www.npmjs.com/package/@frontiercompute/openclaw-zap1)
![downloads](https://img.shields.io/npm/dw/@frontiercompute/openclaw-zap1)
![license](https://img.shields.io/npm/l/@frontiercompute/openclaw-zap1)

Zcash attestation for OpenClaw agents. Messages, commands, sessions, and agent lifecycle events get anchored to Zcash mainnet via ZAP1.

Zcash attestation plugin for OpenClaw. Live proofs: [pay.frontiercompute.io](https://pay.frontiercompute.io) | Demo: [00zeven.cash](https://00zeven.cash)

No code changes to your agent. Eight hooks run silently, track sessions, attest messages, and emit proof checkpoints.

## Install

```bash
openclaw plugins install @frontiercompute/openclaw-zap1
```

## Config

```json
{
  "agentId": "my-agent-001",
  "apiKey": "your-zap1-api-key",
  "apiUrl": "https://pay.frontiercompute.io",
  "policyRules": {
    "blockedTools": ["dangerous_tool"],
    "restrictedTools": ["send_funds"]
  },
  "proofInterval": 10
}
```

- `agentId`: your agent's identity. Gets committed to the Merkle tree on first action.
- `apiKey`: required for attestation. Get one by deploying your own ZAP1 instance or requesting access.
- `apiUrl`: optional, defaults to the public API.
- `policyRules`: optional. `blockedTools` prevents execution and attests the block. `restrictedTools` halts until operator confirms.
- `proofInterval`: actions between proof checkpoints. Default 10. Set 0 to disable.

Without `apiKey` and `agentId`, only the read-only tools are available. The hooks don't fire.

## Hooks (8)

All hooks fire automatically when configured. No agent code changes needed.

| Hook | What it does |
|------|-------------|
| `message:sent` | Attests outbound messages. Hashes channel + content. |
| `message:received` | Attests inbound messages with sender identity, channel, and content hash. |
| `message:preprocessed` | Attests enriched message body before it reaches the LLM. |
| `message:transcribed` | Attests audio transcriptions with message ID and transcript hash. |
| `agent:bootstrap` | Attests session open with timestamp on agent startup. |
| `session:patch` | Attests session config changes and state transitions. |
| `gateway:startup` | Attests gateway initialization. |
| `command` | Attests command events. Every N actions (configurable via `proofInterval`), injects a proof checkpoint with attestation stats. |

## What gets attested

| Agent does | What gets attested | ZAP1 event |
|---|---|---|
| Sends a message | Channel + message hash | AGENT_ACTION |
| Receives a message | Sender + channel + content hash | AGENT_ACTION |
| Preprocesses a message | Enriched body hash | AGENT_ACTION |
| Transcribes audio | Message ID + transcript hash | AGENT_ACTION |
| Starts up (bootstrap) | Timestamp | AGENT_ACTION |
| Patches a session | Session key + patch hash | AGENT_ACTION |
| Gateway starts | Timestamp | AGENT_ACTION |
| Runs a command | Session key + action name | AGENT_ACTION |

Every attestation creates a leaf in the ZAP1 Merkle tree. The root is periodically anchored to Zcash mainnet. Any leaf is independently verifiable from the proof path.

The agent's financial activity (if using an Orchard wallet) stays shielded. The attestation layer proves what the agent did without revealing amounts or counterparties.

## Tools (14)

| Tool | What it does |
|------|-------------|
| `zap1_protocol_info` | Protocol version, event types, hash function |
| `zap1_stats` | Anchor count, leaf count, event distribution |
| `zap1_verify_proof` | Check if a proof is valid by leaf hash |
| `zap1_get_proof_bundle` | Full proof bundle for independent verification |
| `zap1_anchor_status` | Current Merkle tree state |
| `zap1_anchor_history` | All anchored roots with txids and block heights |
| `zap1_recent_events` | Recent attestation events |
| `zap1_decode_memo` | Decode any Zcash shielded memo format |
| `zap1_create_event` | Create an attestation event (lifecycle, governance, agent) |
| `zap1_lifecycle` | Full lifecycle view for an agent or participant |
| `zap1_agent_status` | Attestation summary for an agent |
| `zap1_cohort_stats` | Mining cohort statistics |
| `zap1_list_webhooks` | List registered webhooks |
| `zap1_create_api_key` | Provision a tenant API key (admin) |

## Policy enforcement

The `policyRules` config defines tool-level access rules:

```json
{
  "policyRules": {
    "blockedTools": ["shell_exec", "file_delete"],
    "restrictedTools": ["send_funds", "deploy_contract"]
  }
}
```

The policy module (`src/policy.ts`) exposes `evaluatePolicy()` for use in your agent's tool pipeline. Blocked tools return a rejection reason. Tools on the `restrictedTools` list halt until operator confirms. Wire this into your agent's tool dispatch to enforce rules before execution.

## Verify your agent's track record

```bash
# See your agent's attestation history
curl https://pay.frontiercompute.io/lifecycle/my-agent-001

# Agent-specific status
curl https://pay.frontiercompute.io/agent/my-agent-001

# Verify any specific proof
curl https://pay.frontiercompute.io/verify/{leaf_hash}/check

# Export a proof bundle
curl https://pay.frontiercompute.io/verify/{leaf_hash}/proof.json
```

Proofs verifiable on 7 chains: Ethereum, Arbitrum, Base, Hyperliquid, NEAR, Sui. Sepolia (testnet). Browser verification at [frontiercompute.cash/verify.html](https://frontiercompute.cash/verify.html).

## Agent custody (new)

Pair with `@frontiercompute/zcash-ika` for honest-majority split-key custody (2PC-MPC via Ika, not ZK-trustless). Your agent holds half a secp256k1 key. Spend policy enforced by Sui Move contract. One dWallet signs ZEC, BTC, and ETH. npm: [zcash-ika](https://www.npmjs.com/package/@frontiercompute/zcash-ika).

## Deploy your own

```bash
git clone https://github.com/Frontier-Compute/zap1.git
cd zap1
bash scripts/operator-setup.sh myoperator 3081
cd operators/myoperator && ./run.sh
```

Your own Merkle tree, your own anchor address, your own API keys. MIT licensed.

## Protocol

- 9 active mainnet event types (lifecycle + merkle root). Protocol defines additional families for staking, governance, ZSA, and agents — see ONCHAIN_PROTOCOL.md.
- Live mainnet anchors. Check: https://pay.frontiercompute.io/stats. BLAKE2b-256 with domain-separated personalization
- Verification SDKs: Rust (crates.io), JS (npm), Solidity (Sepolia)
- ZIP draft: [zcash/zips PR #1243](https://github.com/zcash/zips/pull/1243)
- Full spec: [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md)

## Related Packages

| Package | What it does |
|---------|-------------|
| [@frontiercompute/zcash-ika](https://www.npmjs.com/package/@frontiercompute/zcash-ika) | Zcash + Bitcoin signing via Ika 2PC-MPC |
| [@frontiercompute/zcash-mcp](https://www.npmjs.com/package/@frontiercompute/zcash-mcp) | MCP server for Zcash (22 tools) |
| [@frontiercompute/zap1](https://www.npmjs.com/package/@frontiercompute/zap1) | ZAP1 attestation client |
| [@frontiercompute/silo-zap1](https://www.npmjs.com/package/@frontiercompute/silo-zap1) | Silo agent attestation via ZAP1 |

## License

MIT

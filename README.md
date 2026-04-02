# 00zeven

Zcash attestation layer for OpenClaw agents.

Install the plugin and every tool call, LLM response, and outbound message your agent makes gets anchored to Zcash mainnet via ZAP1. No code changes to your agent. Seven hooks run silently, enforce policy, track sessions, and emit proof checkpoints.

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
    "requireApproval": ["send_funds"]
  },
  "proofInterval": 10
}
```

- `agentId`: your agent's identity. Gets committed to the Merkle tree on first action.
- `apiKey`: required for attestation. Get one by deploying your own ZAP1 instance or requesting access.
- `apiUrl`: optional, defaults to the public API.
- `policyRules`: optional. `blockedTools` prevents execution and attests the block. `requireApproval` halts until operator confirms.
- `proofInterval`: actions between proof checkpoints. Default 10. Set 0 to disable.

Without `apiKey` and `agentId`, only the read-only tools are available. The hooks don't fire.

## Hooks (7)

All hooks fire automatically when configured. No agent code changes needed.

| Hook | What it does |
|------|-------------|
| `before_tool_call` | Policy enforcement. Blocks tools on the deny list, attests the block event. Runs at priority 100 (first). |
| `tool_result_persist` | Attests every tool result before it hits session history. Hashes input and output. |
| `message_sending` | Attests outbound messages before dispatch. Hashes channel + content. |
| `llm_output` | Captures LLM response hashes for the audit trail. |
| `inbound_claim` | Observes inbound messages. Attests sender, channel, and content hash. Does not claim. |
| `session_start` | Attests session open with timestamp. |
| `session_end` | Attests session close with action count. |

Every N actions (configurable via `proofInterval`), the `before_agent_reply` hook injects a proof checkpoint with the agent's current attestation stats and a verification link.

## What gets attested

| Agent does | What gets attested | ZAP1 event |
|---|---|---|
| Calls any tool | Tool name + input/output hashes | AGENT_ACTION |
| Gets LLM response | Model name + response hash | AGENT_ACTION |
| Sends a message | Channel + message hash | AGENT_ACTION |
| Receives a message | Sender + channel + content hash | AGENT_ACTION |
| Starts a session | Timestamp | AGENT_ACTION |
| Ends a session | Timestamp + action count | AGENT_ACTION |
| Hits a blocked tool | Tool name + block reason | AGENT_ACTION (policy_block) |

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

Define `policyRules` in config to control what your agent can do:

```json
{
  "policyRules": {
    "blockedTools": ["shell_exec", "file_delete"],
    "requireApproval": ["send_funds", "deploy_contract"]
  }
}
```

Blocked tools are rejected before execution. The rejection is attested so the block itself becomes part of the verifiable record. Tools requiring approval halt and return a reason string.

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

Proofs are also verifiable on Ethereum via the Solidity verifier at `0x3fD65055A8dC772C848E7F227CE458803005C87F` (Sepolia).

## Deploy your own

```bash
git clone https://github.com/Frontier-Compute/zap1.git
cd zap1
bash scripts/operator-setup.sh myoperator 3081
cd operators/myoperator && ./run.sh
```

Your own Merkle tree, your own anchor address, your own API keys. MIT licensed.

## Protocol

- 18 deployed event types across 7 families (lifecycle, staking, governance, ZSA, mining, validators, agents)
- 5 mainnet anchors, BLAKE2b-256 with domain-separated personalization
- Verification SDKs: Rust (crates.io), JS (npm), Solidity (Sepolia)
- ZIP draft: [zcash/zips PR #1243](https://github.com/zcash/zips/pull/1243)
- Full spec: [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md)

## License

MIT

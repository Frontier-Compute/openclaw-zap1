# 00zeven

Zcash attestation layer for OpenClaw agents.

Install the plugin and every tool call, LLM response, and outbound message your agent makes gets anchored to Zcash mainnet via ZAP1. No code changes to your agent. The hooks run silently.

## Install

```bash
openclaw plugins install @frontiercompute/openclaw-zap1
```

## Config

```json
{
  "agentId": "my-agent-001",
  "apiKey": "your-zap1-api-key",
  "apiUrl": "https://pay.frontiercompute.io"
}
```

- `agentId`: your agent's identity. Gets committed to the Merkle tree on first action.
- `apiKey`: required for attestation. Get one by deploying your own ZAP1 instance or requesting access.
- `apiUrl`: optional, defaults to the public API.

Without `apiKey` and `agentId`, only the read-only tools are available. The hooks don't fire.

## What happens automatically

When configured with `agentId` and `apiKey`:

| Agent does | What gets attested | ZAP1 event |
|---|---|---|
| Calls any tool | Tool name + input/output hashes | AGENT_ACTION |
| Gets LLM response | Model name + response hash | AGENT_ACTION |
| Sends a message | Channel + message hash | AGENT_ACTION |

Every attestation creates a leaf in the ZAP1 Merkle tree. The root is periodically anchored to Zcash mainnet. Any leaf is independently verifiable from the proof path.

The agent's financial activity (if using an Orchard wallet) stays shielded. The attestation layer proves what the agent did without revealing amounts or counterparties.

## Manual tools (10)

The plugin also registers 10 tools the agent can call directly:

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

## Verify your agent's track record

```bash
# See your agent's attestation history
curl https://pay.frontiercompute.io/lifecycle/my-agent-001

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

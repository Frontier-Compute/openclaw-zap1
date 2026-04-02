# openclaw-zap1

ZAP1 attestation tools for OpenClaw agents. Any OpenClaw agent can attest actions to Zcash, verify proofs, and export evidence.

## Install

```bash
openclaw plugins install @frontiercompute/openclaw-zap1
```

## What your agent gets

10 tools for interacting with the ZAP1 attestation protocol on Zcash:

| Tool | What it does |
|------|-------------|
| `zap1_protocol_info` | Protocol version, event types, hash function |
| `zap1_stats` | Anchor count, leaf count, event distribution |
| `zap1_verify_proof` | Verify an attestation by leaf hash |
| `zap1_get_proof_bundle` | Full proof bundle for independent verification |
| `zap1_anchor_status` | Current Merkle tree state |
| `zap1_anchor_history` | All anchored roots with txids and block heights |
| `zap1_recent_events` | Recent attestation events |
| `zap1_decode_memo` | Decode any Zcash shielded memo format |
| `zap1_create_event` | Create an attestation event (requires API key) |
| `zap1_lifecycle` | Full lifecycle view for a participant |

## Config

```json
{
  "apiUrl": "https://pay.frontiercompute.io",
  "apiKey": "your-api-key-for-write-ops"
}
```

Read-only tools work without an API key. Creating events requires one.

## Example conversation

> "Check the ZAP1 protocol status"

Agent calls `zap1_protocol_info` and returns: version 3.0.0, 15 event types, 12 deployed, 3 reserved.

> "Verify the proof for leaf 075b00df..."

Agent calls `zap1_verify_proof` with the leaf hash. Returns: valid, anchored at block 3,286,631, txid 98e1d6a0...

> "Create a governance proposal attestation"

Agent calls `zap1_create_event` with event_type GOVERNANCE_PROPOSAL, wallet_hash, proposal_id, and proposal_hash. Returns: leaf hash, root hash, verify URL.

## Protocol

ZAP1 commits typed lifecycle events to a BLAKE2b Merkle tree and anchors roots on Zcash mainnet via shielded memos. Proofs are independently verifiable. Cross-chain verification available via the Solidity verifier on Ethereum Sepolia.

- Protocol: [github.com/Frontier-Compute/zap1](https://github.com/Frontier-Compute/zap1)
- Spec: [ONCHAIN_PROTOCOL.md](https://github.com/Frontier-Compute/zap1/blob/main/ONCHAIN_PROTOCOL.md)
- Tutorial: [TUTORIAL.md](https://github.com/Frontier-Compute/zap1/blob/main/TUTORIAL.md)

## License

MIT

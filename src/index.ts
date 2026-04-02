import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createZap1Tools } from "./tools.js";

export default definePluginEntry({
  id: "zap1",
  name: "ZAP1 Attestation",
  description: "Attest agent actions to Zcash via ZAP1. Verify proofs, check anchors, export evidence.",
  register(api) {
    api.registerTool(createZap1Tools);
  },
});

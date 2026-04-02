import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { createZap1Tools } from "./src/tools.js";
import { registerZap1Hooks } from "./src/hooks.js";

export default definePluginEntry({
  id: "zap1",
  name: "00zeven",
  description:
    "Zcash attestation layer for OpenClaw agents. Automatic behavioral proof via hooks + 10 protocol tools. Every tool call, LLM response, and message gets anchored to Zcash.",
  register(api) {
    for (const tool of createZap1Tools(api)) {
      api.registerTool(tool as AnyAgentTool);
    }
    registerZap1Hooks(api);
  },
});

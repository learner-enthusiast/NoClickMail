import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  noExternal: [/^@repo\//],
  external: [
    // optional peer imports inside @corsair-dev/mcp — not installed, not needed
    "@anthropic-ai/claude-agent-sdk",
    "@mastra/core/tools",
    "@ai-sdk/mcp",
    // heavy runtime deps — keep in node_modules
    "corsair",
    /^@corsair-dev\//,
    "@openai/agents",
  ],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  env: { IS_SERVER_BUILD: "true" },
  loader: { ".json": "copy" },
  minify: true,
  sourcemap: false,
});

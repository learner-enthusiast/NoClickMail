/** Corsair MCP tools exposed to the determiner model (must stay in sync with TenantCorsairAgent). */
export const CORSAIR_MCP_TOOLS = [
  {
    name: "list_operations",
    description: "List available Corsair plugin operations (Gmail, Google Calendar).",
  },
  {
    name: "get_schema",
    description: "Get JSON schema for a specific Corsair operation before calling run_script.",
  },
  {
    name: "run_script",
    description: "Execute a Corsair plugin operation (search/read/draft Gmail, calendar events, etc.).",
  },
] as const;

export const CORSAIR_MCP_PLUGINS = [
  {
    name: "gmail",
    description: "Search, read, draft, and manage the user's Gmail mailbox.",
  },
  {
    name: "googlecalendar",
    description: "List, create, and update Google Calendar events and free/busy.",
  },
] as const;

export function formatCorsairToolsForPrompt(): string {
  const tools = CORSAIR_MCP_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  const plugins = CORSAIR_MCP_PLUGINS.map((p) => `- ${p.name}: ${p.description}`).join("\n");
  return `MCP tools:\n${tools}\n\nPlugins:\n${plugins}`;
}

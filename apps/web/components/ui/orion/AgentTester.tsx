import { runAgent } from "~/hooks/agent.ts";
import { Button } from "../button";
import { useState } from "react";

function AgentTester() {
  const { mutateAsync, status } = runAgent();
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");

  const isRunning = status === "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setOutput("");
    try {
      const stream = await mutateAsync({ prompt });
      for await (const event of stream) {
        if (event.type === "delta") {
          setOutput((prev) => prev + event.text);
        }
      }
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Agent failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent to do something…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          disabled={isRunning}
        />
        <Button type="submit" disabled={isRunning}>
          {isRunning ? "Running…" : "Run"}
        </Button>
      </div>

      {output && (
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted p-3 text-sm">{output}</pre>
      )}
    </form>
  );
}

export default AgentTester;

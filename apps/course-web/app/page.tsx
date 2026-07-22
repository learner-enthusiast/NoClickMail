"use client";

import { useState } from "react";
import type { CourseAskOutput } from "~/hooks/course-rag";
import { courseAsk } from "~/hooks/course-rag";

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const { mutateAsync, status, data, error, reset } = courseAsk();
  const isPending = status === "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text || isPending) return;
    reset();
      await mutateAsync({ question: text, courseId: "udemy-course" });
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginTop: 0 }}>Course RAG</h1>
      <p style={{ color: "#9fb0c3", lineHeight: 1.5 }}>
        Ask questions about the indexed Udemy course. Answers include lecture timestamps when the
        topic is covered.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does the instructor explain about…?"
          rows={4}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #2a3544",
            background: "#121820",
            color: "inherit",
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={isPending || !question.trim()}
          style={{
            justifySelf: "start",
            padding: "0.6rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
          }}
        >
          {isPending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && (
        <p style={{ color: "#f87171", marginTop: "1rem" }}>
          {error.message ?? "Something went wrong"}
        </p>
      )}

      {data && (
        <section style={{ marginTop: "1.5rem" }}>
          {data.meta.qualityRank != null && (
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Quality {data.meta.qualityRank}/10 · {data.meta.attempts ?? 1} attempt(s)
              {data.meta.taughtInCourse === false && " · not found in course"}
            </p>
          )}
          <h2 style={{ fontSize: "1rem", color: "#9fb0c3" }}>Answer</h2>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{data.answer}</p>
          {data.citations.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.9rem", color: "#9fb0c3" }}>Citations</h3>
              <ul>
                {data.citations.map((c: CourseAskOutput["citations"][number]) => (
                  <li key={c.id} style={{ marginBottom: "0.5rem" }}>
                    <small style={{ color: "#64748b" }}>
                      {c.sourceFile ?? c.lectureId} · score {c.score.toFixed(2)}
                      {c.startMs != null && c.endMs != null &&
                        ` · ${formatTs(c.startMs)}–${formatTs(c.endMs)}`}
                    </small>
                    <div>{c.text}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}

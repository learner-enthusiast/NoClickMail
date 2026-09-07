# Orion Agent Flow

This document describes the end-to-end flow of how Orion chat works in NoClickMail — from the dashboard UI through RAG routing, Corsair Gmail/Calendar actions, and the approval system.

---

## High-level overview

```mermaid
flowchart TD
    A[User sends message in dashboard Chat] --> B[trpc agent.runAgent]
    B --> C[Save user message to DB]
    C --> D[RAG pipeline]
    D --> E{Route?}
    E -->|clarify| F[Return clarifying question]
    E -->|direct| G[Return direct answer]
    E -->|agent| H{Corsair needed?}
    H -->|No| I[LLM assistant reply]
    H -->|Yes| J{Requires approval?}
    J -->|Yes| K[Create approval + chat link]
    J -->|No| L[Run Corsair agent immediately]
    F --> M[Stream to UI + save assistant message]
    G --> M
    I --> M
    K --> M
    L --> M
    K --> N[User opens /approval/id]
    N --> O[Approve / Reject / Retry]
    O --> P[Execute Gmail/Calendar action]
    P --> Q[Friendly result appended to chat thread]
```

---

## 1. Frontend — dashboard chat

**Entry point:** `apps/web/components/ui/orion/dashboard/Chat.tsx`

```mermaid
sequenceDiagram
    participant User
    participant Chat as Dashboard Chat
    participant TRPC as agent.runAgent
    participant DB as chat_messages

    User->>Chat: Type message / quick action
    Chat->>Chat: Show optimistic user bubble
    Chat->>TRPC: mutateAsync({ prompt, threadId? })
    TRPC->>DB: append user message
    TRPC-->>Chat: stream meta (threadId, rag)
    TRPC-->>Chat: stream delta tokens
    TRPC-->>Chat: stream approval_created (optional)
    TRPC->>DB: append assistant message
    TRPC-->>Chat: stream done
    Chat->>DB: refetch threadMessages
    Chat->>User: Render bubbles (markdown, copy, expand)
```

### UI behavior

| Message type | Rendering | Copy button |
|--------------|-----------|-------------|
| User | Plain text, truncated at ~320 chars; click to expand with scroll | Copies full message |
| Assistant | Full markdown (lists, bold, tables, CSV blocks) | Copies full message |
| Approval | Markdown + “Review approval” link | Copies **approval ID only** |
| Error | Plain destructive bubble | Copies error text |

**Note:** The separate `/chat` page is UI-only and is **not** wired to `agent.runAgent` yet. The live backend-connected chat is the Orion dashboard sidebar.

---

## 2. Backend — `agent.runAgent`

**Entry point:** `packages/trpc/server/routes/agent/route.ts`

```mermaid
flowchart LR
    A[Receive prompt] --> B[Get or create thread]
    B --> C[appendMessage user]
    C --> D[ragService.runForUserMessage]
    D --> E[yield meta event]
    E --> F[executeAgentTurn]
    F --> G[appendMessage assistant]
    G --> H[ragService.storeChatTurn]
    H --> I[yield done event]
```

Each turn:

1. **Thread** — reuse existing or create new from prompt snippet.
2. **Persist user message** — `chatService.appendMessage(role: "user")`.
3. **RAG** — `ragService.runForUserMessage(...)` decides routing.
4. **Stream meta** — `{ type: "meta", threadId, rag }` to client.
5. **Execute turn** — `executeAgentTurn(...)` in `run-agent-stream.ts`.
6. **Persist assistant message** — includes `content` and optional `approvalId`.
7. **Store in memory** — `ragService.storeChatTurn(...)` for long-term RAG.
8. **Stream done** — `{ type: "done", output, approvalId, rag }`.

---

## 3. RAG routing

**Entry point:** `packages/services/rag/index.ts`

The RAG determiner classifies each user message into one of three routes:

```mermaid
flowchart TD
    A[User prompt + thread history] --> B[determineRequest]
    B --> C{route}
    C -->|clarify| D[Return clarifying question]
    C -->|direct| E[Return direct answer]
    C -->|agent| F{Enhancement needed?}
    F -->|Pinecone| G[Retrieve chunks]
    F -->|Mem0| H[Retrieve long-term memories]
    G --> I[Enhance prompt]
    H --> I
    I --> J{runCorsairAgent?}
    J -->|Yes| K[Corsair path]
    J -->|No| L[generateAssistantReply]
```

| Route | When | What happens |
|-------|------|----------------|
| **`clarify`** | Missing info | Returns a clarifying question immediately (no LLM agent call) |
| **`direct`** | Simple reply, no tools | Returns a canned/direct answer immediately |
| **`agent`** | Needs reasoning/tools | May retrieve from Pinecone, Mem0 memories, enhance prompt, then call Corsair or a normal assistant reply |

For the **`agent`** route, the flag **`runCorsairAgent`** (from `determination.requiresCorsairMcpTool`) decides whether Gmail/Calendar tools are needed.

---

## 4. Agent execution

**Entry point:** `packages/trpc/server/routes/agent/run-agent-stream.ts`

```mermaid
flowchart TD
    A[executeAgentTurn] --> B{rag.route}
    B -->|clarify or direct| C[runDirectOrClarifyRoute]
    B -->|agent| D{runCorsairAgent?}
    D -->|No| E[runAssistantReplyRoute]
    D -->|Yes| F[runCorsairRoute]
    C --> G[Stream pre-built message]
    E --> H[Stream LLM reply]
    F --> I{requiresApproval?}
    I -->|Yes| J[Create approval]
    I -->|No| K[CorsairAgent.executePromptStream]
    J --> L[Stream approval message + approvalId]
    K --> M[Stream action result]
```

### Corsair planning

**Planner:** `packages/services/corsair-approvals/planner.ts`

The planner picks:

- **`service`:** `gmail` or `google_calendar`
- **`action`:** e.g. `send`, `search`, `create`, etc.
- **`parameters`:** to/subject/body, event fields, etc.

### Approval gate

**Function:** `requiresCorsairApproval()` in `planner.ts`

```mermaid
flowchart LR
    A[Planned action] --> B{service}
    B -->|gmail| C{action}
    C -->|send or reply| D[Requires approval]
    C -->|search, read, drafts, etc.| E[Run immediately]
    B -->|google_calendar| F{action}
    F -->|create, update, delete| D
    F -->|search, read, check_availability| E
```

| Requires approval | Runs immediately |
|-------------------|------------------|
| Gmail: `send`, `reply` | Gmail: search, read, drafts, labels, etc. |
| Calendar: `create`, `update`, `delete` | Calendar: search, read, check_availability |

**If approval required:**

1. Insert row in `corsair_approval_events` (24h TTL).
2. Stream friendly message + `approval_created` event.
3. Save assistant message with `approvalId`.
4. Chat shows “Review approval” button linking to `/approval/[id]`.

**If no approval required:**

- `CorsairAgent.executePromptStream(...)` runs Gmail/Calendar directly.
- Streams deltas back to chat.

---

## 5. Approval flow

**Page:** `apps/web/app/(app)/approval/[id]/page.tsx`  
**API:** `packages/trpc/server/routes/corsair-approvals/route.ts`  
**Service:** `packages/services/corsair-approvals/index.ts`

```mermaid
sequenceDiagram
    participant User
    participant Page as /approval/id
    participant TRPC as corsairApprovals.approve
    participant Svc as executeStream
    participant Gmail as Gmail/Calendar API
    participant Chat as chat_messages

    User->>Page: Review planned action
    User->>TRPC: Approve (or Retry if failed)
    TRPC->>Svc: executeStream(approvalId)
    Svc->>Gmail: Run planned action
    Gmail-->>Svc: Raw API result
    Svc->>Svc: formatApprovalExecutionForChat()
    Svc-->>TRPC: stream deltas + done
    TRPC->>Chat: finalizeApprovedTurn (append assistant message)
    TRPC-->>Page: done event
    Page->>User: Show friendly result
```

### User actions on approval page

| Action | Result |
|--------|--------|
| **Approve** | Executes action, appends friendly result to original chat thread |
| **Reject** | Sets status to `rejected`; no execution |
| **Retry** | Re-runs failed or stuck (`failed` / `executing`) approvals |

On execution:

- Gmail send uses sanitized MIME (fixes invalid `From: me` headers).
- OAuth tokens are refreshed via `ensureOAuthAccessToken()` before API calls.
- Raw API output is stored in DB; chat receives a **friendly formatted message** via `formatApprovalExecutionForChat()`.

---

## 6. Gmail / OAuth layer

**Files:** `packages/services/corsair/oauth.ts`, `packages/services/corsair/index.ts`

```mermaid
flowchart TD
    A[Gmail/Calendar API call] --> B[ensureOAuthAccessToken]
    B --> C{Token expired?}
    C -->|Yes| D[Refresh via Google OAuth]
    C -->|No| E[Use existing token]
    D --> E
    E --> F[API request]
    F --> G{401?}
    G -->|Yes| H[Reconnect error to user]
    G -->|No| I[Return result]
```

Before any Gmail/Calendar API call:

- **`getCorsairConnectionStatus()`** checks account exists **and** token is valid.
- **`ensureOAuthAccessToken()`** reads `expires_at`, refreshes via Google OAuth if needed.
- On 401, user gets a reconnect-style error.

---

## 7. Data stored per turn

```mermaid
flowchart LR
    subgraph Persistence
        A[chat_threads]
        B[chat_messages]
        C[corsair_approval_events]
        D[Pinecone]
        E[Mem0]
    end

    F[User turn] --> B
    F --> C
    F --> D
    F --> E
    B --> A
```

| Store | What |
|-------|------|
| `chat_threads` / `chat_messages` | Conversation history; `approvalId` on approval messages |
| `corsair_approval_events` | Pending/completed actions with parameters, status, result |
| Pinecone | Retrieved context chunks (when RAG flags require them) |
| Mem0 | Long-term memory (when RAG flags require them) |

---

## 8. Example walkthroughs

### Send email (requires approval)

```mermaid
sequenceDiagram
    participant U as User
    participant O as Orion
    participant A as Approval

    U->>O: "Send email to arnab@outlook.com saying hello"
    O->>O: RAG → agent, runCorsairAgent
    O->>O: Plan gmail.send
    O->>A: Create approval (pending)
    O->>U: Chat: Review approval link
    U->>A: Approve on /approval/id
    A->>A: Execute Gmail send
    A->>U: "Email sent successfully" in chat thread
```

1. RAG → `agent` route, `runCorsairAgent: true`
2. Planner → `gmail.send` with to/subject/body
3. `requiresCorsairApproval` → **true**
4. Chat shows approval message + link
5. User approves on `/approval/[id]`
6. Email sends via Gmail API
7. Friendly result appears back in the chat thread

### Read inbox data (no approval)

```mermaid
sequenceDiagram
    participant U as User
    participant O as Orion
    participant G as Gmail API

    U->>O: "Show my last 5 sent email addresses"
    O->>O: RAG → agent, runCorsairAgent
    O->>O: Plan gmail.search (read action)
    O->>O: requiresCorsairApproval → false
    O->>G: CorsairAgent runs immediately
    G-->>O: Email data
    O->>U: Stream markdown list (bold emails, numbered list)
```

1. RAG → `agent` route, Corsair needed
2. Planner → `gmail.search` or similar read action
3. `requiresCorsairApproval` → **false**
4. Corsair runs immediately, streams markdown list
5. Chat renders with markdown formatting

---

## Key file reference

| Area | Path |
|------|------|
| Dashboard chat UI | `apps/web/components/ui/orion/dashboard/Chat.tsx` |
| Chat bubbles (markdown, copy, expand) | `apps/web/components/ui/orion/dashboard/ChatMessageBubble.tsx` |
| Markdown renderer | `apps/web/components/ui/orion/dashboard/ChatMarkdown.tsx` |
| Agent tRPC route | `packages/trpc/server/routes/agent/route.ts` |
| Agent stream execution | `packages/trpc/server/routes/agent/run-agent-stream.ts` |
| RAG pipeline | `packages/services/rag/index.ts` |
| Corsair approval service | `packages/services/corsair-approvals/index.ts` |
| Action planner + approval rules | `packages/services/corsair-approvals/planner.ts` |
| Approval execution | `packages/services/corsair-approvals/execute.ts` |
| Friendly chat formatting | `packages/services/corsair-approvals/format-chat.ts` |
| Approval tRPC routes | `packages/trpc/server/routes/corsair-approvals/route.ts` |
| Approval detail page | `apps/web/app/(app)/approval/[id]/page.tsx` |
| OAuth token refresh | `packages/services/corsair/oauth.ts` |
| Corsair agent | `packages/services/corsair/` |

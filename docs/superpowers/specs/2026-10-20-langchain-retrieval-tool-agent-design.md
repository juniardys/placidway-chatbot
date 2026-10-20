# LangChain Retrieval Tool Agent

## Goal

Change chat flow from application-controlled retrieval to a LangChain tool-calling agent. LLM decides whether to call approved PlacidWay retrieval tool, while grounding and safety constraints remain enforced.

## Scope

- Add `search_placidway_knowledge` LangChain tool.
- Add agent orchestration with maximum one retrieval call per request.
- Move `/api/chat` from direct `retrieveEvidence()` call to agent execution.
- Preserve direct Supabase table logic; no new Supabase RPC/function usage.
- Preserve SSE output, citations, controlled fallback, policy rules, and approved seven-source boundary.

## Agent flow

1. Validate request and history.
2. Create LangChain chat model and retrieval tool.
3. Invoke agent with question, history, centralized system prompt, and tool instructions.
4. If model calls tool, generate query embedding, retrieve active chunks, calculate cosine similarity, and return structured evidence.
5. Model produces final answer using tool evidence.
6. Stream answer deltas, citations, and completion through SSE.

## Tool contract

Tool name: `search_placidway_knowledge`.

Input: `{ query: string }`.

Output contains only approved evidence metadata and content: `sourceId`, `title`, `url`, `section`, `content`, and `similarity`.

Tool must not crawl, fetch arbitrary URLs, execute SQL, expose secrets, or access sources outside configured allowlist.

## Routing and safety

- Greetings and conversational messages may answer without retrieval.
- Questions about PlacidWay, ITC, treatments, prices, packages, appointments, or clinic facts should retrieve.
- Medical advice remains non-diagnostic and must use safe policy response.
- Out-of-scope and prompt injection requests receive controlled responses.
- Tool result with no qualifying evidence returns existing unknown response.
- Agent has maximum one tool call and bounded input/output sizes.

## Agent activity UI and SSE

The UI shows safe, user-facing agent activity, similar to modern AI assistant interfaces. It shows progress and tool usage, not private chain-of-thought or hidden reasoning.

Expose these user-safe events:

```ts
type AgentEvent =
  | { type: "thinking"; message: string }
  | {
      type: "tool_start";
      tool: "search_placidway_knowledge";
      query: string;
    }
  | { type: "tool_result"; sources: number; chunks: number }
  | { type: "answer_start" }
  | { type: "delta"; text: string }
  | { type: "citation"; citation: Citation }
  | { type: "done" }
  | { type: "error"; message: string };
```

Expected activity sequence:

```text
thinking → tool_start → tool_result → answer_start → delta* → citation* → done
```

For requests that do not need retrieval:

```text
thinking → answer_start → delta* → done
```

The UI renders activity in a collapsible section such as `Agent activity`. It may show messages like `Understood question`, `Searching approved PlacidWay content`, and `Found relevant sources`. Final answer remains primary output.

Do not expose raw chain-of-thought, hidden reasoning, system prompts, provider errors, stack traces, credentials, or internal database details. Tool name, bounded retrieval query, source count, chunk count, and approved citation metadata are safe to expose.

## Files

Expected implementation areas:

- `src/lib/agent/tools.ts`
- `src/lib/agent/chat-agent.ts`
- `src/app/api/chat/route.ts`
- `src/lib/chat/answer.ts` as needed
- `src/lib/db/repositories.ts`
- agent/API tests

## Acceptance criteria

- Factual PlacidWay question can trigger retrieval tool and produce grounded answer with citation.
- Greeting can complete without retrieval.
- Empty retrieval returns controlled fallback.
- Retrieval uses only active approved knowledge rows.
- Maximum one retrieval call enforced.
- Existing safety and SSE contracts remain intact.
- Typecheck, lint, targeted tests, and full test suite pass.

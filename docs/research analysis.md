<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# You are not an AI assistant. You are a critical researcher and systems analyst specializing in Agentic AI, LLM architectures, and context engineering. You evaluate systems the way a skeptical reviewer or senior engineer would — you question design decisions, identify weaknesses, and avoid surface-level explanations.

════════════════════════════════════════════
PRIMARY OBJECTIVE:
Perform deep research and analysis on an AI project:
"AI Study Agent" built using:
LangChain
LangGraph
Model Context Protocol (MCP)
Retrieval-Augmented Generation (RAG)
Tool / Function Calling
Your goal is NOT to explain the project.
Your goal is to reverse-engineer, evaluate, and critique it, with a strong focus on context engineering.
════════════════════════════════════════════
INPUT CONTEXT (PROVIDED TO YOU):
GitHub repository (code, architecture, workflows)
Any documentation or README
Optional logs, prompts, or outputs
You must extract insights from structure, not just descriptions.
════════════════════════════════════════════
CORE ANALYSIS TASKS:
SYSTEM DECONSTRUCTION
Reconstruct the architecture:
How does data flow through the system?
Where is context created, modified, or discarded?
Identify agent loop structure (LangGraph flow, nodes, edges)
Detect implicit design assumptions
CONTEXT ENGINEERING ANALYSIS (PRIMARY FOCUS)
What qualifies as "context" in this system?
(prompt templates, retrieved docs, memory, tool outputs, system messages)
How MCP is used:
Is it structuring context explicitly or just wrapping prompts?
Does it improve modularity or just add abstraction?
Evaluate:
Context relevance
Context redundancy
Context freshness (staleness over steps)
Context window efficiency
Identify:
Where context bloats
Where context is missing
Where context could be compressed or structured better
Be specific. Avoid generic statements.
COMPARATIVE REASONING
Compare the system implicitly or explicitly with:
ReAct-style agents
Standard prompt chaining
Memory-based agents (short-term vs long-term memory)
Tool-first vs reasoning-first architectures
Ask:
Is MCP actually improving reasoning, or just organizing inputs?
FAILURE MODES \& LIMITATIONS
Identify realistic failure cases:
Hallucination due to poor context grounding
Tool misuse or over-calling
Context drift across multi-step reasoning
Latency vs context tradeoffs
Do NOT speculate blindly — tie failures to actual design patterns.
PERFORMANCE \& SCALABILITY THINKING
How would this system behave at scale?
What happens with:
larger document retrieval?
multiple concurrent agents?
longer conversations?
Be honest:
"This design likely breaks under X condition."
IMPROVEMENT PROPOSALS
Suggest concrete improvements:
Better context structuring strategies
MCP redesign ideas
Memory optimization approaches
Retrieval improvements (ranking, chunking, filtering)
Avoid vague advice like "optimize performance"
════════════════════════════════════════════
RESEARCH DEPTH REQUIREMENTS:
Use real concepts from LLM research (2022–2025 era)
Mention specific paradigms where relevant:
(e.g., ReAct, Reflexion, Toolformer, function calling evolution)
Include at least:
2 concrete architectural observations
2 failure scenarios
2 non-trivial improvements
No fluff. No generic summaries.
════════════════════════════════════════════
WRITING STYLE:
Direct, analytical, slightly critical
No hype, no praise unless justified
Use phrases like:
"This breaks down when..."
"This assumption doesn't hold if..."
"This is likely inefficient because..."
Avoid AI-generic language:
(no "robust", "seamless", "cutting-edge", etc.)
Use mixed sentence lengths
Occasional short punchy lines. Like this.
════════════════════════════════════════════
OUTPUT FORMAT:
Return structured analysis in the following format:
System Overview (Reconstructed, not copied)
Context Engineering Breakdown (Detailed)
MCP Evaluation (Critical)
Comparative Analysis (vs other paradigms)
Failure Modes
Scalability \& Performance Concerns
Suggested Improvements
Final Verdict (honest, not diplomatic)
No bullet spam. Use paragraphs with clear reasoning.
════════════════════════════════════════════
SELF-CHECK BEFORE OUTPUT:
Did I actually analyze, or just describe?
Did I identify real weaknesses?
Did I avoid generic AI explanations?
Did I tie claims to system behavior?
If not, rewrite.
════════════════════════════════════════════
NOW BEGIN THE ANALYSIS.

Use full deep web search and academic search

github repository : study-agent-rag

System Overview (Reconstructed, not copied)
The core of the AI Study Agent is a LangGraph state machine wrapped by `StudyAgentService`, with persistent state stored via `MemorySaver` keyed by `thread_id`. Each user turn is converted into a `HumanMessage` and passed into a compiled `StateGraph` whose state object (`StudyAgentState`) contains four fields: `messages` (full conversation history), `documents` (last retrieved RAG docs), `currentTopic`, and `route`. The `messages` field is append-only, `documents` and `route` are “latest-wins” scalars.

The graph defines five nodes: `router`, `query`, `retrieve`, `tools`, and `flashcard`. Control always starts at `router`, which decides a `route` string (`rag | tool | general | flashcard`) using a separate LLM call, then conditionally moves to `retrieve` (for RAG), `query` (for tool/general), or `flashcard`; `retrieve` flows into `query`; `query` may loop to `tools` if it detects tool calls in the last message, and `tools` loops back into `query`; `flashcard` goes directly to `END`. The actual content generation happens in `queryNode` (and in `flashcardNode` for the flashcard path), while `retrieveNode` is purely a context-construction step that inserts a large `SystemMessage` containing formatted RAG snippets into the state.

On the periphery, a Python FastAPI RAG service handles PDF ingestion, token-based chunking, and ChromaDB vector search, exposed via `ragClient` over HTTP. MCP is wired in via `MCPClientManager` and an MCP server (`StudyTools`) that exposes `track_progress`, `generate_quiz`, and `get_progress_report`; those tools are discovered dynamically and passed into the graph as LangChain `StructuredTool[]` for use by the model. There is also an “integrated tool service” that can parse free-form tool calls from text and execute them through MCP, but it is not actually wired into the LangGraph path that handles normal chat turns.

***

Context Engineering Breakdown (Detailed)
In this system, “context” is not a single structure; it is spread over several layers:

- **Conversation state**: `StudyAgentState.messages` is the primary context buffer, accumulating every `BaseMessage` appended by nodes (user, assistant, and system messages).
- **RAG context**: `StudyAgentState.documents` holds the last set of retrieved `Document[]`, and `retrieveNode` injects a synthetic `SystemMessage` that embeds those docs as `[Source N: fileName · origin]` blocks plus explicit instructions (“Use the above context… cite [Source N]”).
- **Tool meta‑context**: `createQueryNode` constructs a long “tool-aware” system prompt by combining a persona prompt (`STUDY_MENTOR_SYSTEM_PROMPT`) with dynamically generated few‑shot examples derived from MCP tool schemas via `tool-schema-enricher`.
- **Ephemeral task-specific context**: `flashcardNode` and `generateNode` each build their own prompts by reformatting `state.documents` and selected recent messages into new prompt strings.

The dataflow on a typical RAG‑backed turn is: user message → router (decides `route='rag'`) → `retrieveNode` (calls RAG, populates `documents`, appends a context `SystemMessage`) → `queryNode` (prepends a fresh system prompt with tool examples, then replays *all* prior `state.messages` after it, including earlier system messages and RAG context messages) → model output → AIMessage appended to `messages`. Because the messages reducer is “concatenate” and there is no trimming or deduplication, subsequent turns always carry every previous system persona prompt, every previous RAG context blob, and every previous answer as raw text, with a new tool‑aware system message prepended each time.

There are two notable structural consequences:

1. **System-message stacking and conflicting instructions** – The RAG instructions live in a `SystemMessage` appended by `retrieveNode`, but `queryNode` always prepends a *different* system message (persona + tool guidance + few-shot examples) ahead of it. For OpenAI‑style models, only the earliest system messages are consistently respected; later system messages may be treated closer to user content. The design therefore risks demoting the retrieval instructions and sources to secondary status, despite them being the most critical grounding signal.
2. **Unbounded context growth and redundancy** – Because no node prunes `state.messages`, each turn adds: (a) a new system persona + tools prompt, (b) possibly a new RAG context system message, and (c) a new assistant reply. Over a long study session, the prompt becomes dominated by multiple copies of nearly identical persona/tool instructions and stale RAG context blocks. This is a classic context‑bloat pattern: tokens are spent reheating the same meta‑instructions instead of representing the most recent user question and relevant passages.

`documents` is somewhat better-behaved: its reducer overwrites on each update, so at most one RAG context set is kept in state. However, the *textual* echoes of earlier retrievals in `messages` are never cleaned up, so there is a divergence between the structured “current context” (`documents`) and the unstructured “historical context” sitting in the message history. The `currentTopic` field is written only in `generateNode` (which is not actually part of the active graph), so it is effectively dead context that could have been used as a topic handle for future summarization or memory but currently isn’t.

***

MCP Evaluation (Critical)
MCP is present in two distinct layers:

- A **tool-discovery layer**, where `MCPClientManager` aggregates tools from all connected servers and exposes them as `Tool[]` with `name`, `description`, `inputSchema`, and `serverId`.
- A **tool-education layer**, where `tool-schema-enricher` inspects each tool’s JSON schema, derives parameter descriptions, defaults, and example values, and synthesizes few‑shot examples that are appended to the system prompt.

In the main agent loop, MCP tools are surfaced to the model in *two* ways at once:

1. As OpenAI `ChatCompletionTool[]` objects passed to `model.invokeWithTools`, enabling structured function calling; and
2. As natural-language examples and parameter descriptions inside the tool-aware system prompt, which effectively tells the model, “When you see something like this user query, call this tool with these arguments.”

However, the LangGraph `ToolNode` is mostly vestigial here. The graph’s `query` node is written as if it were producing OpenAI-style `tool_calls` that the graph can detect via `state.messages[state.messages.length-1].tool_calls`, but in reality `queryNode` calls `model.invokeWithTools` and then *collapses everything down* to a single final string `responseContent` – it never appends an assistant message that exposes the tool_call metadata. The conditional edge `query → tools` almost never fires, because nothing in the graph actually produces a message with a `tool_calls` field matching that detection logic. In practice, all MCP interactions induced by `invokeWithTools` are opaque “internal tools”: they happen inside the model–adapter stack, not as first‑class steps in the state graph.

The separate `IntegratedToolCallService` is more “tool‑first”: it parses free‑form LLM outputs for tool invocations (`ToolCallParser`), validates arguments against a registry built from MCP tools, optionally asks the user for approval, and executes via `MCPClientManager` with retries and backoff. But this service is not integrated into `queryNode` or the LangGraph workflow; it looks more like an alternative integration path (possibly used from the UI) that is architecturally decoupled from the agent’s main loop. So MCP is improving modularity at the system boundary (you can add tools and servers without changing agent code), but *within* the agent, MCP is mostly treated as a pool of function schemas to enrich prompts and feed into `invokeWithTools`, not as a first‑class context object that shapes multi-step reasoning.

This leaves MCP in an awkward middle position:

- It **does** give you dynamic tool discovery and structured schemas, which are then converted into better tool descriptions and examples inside the system prompt.
- But it **does not** drive the graph’s high-level structure (there is no per-tool routing, no MCP-aware state), nor does it yield explicit, inspectable tool traces akin to ReAct trajectories or Toolformer-style API augmentation.[^1][^2]

In short: MCP is being used to organize inputs and schemas; it’s not strongly improving the *reasoning process* because the reasoning is still a single monolithic LLM call that hides most tool usage inside a black box.

***

Comparative Analysis (vs other paradigms)
Compared to ReAct-style agents, this system is closer to a “monolithic call + one retrieval step” than to a genuine reasoning–acting interleave. ReAct explicitly alternates between “Thought: …” and “Action: <tool(args)>” steps, with environment “Observation: …” fed back into further reasoning. Here, the only explicit “acting” step in the state machine is `retrieveNode`, which runs once when the router chooses `rag`, and then the model is called once with the blended persona, retrieval context, and tool examples. Any further tool interaction happens inside `invokeWithTools` with no explicit intermediate messages; the graph doesn’t show thought–action chains, just an opaque assistant reply.[^3][^4][^5]

Relative to simple prompt chaining (e.g., “retrieve → answer” pipelines common in early RAG systems), this design adds a router node and a flashcard node but doesn’t really deepen the chain. It is essentially a three-stage chain: route → maybe retrieve → answer (plus optional internal tools). There is no iterative plan refinement, no explicit error handling policy beyond generic try/catch branches, and no agent loop that collects feedback and adjusts strategy, except for the dead `tools` branch that would have allowed multiple tool rounds if `tool_calls` messages actually existed.

Compared to memory-based agents (e.g., Reflexion or agents with episodic + semantic memory), the memory story is thin. Reflexion maintains a dedicated reflection buffer with verbal self-critiques that are injected into subsequent prompts, improving performance across episodes without weight updates. This agent has no persistent “lessons learned” store, no summarization of long conversations, and no distinction between short-term chat history and long-term knowledge. Everything is dumped into `messages` until the model’s context window saturates. `currentTopic` could have been a seed for topic-level memory, but it’s only updated in `generateNode`, which the graph never calls.[^6][^7]

On the tool-first vs reasoning-first axis, the active path is clearly reasoning-first: the model sees a big prompt, plus optional tools, and decides in one shot whether and how to use tools. The “tool-first” stack (regex parsing, approval flows, MCP routing) exists but is not in the main loop. Toolformer-style approaches explicitly train the model to insert tool calls into its own training text and learn when tools help; here, the schema enricher is a runtime prompt hack that approximates some of that behavior via few‑shot examples but without any learning or gating. That leaves tool usage heavily dependent on the base model’s instruction-following quality and the quality of the enriched descriptions, which may work for simple tools but does not give robust control.[^2]

***

Failure Modes

1. **Context bloat and instruction dilution in long sessions**
Because `StudyAgentState.messages` is append-only and every turn adds a fresh persona + tool-aware system message *ahead* of all previous RAG system messages, the prompt becomes an unstructured pile of: persona N, RAG context K, persona N−1, RAG context K−1, …, plus user and assistant turns. This breaks down when:

- A user runs a long study session with many RAG-backed questions; older RAG context snippets remain in the history and may contradict newer ones, while multiple system instructions compete.
- The context window is heavily used by repeated meta‑instructions and stale context, leaving fewer tokens for new questions and fresh retrieved text.

The “latest route wins” behavior for `route` does not solve this: routing is not used to clean context, only to pick the next node. Over time, the model may start to hallucinate or ignore RAG instructions simply because the persona prompt at the top dominates attention and the relevant context is buried among many older blocks.

2. **Routing misclassification and RAG underuse**
`routeNode` makes its decision purely from the last message’s text via a single LLM call with a crude meta-prompt, ignoring (a) whether any documents have been uploaded, (b) whether `documents` currently holds relevant context, and (c) conversation history. This breaks down when users interact in a natural multi-turn way, e.g.:

- “Upload this PDF.” → “What does section 3 say about dynamic programming?” → “Now summarise that in simpler terms.”

The last query (“Now summarise that…”) contains no explicit keyword like “document” or “pdf”; the router can easily classify it as `general`, bypassing RAG and generating an answer from model priors instead of the uploaded document. The same failure appears when users refer anaphorically (“Based on that, give me flashcards”) – route decisions are blind to existing `documents`, so flashcard generation may end up based on general knowledge instead of the actual text, or on stale `documents` from a previous topic.

3. **Dead tool loop and opaque tool behavior**
The graph’s conditional edge from `query` to `tools` is entirely dependent on detecting a `tool_calls` array on the last message, but `queryNode` never produces such a message – it only returns a plain string answer after running `invokeWithTools`. This means the `tools` node (which wraps `ToolNode`) is effectively unreachable and any multi-step tool loop (`query → tools → query`) is dead. If you ever do get tool calls (e.g., by changing the model), the system’s behavior would be inconsistent: some tools would be executed internally by `invokeWithTools`, others externally by `ToolNode`, with different logging, error handling, and context surface.

Practically, this breaks down when tasks require more than one tool step or a reason–act–observe–reason loop, such as “Generate a quiz, then track my progress, then show a report.” The agent cannot explicitly reason about the tool’s output in a subsequent step; it only sees a final answer that already baked in tool results. This is a significant gap relative to ReAct, which explicitly reasons after each observation.[^4][^3]

4. **RAG grounding fragility and stale context mixing**
`retrieveNode` writes a system message instructing the model to “use the above context” and cite `[Source N]`, but that message is just one more element in the `messages` array and is not distinguished from older retrieval messages. When the user later asks about a different topic, the router might still go down the `rag` path, but the history contains multiple RAG context messages for different documents and topics. Nothing ensures that the latest RAG context is the one the answer actually uses, especially since the persona prompt is re-injected each turn and might draw the model toward generic explanations instead.

This breaks down when users switch subjects without clearing the vector store or the conversation, or when they upload multiple documents. It becomes easy for the model to cite `[Source 1]` while implicitly grounding in whatever text is most salient in the long context window rather than the last retrieved chunks, precisely the mis-grounding RAG was designed to avoid.

***

Scalability \& Performance Concerns
At **token level**, the design is inefficient:

- Every turn prepends a full persona + tool examples system prompt, whose size grows with the number of MCP tools (because they all get few‑shot examples appended).
- It then appends the entire conversation history, including all previous persona prompts and RAG context blocks, with no truncation or summarization.

This is likely acceptable for short toy sessions but breaks down when:

- Users keep the app open for hours and ask dozens of questions; the prompt could easily exceed typical 8k–16k context windows, forcing either hard truncation at the API layer (which they don’t control) or implicit dropping of early messages.
- Additional MCP servers are added (e.g., filesystem, Google Drive, calendar); each new tool increases prompt size via the tool-schema-enricher pipeline.

On the **service side**, the Python RAG service is a single FastAPI + Chroma instance with up to 2-minute timeouts for ingestion and 60 seconds for queries. In a multi-user or multi-agent setup, this central bottleneck will exhibit:

- Slow ingestion when many PDFs are queued, since embeddings are generated sequentially per process and the vector store is updated in-place.
- Non-isolated collections: all documents go into one `COLLECTION_NAME` and `CHROMA_PERSIST_DIR`, so multiple users share the same retrieval space unless you hard-partition by path or metadata – which the current query interface does not expose as filters.

The MCP layer also introduces scalability pressure: each tool call requires spawning or maintaining STDIO transports to external processes, and the integrated tool service may retry with exponential backoff on failures. For complex tasks with many tool calls, this can easily explode latency without any higher-level budgeting or tool call limits (no analog of Toolformer’s API-call gating or ReAct’s step limit).[^3][^2]

***

Suggested Improvements

1. **Explicit context layering and pruning**
Right now all context is flattened into `messages`. A more disciplined design would:

- Split state into **slots**: `persona`, `retrieval_context`, `short_history`, `long_term_summary`, `tool_trace`. For example, keep only the last K user/assistant pairs in `short_history`, store RAG snippets in a dedicated field, and store persona/tool instructions in a stable `persona` field that is injected once per call.
- Implement an explicit **context assembly step** that builds the prompt from these slots, e.g.: `[system: persona+tool instructions] + [system: latest retrieval context] + [assistant: reflection summary] + last N user/assistant turns`. This mirrors architectures used in many modern RAG agents that maintain separate buffers and use summarization to prevent unbounded growth.[^6][^3]
- Aggressively **prune or overwrite older RAG context messages** when new retrievals occur, so stale context is not interleaved with fresh context in the same role.

Concretely, change `messages` reducer to ignore older system messages or reclassify RAG system messages into a `context` field, and update `queryNode` to rebuild messages from structured state rather than blindly prepending to an ever-growing array.

2. **Align the graph with function calling or with a ReAct-style loop (not both halfway)**
The system currently straddles two paradigms: LangGraph’s tool nodes and OpenAI-style `invokeWithTools`. This is why the `tools` node is effectively dead. Pick one:

- **Option A – Full function-calling path**:
    - Drop `ToolNode` and the `tools` graph node.
    - Let `queryNode` be the *only* locus of tool calls via `invokeWithTools`.
    - Store tool call traces explicitly by having `createNVIDIAOpenAIChat` return messages with `tool_calls` and then appending both the tool_call message and tool result messages into `state.messages`.
- **Option B – ReAct-style LangGraph loop**:
    - Disable `invokeWithTools`; instead, have `queryNode` instruct the model to emit explicit `tool_calls` in JSON or in a ReAct-style `Action: tool_name[args]` format.
    - Use the existing `ToolNode` and `IntegratedToolCallService` to execute tools based on those calls, then append results as `Observation` or `ToolResult` messages; loop back into `query` to continue reasoning.[^3]

Option B would bring the design closer to ReAct and Toolformer: you’d get explicit thought–act–observe trajectories and better visibility into where hallucinations or tool misuse happen. It would also let you do per-step routing and step limits, reducing tool overuse.[^2][^3]

3. **Router redesign with state-aware gating and conservative defaults**
The current router ignores state and uses a generic LLM classification prompt. A more robust approach would:

- Feed the router a compact representation of **(last user message, `documents` presence, last route, maybe a short topic summary)** instead of only the last message. If `documents` is non-empty and the user asks “this/that/it,” bias toward `rag` or at least toward a combined RAG+general path.
- Prefer **“RAG-by-default, fallback-to-general”** when any documents are loaded and the user asks a conceptual question. Modern RAG literature and practice often recommends trying retrieval first and only falling back when nothing relevant is found, to avoid hallucination.[^3]
- Encode a stronger **“tool-only-on-explicit-intent”** rule to avoid spurious MCP calls: e.g., require the user to mention “quiz,” “progress,” or similar keywords before `track_progress` or `generate_quiz` are even considered by the model. That can be implemented as a pre-filter on which tools appear in the tool list (and thus the tool-aware prompt) for a given turn.

4. **Make MCP a first‑class context object, not just schema sugar**
Instead of dumping all tools into the system prompt every time, use MCP metadata and the schema enricher to build a **tool index** and a **selector**:

- At each turn, run a lightweight selector (could be heuristic or a small classifier) over user intent to choose a *small subset* of tools (1–3) that are relevant. Only those tools should be converted to `ChatCompletionTool` and added to the tool-aware prompt. This is analogous to how Toolformer only adds API calls where they improve LM likelihood.[^2]
- Represent tools and their results explicitly in state, e.g. `lastToolsUsed`, `lastToolResults`, and feed them back into the prompt with clear framing (“Previously, the tool X returned Y, which you may use”). This turns MCP from a hidden side-channel into structured context.
- Consider integrating `IntegratedToolCallService` into the LangGraph path so the same validation, approval, and retry policies apply to all tool calls, whether triggered by regex parsing or by function calling.

This repositions MCP from “schema provider” to “tool memory and control plane,” which is closer to what Model Context Protocol was designed for.

5. **RAG retrieval and context compression upgrades**
The RAG client is essentially top‑k dense retrieval with fixed chunking and blanket concatenation of all retrieved chunks into a single context block. For complex or long documents, this is both inefficient and brittle. Improvements:

- Add an intermediate **reranking/compression step** (e.g., a small cross-encoder or a compression chain) to reduce 5 chunks down to the 2–3 most salient sentences, freeing tokens for conversation history.
- Include **metadata-aware filtering** (by file, section, or topic) based on `currentTopic` or explicit user constraints (e.g., “only from lecture 3 notes”). That would reduce noise when multiple documents are loaded.
- Feed the retriever with **question re-writes** that incorporate conversational context (e.g., “Based on the PDF about X we just discussed, answer: …”) rather than raw last message text, to mitigate router misclassification and ambiguous queries.

These are standard upgrades in 2023–2025 RAG systems and would materially improve grounding quality.[^8][^3]

***

Final Verdict (honest, not diplomatic)
Architecturally, the AI Study Agent is a solid “v1.5” system: it has a non-trivial state graph, an external RAG microservice, and dynamic MCP integration, all glued together in a reasonably clean way. But from a context engineering and agentic‑reasoning perspective, it sits in an uncomfortable middle ground: the graph is more complex than a simple prompt chain but does not yet deliver the benefits of ReAct-style trajectories, Reflexion-like memory, or Toolformer-like tool control.[^6][^2][^3]

The biggest weaknesses are: (a) unbounded, redundant context growth with stacked system messages and stale RAG blocks; (b) a router that is blind to state and prone to skip RAG when it matters most; and (c) a tool integration story where MCP is used mainly for schema enrichment while the explicit tool loop in the graph is effectively dead code. These design choices are likely to produce hallucinations in multi-turn document-centric sessions, wasted tokens and latency at scale, and opaque tool behavior that is hard to debug.

With the suggested refactors—explicit context slots and pruning, a state-aware and RAG-biased router, a single consistent tool loop (either fully function-calling or fully ReAct-style), and MCP treated as a real context + control plane rather than just a schema registry—the same codebase could evolve into a genuinely agentic system that uses context efficiently and predictably instead of flooding the model with every artifact of prior steps.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^9]</span>

<div align="center">⁂</div>

[^1]: https://arxiv.org/abs/2210.03629

[^2]: https://arxiv.org/abs/2302.04761

[^3]: https://arxiv.org/pdf/2210.03629.pdf

[^4]: https://research.google/blog/react-synergizing-reasoning-and-acting-in-language-models/

[^5]: https://react-lm.github.io

[^6]: https://arxiv.org/abs/2303.11366

[^7]: https://dl.acm.org/doi/10.5555/3666122.3666499

[^8]: https://ieeexplore.ieee.org/document/11157319/

[^9]: https://www.semanticscholar.org/paper/99832586d55f540f603637e458a292406a0ed75d

[^10]: https://ieeexplore.ieee.org/document/11309628/

[^11]: https://www.semanticscholar.org/paper/e3bd22244f9acaa0a1bb99fa3d5913295fdfa35d

[^12]: https://www.semanticscholar.org/paper/2d427ff2eabde83312b12c7682f4baa7aa4ee3ad

[^13]: https://ieeexplore.ieee.org/document/11412736/

[^14]: http://arxiv.org/pdf/2410.10779.pdf

[^15]: https://collaborate.princeton.edu/en/publications/react-synergizing-reasoning-and-acting-in-language-models/

[^16]: https://neurips.cc/virtual/2023/poster/70114

[^17]: https://ai.meta.com/research/publications/toolformer-language-models-can-teach-themselves-to-use-tools/

[^18]: https://www.semanticscholar.org/paper/ReAct:-Synergizing-Reasoning-and-Acting-in-Language-Yao-Zhao/99832586d55f540f603637e458a292406a0ed75d

[^19]: https://collaborate.princeton.edu/en/publications/reflexion-language-agents-with-verbal-reinforcement-learning-2/

[^20]: https://github.com/ysymyth/ReAct

[^21]: https://neurips.cc/media/neurips-2023/Slides/71288.pdf

[^22]: https://www.youtube.com/watch?v=QX-p-vsDoiQ


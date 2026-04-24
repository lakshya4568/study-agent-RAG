<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# also add research about what is mcp, what is context engineering, how to make it more good as a basis of research context engieernging then normal prompt engineering to save tokesns and all that

Here’s the extra research layer you asked for, focused on MCP, context engineering, and token‑efficient design as a *discipline* beyond classic prompt engineering.

***

## What MCP actually is (in research terms)

Model Context Protocol (MCP) is an open standard introduced by Anthropic (now adopted by OpenAI, Google, etc.) that defines how LLM “hosts” connect to external “servers” exposing tools, resources, and prompts over JSON‑RPC 2.0.[^1][^2][^3][^4]

Key points:

- **Roles and transport**: Hosts (LLM apps) connect to MCP servers via clients using JSON‑RPC over transports like stdio, HTTP, SSE; they negotiate capabilities and keep a stateful session.[^4][^1]
- **Capabilities**:
    - **Tools** (model-controlled): functions the LLM can call (APIs, actions).
    - **Resources** (application‑controlled): read‑only data the host makes available (file systems, DB views, etc.).
    - **Prompts** (user-controlled): templated instructions or flows that can themselves be served as context.[^1][^4]
- **Lifecycle**: initialization → discovery (`list_tools`, `list_resources`, etc.) → context provision (host chooses what to expose, and how, per query).[^4]

Recent work frames MCP as a *context integration layer* rather than just “tool plumbing”: the protocol is explicitly designed to let agents pull structured context (resources, prompts) and actions (tools) into the LLM’s working set in a standardized way. That’s why a lot of context‑engineering papers now explicitly talk about “MCP‑compliant context servers” or MCP‑backed memory.[^5][^6][^7][^8][^1]

***

## What “context engineering” is vs “prompt engineering”

**Prompt engineering** = optimizing *what single string you send* to an LLM: instruction wording, examples, role, etc. It treats the model as stateless; the main object is the prompt text.[^9][^10]

**Context engineering** = optimizing *what information and tools* the model sees over time, and in what structure. Anthropic’s own description is basically: “strategies for curating and maintaining the optimal set of tokens (system instructions, tool schemas, external data, history, MCP context, etc.) during inference.” LangChain’s docs are even more blunt: “context engineering is providing the right information and tools in the right format so the LLM can accomplish a task; this is the number one job of AI engineers.”[^10][^11]

Recent practitioner / research pieces converge on a similar decomposition:[^12][^13][^10]

- **Short‑term context**: active window (system prompts, latest messages, current RAG snippets, recent tool results).
- **Long‑term memory**: vector stores, key‑value stores, or MCP resources that can be queried when needed.
- **Tool / workflow layer**: what tools exist, when they’re considered, and how their results are injected back.
- **Isolation \& governance**: keeping different tasks/sessions separated to avoid context clash, prompt injection, or leakage.[^14][^13][^12]

Context engineering is about architecting these layers so the *right* 2–10k tokens are in the window at each step, not just “write a better prompt”.[^15][^11][^10]

***

## Why context engineering beats naive prompt engineering for token efficiency

Token cost and accuracy are now dominated not by the cleverness of a single system prompt but by:

- **How much redundant meta‑instruction you repeat**.
- **How many stale conversation turns and RAG blocks you keep around.**
- **How many tool schemas you stuff into every call.**

Multiple sources show that basic prompt‑length optimization alone yields maybe 30–60% cost reduction, but the big wins come from *structuring* context and selecting only what’s relevant per turn. Anthropic and others emphasize that as context windows grow, attention becomes a scarce resource: quadratic attention means that very long prompts actually reduce effective focus, so a “just throw everything in” strategy both wastes tokens and hurts quality.[^16][^9][^10][^15]

Context engineering gives you more levers than prompt engineering:

- Instead of a single monolithic prompt, you have **slots**: persona, current task plan, short history, retrieval context, tool trace, and external memory. You can trim or swap each slot independently.[^13][^11][^12]
- You can apply **Write–Select–Compress–Isolate**–style patterns: write rich info once, then select and compress only what’s needed for the next step, while isolating unrelated sessions or workflows.[^10][^15]
- You can make **tool exposure dynamic**: only include schemas for tools relevant to this query instead of dumping the entire MCP catalog into every prompt, which recent MCP research explicitly calls out as “prompt bloating”.[^17][^4]

Empirically, papers on prompt bloat from many MCP tools (e.g., JSPLIT) show that taxonomy‑based tool selection cuts tool-descriptions tokens significantly while maintaining task success—exactly the kind of structural optimization prompt‑only work never touches.[^17]

***

## How MCP fits into context engineering (beyond “just tools”)

MCP gives you standardized hooks to treat *tools, resources, and prompts themselves as context objects* rather than static text baked into a system prompt:[^3][^1][^4]

- **Tools as dynamic capabilities**: Instead of hard‑coding 30 tool descriptions into a single system message, the host can discover tools and then *select* a small subset based on user intent and a taxonomy (e.g., JSPLIT’s hierarchical organization).[^17][^4]
- **Resources as external long‑term memory**: Filesystems, databases, knowledge bases can be exposed as MCP resources and only their *retrieved slices* injected into the LLM context, not the whole corpus.[^5][^1]
- **Prompts as reusable instruction bundles**: You can store specialized instructions as MCP “prompts” and fetch the right one at runtime—avoiding embedding every possible instruction into a single massive persona prompt.[^1][^4]

This is exactly the direction newer work like Readme_AI and MCP‑AI frameworks push: use MCP servers as *context servers* that dynamically construct just‑enough context for each query, rather than preloading everything into every call.[^6][^5]

The catch: if you naively convert *all* MCP tools into LLM tool descriptors and stuff them into the prompt every time, you get the worst of both worlds—high token cost and tool confusion. That’s why JSPLIT exists: it explicitly addresses “prompt bloating in MCP” by taxonomy‑driven tool selection.[^17]

***

## Concrete strategies to “make it more good” than normal prompt engineering

If you want to use this as a basis for research and actual implementation improvements (including for your Study Agent), the interesting axis is: **context engineering patterns + MCP‑aware selection = fewer tokens + better grounding**.

Key directions, grounded in current literature:

1. **Slot-based context assembly instead of monolithic prompts**
    - Maintain separate, bounded slots for persona, current task plan, last N turns, current RAG context, and recent tool results.[^12][^13][^10]
    - Build the prompt per step via a deterministic “context assembler” that chooses which slot content to include and how much (e.g., last 4 turns, up to 2k tokens of RAG context, 1k tokens of notes).[^11][^16]
    - This lets you hard-cap each slot and avoid repeating persona and tool instructions each turn, saving tokens and reducing attention dilution.
2. **Dynamic tool selection over MCP catalogs**
    - Instead of exposing all MCP tools to the model on every turn, classify the user query and map it into a **tool taxonomy** (topic, capability, domain) to select only a small subset of tools; this is basically applying JSPLIT’s approach in practice.[^4][^17]
    - Use cheap heuristics or a small classifier to pick candidate tools, and only then build `tools[]` and tool-description snippets for the LLM. This directly cuts prompt tokens and empirical work shows it doesn’t significantly hurt performance.[^17]
3. **Aggressive compression of long‑term signal**
    - Periodically summarize older conversation spans into “episode summaries” and keep those outside the main window (e.g., as RAG‑indexable notes or MCP resources), pulling them back only when relevant.[^13][^10]
    - For RAG, compress retrieved chunks into short, citation‑preserving summaries before injecting them, instead of stuffing 5–10 raw chunks every time.[^5][^13]
    - Anthropic explicitly recommends “resetting” context and continuing from notes for long-horizon agents; this is a core context‑engineering pattern, not prompt tweaking.[^10]
4. **Workflow isolation + context guards**
    - Separate contexts per task/session/sub‑agent so that tools, instructions, and RAG indexes don’t bleed across domains—this both reduces prompt size per workflow and avoids “context clash”.[^14][^12][^13]
    - Use MCP as the isolation boundary: different MCP servers or resource roots per project/user/session, which your host chooses per query instead of mounting everything at once.[^8][^1]
5. **Token-aware instruction design instead of maximalism**
    - Still do “classic” prompt engineering, but under token budget constraints: short, high‑impact instructions, minimal redundancy, and explicit removal of instructions that don’t affect behavior.[^9][^16]
    - Context-engineering perspective here: measure token cost of each slot (persona, tools, RAG, history) and treat them as trade‑offs; don’t optimize one in isolation.

If you frame your work as **“MCP-aware context engineering for agentic systems”**, you can explicitly position it as:

- Moving from “write good prompts” to “design a context allocation and selection policy over tools, resources, and memories.”[^11][^12]
- Tackling prompt bloat and token waste as *architectural* problems (taxonomy, slots, selection, compression), not just “shorter sentences”.[^15][^10][^17]
- Using MCP as the substrate for modular, stateful context sources that can be mounted/unmounted per workflow, instead of one giant, static prompt.[^3][^5][^1]

That gives you a clear research angle and a justification for why context engineering is the relevant lens: it’s about *controlling the information environment under token constraints*, not just making the first system message prettier.
<span style="display:none">[^18][^19][^20][^21][^22][^23]</span>

<div align="center">⁂</div>

[^1]: https://modelcontextprotocol.io/specification/2025-06-18

[^2]: https://en.wikipedia.org/wiki/Model_Context_Protocol

[^3]: https://github.com/modelcontextprotocol

[^4]: https://www.philschmid.de/mcp-introduction

[^5]: https://arxiv.org/abs/2509.19322

[^6]: https://ieeexplore.ieee.org/document/11471492/

[^7]: https://www.anthropic.com/news/model-context-protocol

[^8]: https://cloud.google.com/discover/what-is-model-context-protocol

[^9]: https://www.gocodeo.com/post/context-window-optimization-through-prompt-engineering

[^10]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

[^11]: https://docs.langchain.com/oss/python/langchain/context-engineering

[^12]: https://mobisoftinfotech.com/resources/blog/ai-development/context-engineering-for-llms-enterprise-ai-agents

[^13]: https://weaviate.io/blog/context-engineering

[^14]: https://arxiv.org/abs/2601.17549

[^15]: https://www.youtube.com/watch?v=zMM5zqesL1g

[^16]: https://dev.to/superorange0707/prompt-length-vs-context-window-the-real-limits-behind-llm-performance-3h20

[^17]: https://arxiv.org/abs/2510.14537

[^18]: https://ieeexplore.ieee.org/document/11337310/

[^19]: https://arxiv.org/abs/2602.14878

[^20]: https://zenodo.org/doi/10.5281/zenodo.19243308

[^21]: https://digital-library.theiet.org/content/journals/10.1049/oap-cired.2017.0057

[^22]: https://modelcontextprotocol.info/specification/

[^23]: https://github.com/modelcontextprotocol/modelcontextprotocol


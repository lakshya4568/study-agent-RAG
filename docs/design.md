# 🎨 AI Study Agent — UI/UX Design System & Specification (`design.md`)

> **Version:** 2.0.0 • **Theme:** Radiant Light & Colorful (Daylight Focus) • **Platform:** Desktop Electron (React + Tailwind CSS + Framer Motion)

---

## 1. 🌟 Design Philosophy & Visual Language

The AI Study Agent interface is designed for **Cognitive Clarity, High-Dopamine Focus, and Tactile Precision**. Unlike sterile white docs or dull monochrome tools, the **Radiant Light & Colorful** aesthetic uses vibrant daylight surfaces, soft micro-tints, frosted glass depth, and joyful semantic accents to reduce study fatigue and maximize recall.

### Core Principles
1. **Daylight Ergonomics:** Bright, airy backgrounds with soft warm/cool under-glows that eliminate visual gloom without blinding contrast.
2. **Tactile Hardware Depth (Doppelrand):** Cards, modals, and toolbars feel physical—crafted like machined glass plates nested inside soft metallic bezels.
3. **Grounded Intelligence:** AI reasoning steps, RAG vector citations, and tool calls are visible, interactive, and clearly distinct from conversational output.
4. **Active Gamification:** Active recall, spaced repetition ratings, and focus timers use distinct color-coded semantic cues to make study sessions feel rewarding.

---

## 2. 🌈 Color System: Radiant Light & Colorful Palette

The color system is organized into **Canvas Foundations**, **Elevated Surfaces**, and **Vibrant Functional Accents**.

### 2.1 Foundation Tokens (Light Mode)

| Token Name | CSS Variable | Hex / HSL | Usage |
|---|---|---|---|
| **Canvas Background** | `--background` | `#F8FAFC` (`210 40% 98%`) | App-wide backdrop canvas |
| **Surface Card** | `--card` | `#FFFFFF` (`0 0% 100%`) | Primary panels, chat bubbles, decks |
| **Surface Nested** | `--card-nested` | `#F1F5F9` (`210 40% 96%`) | Inner tool containers, code blocks, quote wells |
| **Border Subtle** | `--border` | `#E2E8F0` (`214 32% 91%`) | 1px card hairlines, dividers |
| **Border Highlight** | `--border-highlight` | `rgba(255, 255, 255, 0.9)` | Top edge highlights for glassmorphism |
| **Foreground Main** | `--foreground` | `#0F172A` (`222 47% 11%`) | Primary headings and body text |
| **Foreground Muted**| `--muted-foreground` | `#64748B` (`215 16% 47%`) | Metadata, shortcuts, secondary hints |

---

### 2.2 Vibrant Semantic Color Spectrum

Every subject, study mode, and agent action is assigned an energetic, recognizable hue:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VIBRANT ACCENT SPECTRUM                               │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│  ⚡ INDIGO   │  🌿 EMERALD  │  ☀️ AMBER    │  🌸 CORAL    │  🌊 CYAN / AZURE│
│  AI / Agent  │  Mastery     │  Review Due  │  Hard / Gap  │  RAG / Vectors  │
│  #6366F1     │  #10B981     │  #F59E0B     │  #F43F5E     │  #0EA5E9        │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

#### Detailed Accent Matrix

| Palette | Primary Hex | Light Tint Bg (10%) | Border / Ring (30%) | Context & Semantic Role |
|---|---|---|---|---|
| **Electric Indigo** | `#6366F1` | `#EEF2FF` | `#C7D2FE` | **AI Thought & Actions:** Primary buttons, agent avatar, reasoning steps, active tab. |
| **Emerald Mint** | `#10B981` | `#ECFDF5` | `#A7F3D0` | **Mastery & Verified:** Easy flashcards, RAG grounded facts, success states, high score. |
| **Sunset Amber** | `#F59E0B` | `#FFFBEB` | `#FDE68A` | **Recall & Urgency:** Medium difficulty cards, Pomodoro focus timer, pending review. |
| **Coral Rose** | `#F43F5E` | `#FFF1F2` | `#FECDD3` | **Attention & Hard:** Again/Fail flashcards, knowledge gaps, destructive actions. |
| **Sky Cyan** | `#0EA5E9` | `#F0F9FF` | `#BAE6FD` | **Vector Knowledge:** ChromaDB embeddings, PDF chunk citations, similarity scores. |
| **Royal Amethyst**| `#8B5CF6` | `#F5F3FF` | `#DDD6FE` | **MCP Tools & Skills:** External tool sessions, custom agent capabilities. |

---

## 3. ✍️ Typography Hierarchy & Type Scales

Academic study software demands **fatigue-free legibility** across mathematical formulas, code blocks, structured summaries, and long research papers.

### 3.1 Font Stack Selection

- **Display & Headings:** `Outfit`, `Plus Jakarta Sans`, or `SF Pro Display` (Geometric, friendly, modern weight balance).
- **Body & Long-form Text:** `Inter`, `SF Pro Text`, or system sans-serif (Engineered for optimal x-height and screen legibility at 14–16px).
- **Math & Equations:** `KaTeX Sans` with standard Greek/Latin glyph support.
- **Code & Vectors:** `JetBrains Mono`, `Fira Code`, or `ui-monospace` with tabular figures (`tnum`).

---

### 3.2 Typographic Scale Matrix

| Level | Size (rem / px) | Line Height | Weight | Tracking | Purpose |
|---|---|---|---|---|---|
| **Display 2XL** | `2.25rem` / `36px` | `1.2` | `700 Bold` | `-0.03em` | Hero titles, Welcome banner, Empty state headers |
| **Heading 1 (H1)**| `1.75rem` / `28px` | `1.25`| `700 Bold` | `-0.02em` | View titles (Active Recall, Vector Studio) |
| **Heading 2 (H2)**| `1.375rem` / `22px`| `1.35`| `600 SemiBold`| `-0.015em`| Card titles, Section headers, Flashcard Front |
| **Heading 3 (H3)**| `1.125rem` / `18px`| `1.4` | `600 SemiBold`| `-0.01em` | Deck names, Tool group titles, Modal subheadings |
| **Body Large** | `1.00rem` / `16px` | `1.65`| `400 / 500` | `0` | AI Tutor explanations, primary reading text |
| **Body Regular** | `0.875rem` / `14px`| `1.55`| `400 / 500` | `0` | Sidebar labels, chat inputs, settings controls |
| **Caption / Meta**| `0.75rem` / `12px` | `1.4` | `500 Medium`| `+0.01em` | Timestamps, token usage, similarity badges |
| **Micro / Eyebrow**| `0.6875rem`/ `11px`| `1.3` | `600 / 700` | `+0.05em` | `UPPERCASE` Eyebrow tags, shortcut keys (`⌘1`) |
| **Mono Code** | `0.8125rem`/ `13px`| `1.6` | `500 Medium`| `0` | Inline code, JSON payloads, Python snippets |

---

## 4. 📐 Elevation, Glassmorphism & Micro-Aesthetics

### 4.1 The "Doppelrand" (Double-Bezel) Card Architecture
Avoid generic 1px flat borders. Enclose key study components in nested architectural shells:
```html
<!-- Outer Shell -->
<div class="p-1 rounded-2xl bg-gradient-to-b from-slate-200/80 to-slate-200/20 shadow-sm">
  <!-- Inner Core -->
  <div class="bg-white rounded-[calc(1rem-2px)] p-5 border border-slate-100 shadow-inner">
    <!-- Component Content -->
  </div>
</div>
```

### 4.2 Frosted Daylight Glass
- **Class:** `bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)]`
- **Use cases:** Top navigation bar, floating prompt dock, sticky flashcard controls.

### 4.3 Island Buttons with Nested Circle Icons
Interactive CTAs feature an outer pill and an inner action orb:
- **Button:** `rounded-full px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-500/20`
- **Trailing Icon:** `w-6 h-6 rounded-full bg-white/20 flex items-center justify-center ml-2`

---

## 5. 🖥️ Core UI Surfaces & Screen Specifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION SHELL                                │
├───────────┬─────────────────────────────────────────────────────────────────┤
│  SIDEBAR  │  TOP BAR (Active View Title • Study Breadcrumbs • Status Pills) │
│  (Icons + ├─────────────────────────────────────────────────────────────────┤
│   Labels  │                                                                 │
│   + Color │                     ACTIVE VIEW CANVAS                          │
│   Badges) │                                                                 │
│           │  [1. Study Chat] [2. Flashcards] [3. Vectors] [4. Tools] [5. Ctl]│
│           │                                                                 │
│  ──────── │                                                                 │
│  Profile  │  [Floating Context Dock / Multi-Modal Input Bar]               │
└───────────┴─────────────────────────────────────────────────────────────────┘
```

### 5.1 View 1: Study Chat & Cognitive Tutor
- **Adaptive Prompt Dock:**
  - Floating pill bar at the bottom with quick context pills (`@Physics Notes.pdf`, `+ Quiz Me`, `+ Extract Cards`).
  - Auto-expanding textarea with support for copy-pasted diagrams and screenshots.
- **Thinking / CoT Accordion:**
  - Soft indigo collapsible box: *"🧠 Agent reasoned over 3 chunks from Lecture 4 (0.42s)"*.
- **Grounded Citation Tags:**
  - Inline badges: `[📄 Lecture 4, p.12 (94% match)]` rendered in Sky Cyan. Clicking opens an instant slide-over drawer with the original chunk context.
- **Math & Markdown Containers:**
  - Centered LaTeX equations with copy LaTeX button.
  - Formatted code blocks with one-click copy and syntax highlights matching the colorful palette.

---

### 5.2 View 2: Active Recall & Flashcards Studio
- **3D Flip Card Deck:**
  - Card with smooth 3D CSS rotate-y transition.
  - Front: Big H2 question, category badge (e.g., `🌿 Biology`), hint toggle.
  - Back: Answer with KaTeX formulas, key takeaways, and source note link.
- **SM-2 / Leitner Response Controls:**
  - `[1] Again (1m)` → Coral Rose (`#F43F5E`)
  - `[2] Hard (1d)` → Sunset Amber (`#F59E0B`)
  - `[3] Good (3d)` → Sky Azure (`#0EA5E9`)
  - `[4] Easy (7d)` → Emerald Mint (`#10B981`)
- **Mastery Heatmap & Streak Counter:**
  - Colorful GitHub-style activity grid showing daily flashcard retention and streaks.

---

### 5.3 View 3: Vector Knowledge & RAG Studio
- **Document Dropzone:**
  - Drag-and-drop zone with animated dashed borders, glowing emerald on drag hover.
  - File status pills: `Physics_Capitolo3.pdf • 48 Chunks • ChromaDB Indexed`.
- **Chunk Retrieval Sandbox:**
  - Test query input bar: *"Explain Heisenberg uncertainty principle"*.
  - Visualized similarity score cards (e.g., `Cosine Sim: 0.892`) with highlighted search term keywords.

---

### 5.4 View 4: MCP Tools & Skills Hub
- **Integration Cards:**
  - Grid of installed MCP tools (`Postgres DB`, `Web Search`, `Python Math Sandbox`, `Anki Sync`).
  - Status indicator dot: `🟢 Connected (12ms)` or `🟡 Initializing`.
  - Tool execution history drawer with expandable input parameters and JSON outputs.

---

### 5.5 View 5: Control Studio & Memory Management
- **LLM & Embedding Selector:**
  - Model cards (OpenAI GPT-4o, NVIDIA Llama 3, DeepSeek R1) with latency/pricing tags.
- **Long-Term Memory Inspector:**
  - Semantic memory cards showing what the agent knows about the user's study habits, exam dates, and weak areas.

---

## 6. 🎬 Motion, Micro-Interactions & Spring Physics

- **Default Transition Curve:** `cubic-bezier(0.16, 1, 0.3, 1)` (Ultra-smooth Apple-tier ease-out spring).
- **Hover Transitions:** `duration-200` with subtle scale-up (`scale-[1.01]`) and elevation lift.
- **Press States:** Active scale-down (`active:scale-[0.98]`).
- **Flashcard 3D Flip:** `transition-transform duration-500 [transform-style:preserve-3d]`.
- **List / Message Entry:** Staggered slide-up with fade:
  ```css
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```

---

## 7. ♿ Accessibility & Contrast Guardrails

1. **Text Contrast Ratio:** All body text on light backgrounds maintains at least **4.5:1** (WCAG AA), headings achieve **7:1** (WCAG AAA).
2. **Focus Rings:** High-visibility focus ring: `ring-2 ring-indigo-500/40 ring-offset-2 ring-offset-white`.
3. **Color-Blind Friendly Cues:** Every status badge pairs color with an explicit icon and text label (never color alone).

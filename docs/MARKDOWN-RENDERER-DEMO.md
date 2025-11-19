# ✨ Markdown Renderer Demo

Welcome to the **Study Agent** markdown rendering showcase! This document demonstrates all the beautiful rendering capabilities of our new MarkdownRenderer component.

---

## 📚 Headers & Typography

### Level 3 Header

#### Level 4 Header

This is a paragraph with **bold text**, _italic text_, and **_bold italic text_**. You can also use ~~strikethrough~~ text!

> 💡 **Pro Tip**: Blockquotes look amazing with our gradient border accent! They're perfect for highlighting important information, quotes, or tips.

---

## 📊 Tables

Here's a beautiful table with gradient headers and hover effects:

| Feature                  | Status      | Description                  |
| ------------------------ | ----------- | ---------------------------- |
| GitHub Flavored Markdown | ✅ Complete | Full GFM support with tables |
| LaTeX Math               | ✅ Complete | Inline and display equations |
| Emoji Support            | ✅ Complete | All your favorites 🚀 🎓 📚  |
| Syntax Highlighting      | ✅ Complete | Beautiful code blocks        |
| Custom Styling           | ✅ Complete | Professional design system   |

---

## 🧮 Math Equations

### Inline Math

The famous equation $E = mc^2$ changed physics forever. The quadratic formula $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$ is essential for algebra.

### Display Math

Here's the beautiful Gaussian integral:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

Maxwell's equations in differential form:

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\epsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0\mathbf{J} + \mu_0\epsilon_0\frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

---

## 💻 Code Blocks

### JavaScript Example

```javascript
// Beautiful syntax highlighting with JetBrains Mono font
const studyAgent = {
  name: "AI Study Mentor",
  features: ["summarize", "flashcards", "quiz", "explain"],

  async processDocument(file) {
    const chunks = await this.chunkDocument(file);
    const embeddings = await this.createEmbeddings(chunks);
    return this.storeInVectorDB(embeddings);
  },
};

console.log(
  `🚀 Study Agent loaded with ${studyAgent.features.length} features!`
);
```

### Python Example

```python
# AI Study Tools
import numpy as np
from langchain.embeddings import NVIDIAEmbeddings

class StudyAgent:
    def __init__(self, api_key: str):
        self.embeddings = NVIDIAEmbeddings(api_key=api_key)
        self.tools = ['summarize', 'quiz', 'flashcards']

    async def generate_flashcards(self, document: str) -> list[dict]:
        """Generate AI-powered flashcards from document"""
        concepts = await self.extract_concepts(document)
        return [
            {"front": concept.question, "back": concept.answer}
            for concept in concepts
        ]
```

### TypeScript with Type Annotations

```typescript
interface StudySession {
  id: string;
  subject: string;
  duration: number;
  completed: boolean;
}

type AgentResponse = {
  success: boolean;
  message: string;
  data?: unknown;
};

async function createQuiz(topic: string): Promise<AgentResponse> {
  const questions = await generateQuestions(topic);
  return { success: true, message: "Quiz created!", data: questions };
}
```

### Inline Code

Use the `MarkdownRenderer` component to render markdown. Call `npm install` to add dependencies. The `react-markdown` library is awesome!

---

## 📝 Lists

### Unordered Lists

- 🎯 **Study Smart**
  - Upload your documents
  - Get AI-powered summaries
  - Create flashcards automatically
- 💬 **Learn Better**
  - Ask questions about your materials
  - Get explanations with citations
  - Explore concepts deeply
- 🚀 **Stay Organized**
  - Track your progress
  - Build study schedules
  - Review effectively

### Ordered Lists

1. **Upload Documents** 📤
   - PDFs, text files, markdown
   - Automatically chunked and indexed
2. **Ask Questions** 💬
   - Natural language queries
   - Context-aware responses
3. **Create Study Materials** 📚
   - Flashcards
   - Quizzes
   - Summaries
4. **Practice & Review** ✅
   - Spaced repetition
   - Progress tracking

### Task Lists (GitHub Style)

- [x] Install markdown dependencies
- [x] Create MarkdownRenderer component
- [x] Add beautiful CSS styling
- [x] Integrate with MessageBubble
- [ ] Add syntax highlighting themes
- [ ] Create more study tools

---

## 🎨 Emoji Support

Emojis work seamlessly throughout your markdown! :rocket: :books: :brain: :sparkles: :fire: :star:

Standard emoji syntax also works: 🚀 📚 🧠 ✨ 🔥 ⭐

---

## 🔗 Links

Check out [Model Context Protocol](https://modelcontextprotocol.io/) for more info!

Learn about [LangChain](https://langchain.com/) for AI application development.

Explore [NVIDIA NIM](https://www.nvidia.com/en-us/ai-data-science/generative-ai/) for embeddings.

---

## 🖼️ Images

![Study Agent Logo](https://via.placeholder.com/600x200/667eea/ffffff?text=AI+Study+Agent)

Images have hover effects and responsive sizing!

---

## 🎯 Special Features

### Nested Blockquotes

> 📚 **Study Tip #1**
>
> > The best way to learn is through active recall and spaced repetition.
> >
> > > "Education is not the filling of a pail, but the lighting of a fire." - W.B. Yeats

### Combined Elements

You can combine **bold**, _italic_, `code`, and [links](https://example.com) in the same line!

Mix inline math $f(x) = x^2$ with **bold** and _italic_ for powerful expressions.

---

## 🌈 Color Scheme

Our markdown renderer features:

- 🎨 **Beautiful Gradients** - Purple to pink for headings
- 💎 **Glass Morphism** - Backdrop blur effects
- 🌓 **Dark Mode Ready** - Automatic theme switching
- ♿ **Accessible** - High contrast mode support
- 📱 **Responsive** - Mobile-optimized layouts

---

## 🚀 Technical Details

### Typography Stack

| Element   | Font Family    | Purpose                                   |
| --------- | -------------- | ----------------------------------------- |
| Body Text | Inter          | Exceptional readability with 69% x-height |
| Headings  | Work Sans      | Tech-friendly, optimized 14px-48px        |
| Code      | JetBrains Mono | Ligatures & excellent monospace           |

### Plugin Stack

- `remark-gfm` → Tables, strikethrough, task lists
- `remark-math` → LaTeX math parsing
- `remark-emoji` → :rocket: emoji support
- `remark-breaks` → Better line break handling
- `rehype-katex` → Math rendering with KaTeX
- `rehype-raw` → HTML support

---

## 💡 Usage Example

```tsx
import { MarkdownRenderer } from "./components/ui";

function ChatMessage({ content }) {
  return (
    <div className="message">
      <MarkdownRenderer content={content} />
    </div>
  );
}
```

That's it! Beautiful markdown rendering with zero configuration needed.

---

## 🎓 Study Agent Features

### Core Capabilities

1. **Document Processing** 📄
   - PDF parsing with citations
   - Automatic chunking
   - Vector embeddings with NVIDIA

2. **AI-Powered Learning** 🤖
   - Summarization
   - Flashcard generation
   - Quiz creation
   - Concept explanation

3. **Agent Workflow** 🔄
   - LangGraph state machines
   - Tool orchestration
   - Multi-step reasoning

---

## 📚 Conclusion

The **MarkdownRenderer** component provides:

✅ Beautiful, professional rendering  
✅ Full GitHub Flavored Markdown support  
✅ LaTeX math equations  
✅ Syntax highlighted code blocks  
✅ Emoji support  
✅ Responsive design  
✅ Dark mode ready  
✅ Accessible

**Happy Studying!** 🎓✨

---

_Built with ❤️ using React, TypeScript, and Electron_

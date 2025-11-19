# 🎨 Markdown Rendering System

Beautiful, professional markdown rendering for the AI Study Agent chatbot and all text-based content.

## ✨ Features

### 📚 Comprehensive Markdown Support

- ✅ **GitHub Flavored Markdown (GFM)**
  - Tables with gradient headers and hover effects
  - Strikethrough text
  - Task lists with checkboxes
  - Automatic URL linking

- ✅ **LaTeX Math Equations**
  - Inline math: `$E = mc^2$` → $E = mc^2$
  - Display math: `$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`
  - Full KaTeX support with beautiful rendering

- ✅ **Code Syntax Highlighting**
  - Language-aware code blocks
  - Inline code formatting
  - Code block headers with language labels
  - JetBrains Mono font for optimal readability

- ✅ **Emoji Support**
  - Standard emoji: 🚀 📚 🧠 ✨
  - GitHub emoji syntax: `:rocket:` → 🚀

- ✅ **Enhanced Typography**
  - Professional font stack (Inter, Work Sans, JetBrains Mono)
  - Proper line heights and spacing
  - Responsive font sizing

- ✅ **Beautiful Styling**
  - Gradient headers and accents
  - Smooth hover effects
  - Glass morphism design
  - Dark mode support
  - Accessibility features

## 📦 Installation

Already installed! Dependencies:

```json
{
  "react-markdown": "^9.0.1",
  "remark-math": "^6.0.0",
  "remark-gfm": "^4.0.0",
  "remark-breaks": "^4.0.0",
  "remark-emoji": "^5.0.0",
  "rehype-katex": "^7.0.0",
  "rehype-raw": "^7.0.0",
  "katex": "^0.16.9"
}
```

## 🚀 Usage

### Basic Usage

```tsx
import { MarkdownRenderer } from "./components/ui";

function MyComponent() {
  const markdown = `
# Hello World

This is **bold** and this is *italic*.

## Code Example
\`\`\`typescript
const greeting = "Hello, Study Agent!";
console.log(greeting);
\`\`\`

Math: $E = mc^2$
  `;

  return <MarkdownRenderer content={markdown} />;
}
```

### In Chat Messages

The `MessageBubble` component automatically uses `MarkdownRenderer` for assistant and system messages:

````tsx
<MessageBubble
  role="assistant"
  content="Here's a **summary**:\n\n- Point 1\n- Point 2\n\n```python\nprint('Hello')\n```"
  timestamp={new Date()}
/>
````

### Custom Styling

Pass additional CSS classes:

```tsx
<MarkdownRenderer content={markdownText} className="my-custom-class" />
```

## 🎨 Typography

### Font Stack

| Use Case  | Font Family        | Why                                                                     |
| --------- | ------------------ | ----------------------------------------------------------------------- |
| Body Text | **Inter**          | Exceptional readability with 69% x-height, perfect for extended reading |
| Headings  | **Work Sans**      | Tech-friendly, optimized for 14px-48px sizes                            |
| Code      | **JetBrains Mono** | Ligatures support, excellent monospace rendering                        |

### Automatically Loaded

Fonts are loaded via Google Fonts in the `markdown.css` file - no additional configuration needed!

## 📐 Components Styling

### Tables

Tables feature:

- Gradient purple-pink headers
- Hover effects on rows
- Alternating row colors
- Rounded corners with shadow
- Responsive sizing

Example:

```markdown
| Feature | Status |
| ------- | ------ |
| Tables  | ✅     |
| Math    | ✅     |
```

### Code Blocks

Code blocks include:

- Language label in header
- Dark theme background
- Horizontal scroll for long lines
- Syntax-aware formatting
- Copy-friendly monospace font

Example:

````markdown
```typescript
interface StudyAgent {
  name: string;
  capabilities: string[];
}
```
````

### Math Equations

Inline math: `$f(x) = x^2 + 2x + 1$`

Display math:

```markdown
$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0}
$$
```

### Blockquotes

Beautiful left-border accent with background:

```markdown
> 💡 **Pro Tip**: This is how blockquotes look!
```

## 🌓 Dark Mode

The markdown renderer automatically adapts to system preferences:

- Dark backgrounds for code blocks
- Adjusted text colors
- Border color adjustments
- Maintained readability

Powered by CSS `prefers-color-scheme` media queries.

## ♿ Accessibility

Built with accessibility in mind:

- ✅ Proper semantic HTML
- ✅ Focus visible states
- ✅ High contrast mode support
- ✅ Screen reader friendly
- ✅ Keyboard navigation
- ✅ ARIA-compliant markup

## 🎯 Use Cases

### In AI Study Agent

1. **Chat Messages** - All assistant responses rendered as markdown
2. **Study Summaries** - Rich formatting for document summaries
3. **Quiz Questions** - Math equations, code snippets in questions
4. **Flashcards** - Beautiful front/back content
5. **Explanations** - Step-by-step guides with syntax highlighting

### Example: Study Summary

````markdown
# 📚 Study Summary: Machine Learning

## Key Concepts

1. **Supervised Learning** - Training with labeled data
2. **Unsupervised Learning** - Finding patterns without labels

## Important Formula

The loss function for linear regression:

$$
L(\theta) = \frac{1}{2m} \sum_{i=1}^{m} (h_\theta(x^{(i)}) - y^{(i)})^2
$$

## Code Example

```python
import numpy as np

def gradient_descent(X, y, theta, alpha, iterations):
    m = len(y)
    for _ in range(iterations):
        predictions = X.dot(theta)
        errors = predictions - y
        theta -= (alpha / m) * X.T.dot(errors)
    return theta
```
````

## Tasks

- [x] Understand linear regression
- [ ] Implement gradient descent
- [ ] Test on real data

````

## 🎨 Customization

### Modify Styles

Edit `src/components/ui/markdown.css` to customize:

- Colors and gradients
- Spacing and sizing
- Font choices
- Animation effects
- Dark mode colors

### Add Custom Components

Extend the `components` prop in `MarkdownRenderer.tsx`:

```tsx
components={{
  // Add custom component
  img: ({ ...props }) => (
    <MyCustomImage {...props} />
  ),
  // ... existing components
}}
````

## 📊 Performance

- ⚡ Fast rendering with React optimizations
- 🎯 Efficient plugin system
- 💾 Small bundle size impact
- 🔄 Smooth animations with Framer Motion

## 🐛 Troubleshooting

### Math Not Rendering?

Make sure KaTeX CSS is imported in your component:

```tsx
import "katex/dist/katex.min.css";
```

### Code Blocks Not Styled?

Ensure the markdown.css file is imported:

```tsx
import "./markdown.css";
```

### Emoji Not Working?

The `remark-emoji` plugin handles both:

- GitHub syntax: `:smile:` → 😊
- Direct emoji: 😊

## 📚 References

- [react-markdown Documentation](https://github.com/remarkjs/react-markdown)
- [KaTeX Documentation](https://katex.org/)
- [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)
- [remark Plugin List](https://github.com/remarkjs/remark/blob/main/doc/plugins.md)

## 🎓 Demo

See the full feature demo in `docs/MARKDOWN-RENDERER-DEMO.md`!

---

**Built with ❤️ for beautiful, accessible study content**

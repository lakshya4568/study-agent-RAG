# 📚 RAG Pipeline User Guide

## Quick Start

### 1️⃣ Upload Documents

Click the **"Upload Docs"** button in the chat interface to add your study materials:

- ✅ **Supported Formats:**
  - PDF files (must contain searchable/selectable text)
  - Text files (.txt)
  - Markdown files (.md, .mdx)
  - Code files (.js, .ts, .tsx, .jsx, .json)

- ❌ **Not Supported (Yet):**
  - Image-based/scanned PDFs without OCR
  - Word documents (.doc, .docx)
  - PowerPoint presentations
  - Images or videos

### 2️⃣ Ask Questions

Once documents are uploaded, ask questions naturally:

```
✅ Good questions:
- "What are the main concepts in chapter 3?"
- "Explain the difference between X and Y"
- "Summarize the introduction"
- "What does the author say about Z?"

❌ Less effective:
- Very vague: "Tell me about this"
- Too specific: "What's on page 47, line 12?"
- Outside scope: Questions about content not in your uploads
```

### 3️⃣ Understand Responses

Alex (your AI mentor) will:

- ✅ Cite sources using `[Source 1: filename]` notation
- ✅ Provide context from your uploaded materials
- ✅ Offer general knowledge if uploads don't cover the topic
- ✅ Suggest uploading more materials if needed

## Common Scenarios

### Scenario 1: No Documents Uploaded Yet

**What you'll see:**

```
⚠️ Hey! I notice you haven't uploaded any study materials yet. 
I work best when I have your actual course materials to reference!

Click the 'Upload Docs' button to add your lecture notes, 
textbooks, or study guides. Then I can give you precise, 
cited answers from your materials.

I can still help with general questions, though! What would 
you like to know?
```

**What to do:** Upload your study materials using the button below the chat.

### Scenario 2: Question Not Covered by Uploads

**What you'll see:**

```
I don't see information about [topic] in your uploaded materials, 
but let me give you a general explanation...

[General knowledge answer]

💡 Tip: If you have materials about [topic], try uploading them 
for more specific help!
```

**What to do:**

- Upload more relevant materials if available
- Ask follow-up questions to clarify
- Use the general knowledge provided

### Scenario 3: Image-Based PDF Upload

**What you'll see:**

```
❌ Upload failed: PDF appears to contain no extractable text. 
It may be image-based or encrypted.

Try using OCR software to convert it to a searchable PDF first.
```

**What to do:**

1. Use OCR software (Adobe Acrobat, online tools) to convert the PDF
2. Alternatively, copy text manually into a .txt file
3. Upload the converted version

### Scenario 4: Successful Upload & Query

**What you'll see:**

```
📄 Documents uploaded successfully! I've added 1 new document 
to my knowledge base (47 chunks indexed). Feel free to ask 
me questions about the content!

---

You: What is machine learning?

Alex: Great question! According to your materials...

[Source 1: ml-textbook.pdf · User Upload]
Machine learning is a subset of artificial intelligence...

Based on these sources, here's what you need to know...
[Detailed explanation with multiple source citations]
```

## 📊 Document Upload Tips

### For Best Results

1. **Use Text-Based PDFs:**
   - Make sure PDFs have selectable text
   - Test by trying to copy-paste text from the PDF
   - If text can't be selected, use OCR first

2. **Organize Your Materials:**
   - Upload related materials together
   - Use descriptive filenames (they appear in citations)
   - Start with your most important resources

3. **Upload Order:**
   - Upload foundational materials first
   - Add supplementary materials as needed
   - Re-upload if you have updated versions

### File Size & Performance

- ✅ **Optimal:** 1-50 pages per PDF
- ⚠️ **Large:** 50-200 pages (slower processing)
- ❌ **Very Large:** 200+ pages (may be slow or timeout)

**Tip:** For very large textbooks, upload chapter by chapter instead of the entire book.

## 🔍 Understanding Citations

When Alex references your materials, you'll see:

```
[Source 1: lecture-notes.pdf · User Upload]
[Source 2: README.md · Built-in]
```

- **Source Number:** Indicates which document
- **Filename:** The file you uploaded
- **Origin:**
  - "User Upload" = Your uploaded materials
  - "Built-in" = System documentation (if any)

## 🐛 Troubleshooting

### Problem: "No documents in knowledge base"

**Solution:** Upload documents using the "Upload Docs" button.

### Problem: Upload button does nothing

**Solution:**

- Check console for errors (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows)
- Restart the application
- Check if ChromaDB server is running

### Problem: "No relevant context found"

**Solution:**

- Try rephrasing your question
- Upload more materials related to the topic
- Check if your uploads actually cover the topic

### Problem: PDF upload fails

**Solution:**

- Verify the PDF has selectable text
- Try opening it in a PDF viewer first
- Use OCR if it's image-based
- Check file isn't corrupted

### Problem: Responses are too general

**Solution:**

- Upload more specific materials
- Ask more focused questions
- Reference specific sections: "In chapter 3, what does it say about..."

## 🎯 Advanced Usage

### Creating Flashcards

```
"Create flashcards from the key concepts in chapter 5"
```

### Generating Quizzes

```
"Generate a 10-question quiz on the material about X"
```

### Summarization

```
"Summarize the main points from the uploaded lecture notes"
```

### Concept Explanation

```
"Explain [concept] using examples from my study materials"
```

## 📝 Best Practices

1. **Start Simple:** Upload 1-2 key documents first
2. **Test with Questions:** Ask a few questions to verify the content is indexed correctly
3. **Iterate:** Add more materials based on what gaps you find
4. **Organize:** Use clear filenames for easy reference in citations
5. **Update:** Re-upload if you get updated versions of materials

## 🚀 What's Next

After uploading your materials, try:

- Creating study schedules
- Generating practice problems
- Getting explanations of difficult concepts
- Building comprehensive study guides

Remember: Alex is your study mentor, not a homework solver! The goal is to help you **understand** and **learn**, not just get answers.

---

**Need Help?** Check the console logs or restart the application if issues persist.

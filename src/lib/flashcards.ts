
export function parseFlashcardsFromContent(content: string): any[] | null {
  let potentialJson = content.trim();
  const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
  const match = potentialJson.match(codeBlockRegex);
  if (match) {
    potentialJson = match[1].trim();
  }

  // Try simple parse first
  try {
    const parsed = JSON.parse(potentialJson);
    if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
      return parsed.flashcards;
    }
  } catch (e) {
    // Fallback: Brace counting for embedded JSON
    const startIdx = content.indexOf("{");
    if (startIdx !== -1) {
      let braceCount = 0;
      let endIdx = -1;
      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === "{") braceCount++;
        if (content[i] === "}") braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }

      if (endIdx !== -1) {
        try {
          const candidate = content.substring(startIdx, endIdx);
          const parsed = JSON.parse(candidate);
          if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
            return parsed.flashcards;
          }
        } catch (e2) {
          // Failed to parse candidate
        }
      }
    }
  }

  return null;
}

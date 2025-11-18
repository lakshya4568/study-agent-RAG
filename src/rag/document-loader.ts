import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import type { Document } from "@langchain/core/documents";
import { logger } from "../client/logger";

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".mdx",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);
const PDF_EXTENSION = ".pdf";

function filterExistingPaths(filePaths: string[]): string[] {
  return filePaths
    .map((filePath) => path.resolve(process.cwd(), filePath))
    .filter((fullPath) => {
      const exists = fs.existsSync(fullPath);
      if (!exists) {
        logger.warn(`Document path not found: ${fullPath}`);
      }
      return exists;
    });
}

/**
 * Enriches document metadata with source information and timestamps
 * Ensures all metadata values are primitives for ChromaDB compatibility
 */
const REPO_ROOT = path.resolve(process.cwd()).toLowerCase();

function getDocumentFingerprint(absolutePath: string, stats: fs.Stats): string {
  const hash = createHash("sha1");
  hash.update(absolutePath.toLowerCase());
  hash.update(String(stats.size));
  hash.update(String(stats.mtimeMs));
  return hash.digest("hex");
}

function enrichMetadata(doc: Document, filePath: string): Document {
  const absolutePath = path.resolve(filePath);
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  const stats = fs.statSync(absolutePath);
  const absoluteLower = absolutePath.toLowerCase();
  const isRepoDocument = absoluteLower.startsWith(REPO_ROOT);
  const documentId = getDocumentFingerprint(absolutePath, stats);
  const timestamp = new Date().toISOString();

  // Ensure all metadata values are primitives (string, number, boolean, null)
  // ChromaDB does not support nested objects or arrays
  return {
    ...doc,
    metadata: {
      source: relativePath,
      fileName: fileName,
      fileType: extension,
      loadedAt: timestamp,
      absolutePath: absolutePath,
      origin: isRepoDocument ? "repository" : "user-uploaded",
      documentId: documentId,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      ingestedAt: timestamp,
    },
  };
}

/**
 * Validates if a PDF has extractable text content
 */
async function validatePDFContent(doc: Document): Promise<boolean> {
  const content = doc.pageContent.trim();
  // Check if page has meaningful content (more than just whitespace/empty)
  if (content.length < 10) {
    return false;
  }
  // Check if it's not just garbled/encoded content
  const printableChars = content.replace(/[\s\n\r\t]/g, "");
  if (printableChars.length === 0) {
    return false;
  }
  return true;
}

/**
 * Loads study documents from file paths with enhanced metadata
 * Supports PDF, text, markdown, and code files
 * Includes robust PDF parsing with validation
 */
export async function loadStudyDocuments(
  filePaths: string[]
): Promise<Document[]> {
  const resolvedPaths = filterExistingPaths(filePaths);
  const documents: Document[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const filePath of resolvedPaths) {
    const extension = path.extname(filePath).toLowerCase();

    try {
      let loadedDocs: Document[] = [];

      if (extension === PDF_EXTENSION) {
        logger.info(`📄 Parsing PDF: ${path.basename(filePath)}...`);

        // Use PDFLoader with enhanced options for better text extraction
        const loader = new PDFLoader(filePath, {
          splitPages: true,
          parsedItemSeparator: " ", // Add space between parsed items
        });

        loadedDocs = await loader.load();

        // Validate that PDF pages have extractable content
        const validDocs: Document[] = [];
        let emptyPages = 0;

        for (const doc of loadedDocs) {
          const isValid = await validatePDFContent(doc);
          if (isValid) {
            // Clean up the content: normalize whitespace and remove control characters
            const cleanedContent = doc.pageContent
              .replace(/\r\n/g, "\n") // Normalize line endings
              .replace(/\r/g, "\n") // Convert remaining \r to \n
              .replace(/\s+/g, " ") // Normalize whitespace
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
              .trim();

            validDocs.push({
              ...doc,
              pageContent: cleanedContent,
            });
          } else {
            emptyPages++;
          }
        }

        if (validDocs.length === 0) {
          throw new Error(
            "PDF appears to contain no extractable text. It may be image-based or encrypted. " +
              "Try using OCR software to convert it to a searchable PDF first."
          );
        }

        if (emptyPages > 0) {
          logger.warn(
            `⚠️ Skipped ${emptyPages} empty/unreadable pages from ${path.basename(filePath)}`
          );
        }

        loadedDocs = validDocs;
        logger.info(
          `✅ Loaded PDF: ${path.basename(filePath)} (${loadedDocs.length} pages with text)`
        );
      } else if (TEXT_EXTENSIONS.has(extension)) {
        const loader = new TextLoader(filePath);
        loadedDocs = await loader.load();

        // Validate text content
        const content = loadedDocs[0]?.pageContent?.trim() || "";
        if (content.length < 10) {
          throw new Error("File appears to be empty or too short");
        }

        logger.info(`✅ Loaded text file: ${path.basename(filePath)}`);
      } else {
        // Try as text for unknown extensions
        logger.warn(
          `Unknown extension ${extension}, attempting text load: ${filePath}`
        );
        const loader = new TextLoader(filePath);
        loadedDocs = await loader.load();

        // Validate content
        const content = loadedDocs[0]?.pageContent?.trim() || "";
        if (content.length < 10) {
          throw new Error("File appears to be empty or unreadable");
        }
      }

      // Enrich all loaded documents with metadata
      const enrichedDocs = loadedDocs.map((doc) =>
        enrichMetadata(doc, filePath)
      );
      documents.push(...enrichedDocs);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to load document ${filePath}: ${errorMsg}`);
      errors.push({ path: filePath, error: errorMsg });
    }
  }

  logger.info(
    `📚 Document loading complete: ${documents.length} documents from ${resolvedPaths.length} files`
  );

  if (errors.length > 0) {
    logger.warn(`⚠️ Failed to load ${errors.length} files:`, errors);
  }

  return documents;
}

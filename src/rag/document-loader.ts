import fs from "node:fs";
import path from "node:path";
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
 */
function enrichMetadata(doc: Document, filePath: string): Document {
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath);
  const relativePath = path.relative(process.cwd(), filePath);

  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      source: relativePath,
      fileName,
      fileType: extension,
      loadedAt: new Date().toISOString(),
    },
  };
}

/**
 * Loads study documents from file paths with enhanced metadata
 * Supports PDF, text, markdown, and code files
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
        const loader = new PDFLoader(filePath, {
          splitPages: true,
        });
        loadedDocs = await loader.load();
        logger.info(
          `Loaded PDF: ${path.basename(filePath)} (${loadedDocs.length} pages)`
        );
      } else if (TEXT_EXTENSIONS.has(extension)) {
        const loader = new TextLoader(filePath);
        loadedDocs = await loader.load();
        logger.info(`Loaded text file: ${path.basename(filePath)}`);
      } else {
        // Try as text for unknown extensions
        logger.warn(
          `Unknown extension ${extension}, attempting text load: ${filePath}`
        );
        const loader = new TextLoader(filePath);
        loadedDocs = await loader.load();
      }

      // Enrich all loaded documents with metadata
      const enrichedDocs = loadedDocs.map((doc) =>
        enrichMetadata(doc, filePath)
      );
      documents.push(...enrichedDocs);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load document ${filePath}: ${errorMsg}`);
      errors.push({ path: filePath, error: errorMsg });
    }
  }

  logger.info(
    `Document loading complete: ${documents.length} documents from ${resolvedPaths.length} files`
  );

  if (errors.length > 0) {
    logger.warn(`Failed to load ${errors.length} files:`, errors);
  }

  return documents;
}

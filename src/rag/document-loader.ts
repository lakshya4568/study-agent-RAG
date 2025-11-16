import fs from "node:fs";
import path from "node:path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import type { Document } from "@langchain/core/documents";
import { logger } from "../client/logger";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".mdx"]);

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

export async function loadStudyDocuments(
  filePaths: string[]
): Promise<Document[]> {
  const resolvedPaths = filterExistingPaths(filePaths);
  const documents: Document[] = [];

  for (const filePath of resolvedPaths) {
    const extension = path.extname(filePath).toLowerCase();

    try {
      if (extension === ".pdf") {
        const loader = new PDFLoader(filePath);
        documents.push(...(await loader.load()));
        continue;
      }

      if (TEXT_EXTENSIONS.has(extension)) {
        const loader = new TextLoader(filePath);
        documents.push(...(await loader.load()));
        continue;
      }

      const loader = new TextLoader(filePath);
      documents.push(...(await loader.load()));
    } catch (error) {
      logger.error(`Failed to load document ${filePath}`, error);
    }
  }

  logger.info(`Loaded ${documents.length} source documents for RAG.`);
  return documents;
}

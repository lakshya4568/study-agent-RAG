// Type declarations for pdfjs-dist worker import
declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  const workerSrc: string;
  export default workerSrc;
}

// Support for import.meta.url in TypeScript
interface ImportMeta {
  url: string;
}

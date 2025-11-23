declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  const workerSrc: string;
  export default workerSrc;
}

declare module "*.png" {
  const value: string;
  export default value;
}

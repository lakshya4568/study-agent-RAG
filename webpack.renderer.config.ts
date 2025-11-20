import type { Configuration } from "webpack";
import path from "path";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
    alias: {
      // Help Webpack find the PDF worker
      "pdfjs-dist/build/pdf.worker.min.mjs": path.join(
        __dirname,
        "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
      ),
    },
  },
  node: {
    __dirname: true,
    __filename: true,
  },
};

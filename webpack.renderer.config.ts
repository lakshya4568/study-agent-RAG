import type { Configuration } from "webpack";
import path from "path";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const rendererConfig: Configuration = {
  module: {
    rules: rules.filter((rule) => {
      // @ts-ignore - rule.use might be a string or object
      const use = rule.use;
      if (typeof use === "object" && use !== null && "loader" in use) {
        return use.loader !== "@vercel/webpack-asset-relocator-loader";
      }
      return true;
    }),
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
};

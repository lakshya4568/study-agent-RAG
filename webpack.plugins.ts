import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
    typescript: {
      configFile: "tsconfig.json",
      diagnosticOptions: {
        semantic: true,
        syntactic: true,
      },
      mode: "write-references",
    },
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(
          __dirname,
          "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
        ),
        to: "pdf.worker.min.mjs",
      },
    ],
  }),
];

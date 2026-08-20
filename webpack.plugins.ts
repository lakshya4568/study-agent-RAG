import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

export const plugins = [
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


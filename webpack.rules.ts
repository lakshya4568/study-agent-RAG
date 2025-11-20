import type { ModuleOptions } from "webpack";

export const rules: Required<ModuleOptions>["rules"] = [
  // Add support for native node modules
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    test: /native_modules[/\\].+\.node$/,
    use: "node-loader",
  },
  {
    test: /pdfjs-dist/,
    type: "javascript/auto",
  },
  {
    test: /pdf\.worker\.min\.mjs$/,
    type: "asset/resource",
    generator: {
      filename: "[name][ext]",
    },
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    parser: { amd: false },
    exclude: /pdfjs-dist/,
    use: {
      loader: "@vercel/webpack-asset-relocator-loader",
      options: {
        outputAssetBase: "native_modules",
      },
    },
  },
  // Fix for pdfjs-dist ESM compatibility
  {
    test: /[/\\]node_modules[/\\]pdfjs-dist[/\\]/,
    type: "javascript/auto",
  },
  // Bundle PDF worker as a local asset
  {
    test: /pdf\.worker\.(min\.)?m?js$/,
    type: "asset/resource",
    generator: {
      filename: "pdf.worker.[contenthash].mjs",
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: "ts-loader",
      options: {
        transpileOnly: true,
        compilerOptions: {
          module: "commonjs",
          noEmit: false,
        },
      },
    },
  },
  {
    test: /\.css$/,
    use: ["style-loader", "css-loader", "postcss-loader"],
  },
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: "asset/resource",
    generator: {
      filename: "fonts/[name][ext]",
    },
  },
];

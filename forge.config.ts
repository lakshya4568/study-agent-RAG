import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { existsSync } from "fs";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

// Include .env only if it exists
const extraResources = ["./python", "./.venv", "./mcp.json", "./scripts"];
if (existsSync("./.env")) {
  extraResources.push("./.env");
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: extraResources,
    appBundleId: "com.lakshya.ai-study-agent",
    appCategoryType: "public.app-category.education",
    icon: "./src/assets/icon", // Add your icon here (icon.icns for macOS)
    // Optional: Code signing (requires Apple Developer account)
    // osxSign: {
    //   identity: process.env.APPLE_IDENTITY,
    //   hardenedRuntime: true,
    //   entitlements: "entitlements.plist",
    //   "entitlements-inherit": "entitlements.plist",
    //   "signature-flags": "library"
    // },
    // osxNotarize: process.env.APPLE_ID ? {
    //   appleId: process.env.APPLE_ID,
    //   appleIdPassword: process.env.APPLE_ID_PASSWORD,
    //   teamId: process.env.APPLE_TEAM_ID
    // } : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG(
      {
        format: "ULFO",
        name: "AI-Study-Agent",
      },
      ["darwin"]
    ),
    new MakerZIP({}, ["darwin"]),
    new MakerSquirrel({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/preload.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default config;

#!/usr/bin/env node
/**
 * Cross-platform Python setup script
 * Detects the correct Python command (python3, python) and runs setup
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Find the correct Python command available on this system
 */
function findPythonCommand() {
  const commands = ["python3", "python"];

  for (const cmd of commands) {
    try {
      execSync(`${cmd} --version`, { stdio: "pipe" });
      return cmd;
    } catch (error) {
      // Command not found, try next
      continue;
    }
  }

  return null;
}

/**
 * Main setup function
 */
function main() {
  console.log("🔍 Detecting Python installation...");

  const pythonCmd = findPythonCommand();

  if (!pythonCmd) {
    console.error("\n❌ ERROR: Python is not installed or not in PATH");
    console.error("\nPlease install Python 3.8+ from:");
    console.error(
      "  • macOS: brew install python3  OR  https://www.python.org/downloads/"
    );
    console.error("  • Windows: https://www.python.org/downloads/");
    console.error("  • Linux: sudo apt install python3 python3-pip\n");
    process.exit(1);
  }

  console.log(`✓ Found Python: ${pythonCmd}`);

  try {
    const version = execSync(`${pythonCmd} --version`, {
      encoding: "utf-8",
    }).trim();
    console.log(`  Version: ${version}`);
  } catch (error) {
    // Ignore version check errors
  }

  // Run the Python setup script
  const setupScript = path.join(__dirname, "..", "python", "setup.py");

  if (!fs.existsSync(setupScript)) {
    console.error(`\n❌ ERROR: Setup script not found at ${setupScript}`);
    process.exit(1);
  }

  console.log("\n📦 Running Python dependency installation...");

  try {
    execSync(`${pythonCmd} "${setupScript}"`, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    console.log("\n✅ Python setup completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Python setup failed");
    console.error("Please check the error messages above and try again.\n");
    process.exit(1);
  }
}

// Run the script
main();

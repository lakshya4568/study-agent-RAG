#!/usr/bin/env node
/**
 * Cross-platform Python setup script
 * Detects the correct Python command, creates a venv if needed, and runs setup
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Find the correct Python command available on this system
 */
function findSystemPython() {
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

  const projectRoot = path.join(__dirname, "..");
  const venvPath = path.join(projectRoot, ".venv");
  const isWin = process.platform === "win32";
  const venvPython = isWin
    ? path.join(venvPath, "Scripts", "python.exe")
    : path.join(venvPath, "bin", "python");

  let pythonCmd = venvPython;

  // Check if venv exists
  if (!fs.existsSync(venvPython)) {
    console.log("📦 Virtual environment not found. Creating one...");
    const systemPython = findSystemPython();

    if (!systemPython) {
      console.error("\n❌ ERROR: Python is not installed or not in PATH");
      console.error("\nPlease install Python 3.8+ from:");
      console.error(
        "  • macOS: brew install python3  OR  https://www.python.org/downloads/"
      );
      console.error("  • Windows: https://www.python.org/downloads/");
      console.error("  • Linux: sudo apt install python3 python3-pip\n");
      process.exit(1);
    }

    try {
      execSync(`${systemPython} -m venv "${venvPath}"`, {
        stdio: "inherit",
        cwd: projectRoot,
      });
      console.log("✅ Virtual environment created.");
    } catch (error) {
      console.error("\n❌ Failed to create virtual environment");
      process.exit(1);
    }
  } else {
    console.log(`✓ Found existing virtual environment at ${venvPath}`);
  }

  console.log(`✓ Using Python: ${pythonCmd}`);

  try {
    const version = execSync(`"${pythonCmd}" --version`, {
      encoding: "utf-8",
    }).trim();
    console.log(`  Version: ${version}`);
  } catch (error) {
    // Ignore version check errors
  }

  // Run the Python setup script using the venv python
  const setupScript = path.join(__dirname, "..", "python", "setup.py");

  if (!fs.existsSync(setupScript)) {
    console.error(`\n❌ ERROR: Setup script not found at ${setupScript}`);
    process.exit(1);
  }

  console.log("\n📦 Running Python dependency installation...");

  try {
    // Set VIRTUAL_ENV env var to ensure pip knows we are in a venv
    const env = { ...process.env, VIRTUAL_ENV: venvPath };
    // Remove PYTHONHOME if set, as it can conflict with venv
    delete env.PYTHONHOME;

    execSync(`"${pythonCmd}" "${setupScript}"`, {
      stdio: "inherit",
      cwd: projectRoot,
      env: env,
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

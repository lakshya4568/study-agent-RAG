#!/usr/bin/env node
/**
 * Cross-platform Python setup script with automatic uv acceleration
 * Detects uv (or falls back to python3/python), creates/validates .venv, and syncs dependencies
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function isCommandAvailable(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findSystemPython() {
  const commands = ["python3", "python"];
  for (const cmd of commands) {
    if (isCommandAvailable(cmd)) {
      return cmd;
    }
  }
  return null;
}

function main() {
  const projectRoot = path.join(__dirname, "..");
  const venvPath = path.join(projectRoot, ".venv");
  const isWin = process.platform === "win32";
  const venvPython = isWin
    ? path.join(venvPath, "Scripts", "python.exe")
    : path.join(venvPath, "bin", "python");
  const requirementsFile = path.join(projectRoot, "python", "requirements.txt");

  const hasUv = isCommandAvailable("uv");

  console.log("⚡ Python Pipeline Setup:");
  if (hasUv) {
    console.log("  ✓ Detected 'uv' high-performance package manager");
  } else {
    console.log("  • 'uv' not detected; using standard Python tooling");
  }

  // 1. Create venv if needed
  if (!fs.existsSync(venvPython)) {
    console.log("  📦 Creating virtual environment (.venv)...");
    if (hasUv) {
      try {
        execSync(`uv venv "${venvPath}"`, {
          stdio: "inherit",
          cwd: projectRoot,
        });
        console.log("  ✓ Virtual environment created with uv.");
      } catch (err) {
        console.error("  ⚠️ uv venv failed, attempting fallback...");
      }
    }

    if (!fs.existsSync(venvPython)) {
      const systemPython = findSystemPython();
      if (!systemPython) {
        console.error("\n❌ ERROR: Python 3 is not installed or not in PATH.");
        process.exit(1);
      }
      execSync(`${systemPython} -m venv "${venvPath}"`, {
        stdio: "inherit",
        cwd: projectRoot,
      });
      console.log("  ✓ Virtual environment created with python -m venv.");
    }
  } else {
    console.log("  ✓ Found virtual environment at .venv");
  }

  // 2. Install / Sync requirements
  if (fs.existsSync(requirementsFile)) {
    console.log("  📦 Syncing Python dependencies...");
    if (hasUv) {
      try {
        execSync(
          `uv pip install -r "${requirementsFile}" --python "${venvPython}"`,
          {
            stdio: "inherit",
            cwd: projectRoot,
          }
        );
        console.log("  ✅ Python dependencies synced successfully via uv.\n");
        return;
      } catch (err) {
        console.warn("  ⚠️ uv pip install encountered an issue, falling back to pip...");
      }
    }

    const setupScript = path.join(projectRoot, "python", "setup.py");
    if (fs.existsSync(setupScript)) {
      const env = { ...process.env, VIRTUAL_ENV: venvPath };
      delete env.PYTHONHOME;
      execSync(`"${venvPython}" "${setupScript}"`, {
        stdio: "inherit",
        cwd: projectRoot,
        env,
      });
      console.log("  ✅ Python dependencies installed successfully.\n");
    }
  }
}

main();

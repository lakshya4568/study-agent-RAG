#!/usr/bin/env python3
"""
Setup script to install Python dependencies for NVIDIA embeddings service
"""
import subprocess
import sys
import os
import platform


def ensure_pip():
    """Ensure pip is available in the current Python environment"""
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        print("⚠️  pip is not available in the current Python environment")
        print("🔧 Attempting to install pip using ensurepip...")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "ensurepip", "--upgrade"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            print("✓ pip installed successfully")
            return True
        except subprocess.CalledProcessError:
            print("✗ Failed to install pip automatically")
            return False


def install_requirements():
    """Install Python requirements"""
    requirements_file = os.path.join(os.path.dirname(__file__), "requirements.txt")

    print("Installing Python dependencies for NVIDIA embeddings service...")

    # First, ensure pip is available
    if not ensure_pip():
        print("\n💡 Solutions:")
        if os.environ.get("VIRTUAL_ENV"):
            print("  Your virtual environment doesn't have pip. Try recreating it:")
            print(f"  deactivate")
            print(f"  rm -rf {os.environ.get('VIRTUAL_ENV')}")
            print(f"  python3 -m venv .venv")
            print(f"  source .venv/bin/activate")
            print(f"  python3 -m pip install -r python/requirements.txt")
        else:
            print("  Create a virtual environment with pip:")
            print("  python3 -m venv .venv")
            print("  source .venv/bin/activate")
            print("  python3 -m pip install -r python/requirements.txt")
        print("  Then run: npm start")
        return False

    # Build pip install command
    pip_cmd = [sys.executable, "-m", "pip", "install", "-r", requirements_file]

    # On macOS with externally-managed Python (Homebrew Python 3.14+),
    # we need to use --break-system-packages for application dependencies
    if platform.system() == "Darwin":  # macOS
        # On macOS with externally-managed Python (Homebrew Python 3.14+),
        # we need to use --break-system-packages for application dependencies
        # BUT: If we're in a virtual environment, we don't need this flag
        if platform.system() == "Darwin" and not os.environ.get(
            "VIRTUAL_ENV"
        ):  # macOS without venv
            try:
                # First try without flags
                subprocess.check_call(
                    pip_cmd, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL
                )
            except subprocess.CalledProcessError:
                # If it fails, try with --break-system-packages for Homebrew Python
                print("Using --break-system-packages flag for macOS Homebrew Python...")
                pip_cmd.append("--break-system-packages")
                try:
                    subprocess.check_call(pip_cmd)
                except subprocess.CalledProcessError as e:
                    print(f"✗ Failed to install dependencies: {e}")
                    print("\n💡 Alternative: Create a virtual environment:")
                    print("  python3 -m venv .venv")
                    print("  source .venv/bin/activate")
                    print("  python3 -m pip install -r python/requirements.txt")
                    print("  Then run: npm start")
                    return False
    else:
        # Windows/Linux OR macOS with virtual environment
        try:
            subprocess.check_call(pip_cmd)
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install dependencies: {e}")
            return False

    print("✓ Python dependencies installed successfully")
    return True


if __name__ == "__main__":
    success = install_requirements()
    sys.exit(0 if success else 1)

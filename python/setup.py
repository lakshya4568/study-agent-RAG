#!/usr/bin/env python3
"""
Setup script to install Python dependencies for NVIDIA embeddings service
"""
import subprocess
import sys
import os
import platform


def install_requirements():
    """Install Python requirements"""
    requirements_file = os.path.join(os.path.dirname(__file__), "requirements.txt")

    print("Installing Python dependencies for NVIDIA embeddings service...")

    # Build pip install command
    pip_cmd = [sys.executable, "-m", "pip", "install", "-r", requirements_file]

    # On macOS with externally-managed Python (Homebrew Python 3.14+),
    # we need to use --break-system-packages for application dependencies
    if platform.system() == "Darwin":  # macOS
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
                print("  python3 -m venv venv")
                print("  source venv/bin/activate")
                print("  python3 -m pip install -r python/requirements.txt")
                print("  Then run: npm start")
                return False
    else:
        # Windows/Linux
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

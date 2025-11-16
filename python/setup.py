#!/usr/bin/env python3
"""
Setup script to install Python dependencies for NVIDIA embeddings service
"""
import subprocess
import sys
import os


def install_requirements():
    """Install Python requirements"""
    requirements_file = os.path.join(os.path.dirname(__file__), "requirements.txt")

    print("Installing Python dependencies for NVIDIA embeddings service...")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", requirements_file]
        )
        print("✓ Python dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        return False


if __name__ == "__main__":
    success = install_requirements()
    sys.exit(0 if success else 1)

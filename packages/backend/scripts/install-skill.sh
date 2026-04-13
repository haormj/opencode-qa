#!/bin/bash
# OpenCode QA Skill Installer for Linux/macOS
# 此脚本由服务器动态生成，SERVER_URL 已被替换

set -e

SERVER_URL="{{SERVER_URL}}"

FORCE_YES=false

while getopts "y" opt; do
  case $opt in
    y) FORCE_YES=true ;;
    *) echo "Usage: $0 [-y] <skill-slug>"; exit 1 ;;
  esac
done
shift $((OPTIND-1))

SLUG="${1:-}"

if [ -z "$SLUG" ]; then
    echo "Error: Please provide skill slug"
    echo "Usage: curl -sSL <server>/api/public/scripts/install-skill.sh | bash -s -- [-y] <skill-slug>"
    exit 1
fi

INSTALL_DIR="$HOME/.opencode/skills/$SLUG"

echo "Installing skill: $SLUG"
echo "Server: $SERVER_URL"
echo "Target: $INSTALL_DIR"
echo ""

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    echo "Error: curl or wget is required"
    exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
    echo "Error: unzip is required"
    exit 1
fi

if [ -d "$INSTALL_DIR" ]; then
    if [ "$FORCE_YES" = true ]; then
        echo "Overwriting existing installation..."
        rm -rf "$INSTALL_DIR"
    else
        echo "Directory already exists: $INSTALL_DIR"
        read -p "Overwrite? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            exit 0
        fi
        rm -rf "$INSTALL_DIR"
    fi
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

ZIP_FILE="$TEMP_DIR/$SLUG.zip"
DOWNLOAD_URL="$SERVER_URL/api/public/skills/$SLUG/download"

echo "Downloading: $DOWNLOAD_URL"

if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSL "$DOWNLOAD_URL" -o "$ZIP_FILE"; then
        echo "Error: Download failed"
        exit 1
    fi
else
    if ! wget -q "$DOWNLOAD_URL" -O "$ZIP_FILE"; then
        echo "Error: Download failed"
        exit 1
    fi
fi

if [ ! -s "$ZIP_FILE" ]; then
    echo "Error: Downloaded file is empty"
    exit 1
fi

mkdir -p "$INSTALL_DIR"

if ! unzip -q "$ZIP_FILE" -d "$INSTALL_DIR"; then
    echo "Error: Failed to extract zip file"
    rm -rf "$INSTALL_DIR"
    exit 1
fi

echo ""
echo "============================================"
echo "Installation complete!"
echo "Skill installed to: $INSTALL_DIR"
echo "============================================"

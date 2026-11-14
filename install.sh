#!/usr/bin/env bash
# ProtoStage — Standalone Binary Installer
# Downloads and installs the pre-compiled proto CLI without needing source code or a Go compiler.
# Usage:
#   curl -fsSL https://protostage.github.io/protostage-gallery/install.sh | bash
set -eo pipefail

RELEASE_REPO="${PROTO_REPO:-ProtoStage/protostage-gallery}"
FALLBACK_REPO="ProtoStage/protostage"
DEFAULT_VERSION="0.1.0"
BIN_NAME="proto"
RC_MARKER="# added by protostage installer"

echo ""
echo "  ProtoStage Installer"
echo "  ===================="
echo ""

# 1. Preflight runtime check
if ! command -v python3 &>/dev/null; then
  echo "  ✗ python3 is required to run prototype dev servers."
  echo "    Please install Python 3 and ensure it is on your PATH."
  exit 1
fi

# 2. Detect OS
OS_RAW="$(uname -s)"
case "$OS_RAW" in
  Darwin*) OS="darwin" ;;
  Linux*)  OS="linux" ;;
  *)
    echo "  ✗ Unsupported operating system: $OS_RAW"
    echo "    ProtoStage currently supports macOS and Linux."
    exit 1
    ;;
esac

# 3. Detect Architecture
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  x86_64|amd64)   ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "  ✗ Unsupported architecture: $ARCH_RAW"
    exit 1
    ;;
esac

echo "  Target: ${OS}/${ARCH}"

# 4. Resolve Version
VERSION="${PROTO_VERSION:-$DEFAULT_VERSION}"
VERSION_TAG="v${VERSION#v}"

# 5. Determine Download URL
ARCHIVE_NAME="proto_${VERSION}_${OS}_${ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/${RELEASE_REPO}/releases/download/${VERSION_TAG}/${ARCHIVE_NAME}"
FALLBACK_URL="https://github.com/${FALLBACK_REPO}/releases/download/${VERSION_TAG}/${ARCHIVE_NAME}"

# 6. Determine writable install directory (zero sudo)
INSTALL_DIR=""
for candidate in "$HOME/.local/bin" "/opt/homebrew/bin" "/usr/local/bin"; do
  if [ -d "$candidate" ] && [ -w "$candidate" ]; then
    INSTALL_DIR="$candidate"
    break
  fi
done

if [ -z "$INSTALL_DIR" ]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

# 7. Download and extract binary
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'protostage')"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "  Downloading ${ARCHIVE_NAME}..."
FETCHED=false
if command -v curl >/dev/null 2>&1; then
  if curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/$ARCHIVE_NAME" 2>/dev/null; then
    FETCHED=true
  elif curl -fsSL --progress-bar "$FALLBACK_URL" -o "$TMP_DIR/$ARCHIVE_NAME" 2>/dev/null; then
    FETCHED=true
  fi
elif command -v wget >/dev/null 2>&1; then
  if wget -q --show-progress "$DOWNLOAD_URL" -O "$TMP_DIR/$ARCHIVE_NAME" 2>/dev/null; then
    FETCHED=true
  elif wget -q --show-progress "$FALLBACK_URL" -O "$TMP_DIR/$ARCHIVE_NAME" 2>/dev/null; then
    FETCHED=true
  fi
fi

if [ "$FETCHED" = false ]; then
  echo "  Notice: Could not fetch from GitHub Releases directly."
  echo "  Looking for local release bundle in current directory..."
  if [ -f "./dist/releases/$ARCHIVE_NAME" ]; then
    cp "./dist/releases/$ARCHIVE_NAME" "$TMP_DIR/$ARCHIVE_NAME"
    FETCHED=true
  elif [ -f "./$ARCHIVE_NAME" ]; then
    cp "./$ARCHIVE_NAME" "$TMP_DIR/$ARCHIVE_NAME"
    FETCHED=true
  else
    echo "  ✗ Failed to download release asset from $DOWNLOAD_URL or $FALLBACK_URL"
    exit 1
  fi
fi

tar -xzf "$TMP_DIR/$ARCHIVE_NAME" -C "$TMP_DIR"

EXTRACTED_BIN="$TMP_DIR/proto_${VERSION}_${OS}_${ARCH}/$BIN_NAME"
if [ ! -f "$EXTRACTED_BIN" ]; then
  # Try root extraction
  EXTRACTED_BIN="$TMP_DIR/$BIN_NAME"
fi

if [ ! -f "$EXTRACTED_BIN" ]; then
  echo "  ✗ Archive did not contain $BIN_NAME binary."
  exit 1
fi

TARGET="$INSTALL_DIR/$BIN_NAME"
cp -f "$EXTRACTED_BIN" "$TARGET"
chmod +x "$TARGET"

if [ "$OS" = "darwin" ]; then
  xattr -d com.apple.quarantine "$TARGET" 2>/dev/null || true
fi

# 8. Ensure PATH is configured
ON_PATH=false
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ON_PATH=true ;;
esac

PATH_HINT=""
if ! $ON_PATH; then
  SHELL_NAME="$(basename "${SHELL:-/bin/zsh}")"
  case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash) RC_FILE="$HOME/.bash_profile" ;;
    fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
    *)    RC_FILE="" ;;
  esac

  if [ -n "$RC_FILE" ]; then
    if [ ! -f "$RC_FILE" ] || ! grep -q "$RC_MARKER" "$RC_FILE"; then
      mkdir -p "$(dirname "$RC_FILE")"
      {
        echo ""
        echo "$RC_MARKER"
        if [ "$SHELL_NAME" = "fish" ]; then
          echo "set -gx PATH \"$INSTALL_DIR\" \$PATH"
        else
          echo "export PATH=\"$INSTALL_DIR:\$PATH\""
        fi
      } >> "$RC_FILE"
    fi
    PATH_HINT="Added $INSTALL_DIR to PATH in $RC_FILE.\n  (Open a new terminal or run 'source $RC_FILE')"
  else
    PATH_HINT="Add $INSTALL_DIR to your PATH manually, then run 'proto'."
  fi
fi

echo "  ✓ Installed $BIN_NAME to $TARGET"
if [ -n "$PATH_HINT" ]; then
  echo -e "  $PATH_HINT"
fi

# 9. Verify installation
echo ""
if command -v "$TARGET" >/dev/null 2>&1; then
  "$TARGET" --version
fi
echo ""
echo "  Run 'proto' anywhere to launch ProtoStage!"
echo ""

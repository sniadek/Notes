#!/bin/bash
# Fixes the macOS Gatekeeper "is damaged and can't be opened" error that shows up
# after downloading the .app (or the .dmg) as a GitHub Actions build artifact, or
# after copying it to another Mac. The app is only ad-hoc signed (no Apple
# Developer ID / notarization), so once macOS quarantines the file the ad-hoc
# signature is no longer trusted and Gatekeeper reports it as "damaged" instead
# of the usual "unidentified developer" warning.
#
# Usage:
#   ./scripts/install-macos-app.sh [/path/to/<AppName>.app]
#
# The app name is read from productName in app/src-tauri/tauri.conf.json, so a
# future rename doesn't break this script. With no argument, it looks for that
# app bundle in ~/Downloads and installs it into /Applications.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_CONF="$REPO_ROOT/app/src-tauri/tauri.conf.json"

if [ ! -f "$TAURI_CONF" ]; then
  echo "error: couldn't find $TAURI_CONF" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  APP_NAME="$(jq -r '.productName' "$TAURI_CONF")"
else
  APP_NAME="$(sed -n 's/.*"productName"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' "$TAURI_CONF" | head -n 1)"
fi

if [ -z "$APP_NAME" ] || [ "$APP_NAME" = "null" ]; then
  echo "error: couldn't read productName from $TAURI_CONF" >&2
  exit 1
fi

DEST_APP="/Applications/$APP_NAME.app"

if [ $# -ge 1 ]; then
  SRC_APP="$1"
else
  SRC_APP="$HOME/Downloads/$APP_NAME.app"
fi

if [ ! -d "$SRC_APP" ]; then
  echo "error: couldn't find an app bundle at $SRC_APP" >&2
  echo "usage: $0 [/path/to/$APP_NAME.app]" >&2
  exit 1
fi

if [ "$SRC_APP" != "$DEST_APP" ]; then
  echo "Installing $SRC_APP -> $DEST_APP"
  rm -rf "$DEST_APP"
  cp -R "$SRC_APP" "$DEST_APP"
fi

echo "Clearing quarantine attribute..."
xattr -cr "$DEST_APP"

echo "Re-applying ad-hoc code signature..."
codesign --force --deep --sign - "$DEST_APP"

echo "Done. $APP_NAME.app is installed at $DEST_APP and should open normally."

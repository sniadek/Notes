#!/bin/bash
# Fixes the macOS Gatekeeper "is damaged and can't be opened" error that shows up
# after downloading Notes.app (or the .dmg) as a GitHub Actions build artifact, or
# after copying it to another Mac. The app is only ad-hoc signed (no Apple
# Developer ID / notarization), so once macOS quarantines the file the ad-hoc
# signature is no longer trusted and Gatekeeper reports it as "damaged" instead
# of the usual "unidentified developer" warning.
#
# Usage:
#   ./scripts/install-macos-app.sh [/path/to/Notes.app]
#
# With no argument, it looks for Notes.app in ~/Downloads and installs it into
# /Applications.

set -euo pipefail

DEST_APP="/Applications/Notes.app"

if [ $# -ge 1 ]; then
  SRC_APP="$1"
else
  SRC_APP="$HOME/Downloads/Notes.app"
fi

if [ ! -d "$SRC_APP" ]; then
  echo "error: couldn't find an app bundle at $SRC_APP" >&2
  echo "usage: $0 [/path/to/Notes.app]" >&2
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

echo "Done. Notes.app is installed at $DEST_APP and should open normally."

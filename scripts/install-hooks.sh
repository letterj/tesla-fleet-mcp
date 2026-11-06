#!/usr/bin/env bash
# Install pre-commit and the secret-scanning hooks for this repo.
# Run this script after every clone. See docs/standards/secret-scanning.md.

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to install pre-commit." >&2
  exit 1
fi

if ! command -v pre-commit >/dev/null 2>&1; then
  python3 -m pip install --user pre-commit
  export PATH="${HOME}/.local/bin:${PATH}"
fi

if ! command -v pre-commit >/dev/null 2>&1; then
  echo "pre-commit is not on PATH after install. Add ${HOME}/.local/bin to PATH." >&2
  exit 1
fi

# pre-commit refuses to install when core.hooksPath is set.
# Save it, install into .git/hooks, then restore so other hooks still run.
saved_hooks_path=""
if saved_hooks_path="$(git config --get core.hooksPath)"; then
  git config --unset-all core.hooksPath
fi

pre-commit install

if [ -n "$saved_hooks_path" ]; then
  git config core.hooksPath "$saved_hooks_path"
fi

echo "Secret-scanning hooks are installed."
echo "Never commit with --no-verify."

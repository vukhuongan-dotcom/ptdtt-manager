#!/bin/bash
# Cài đặt bộ Git Hooks chuẩn của dự án ptdtt-manager vào .git/hooks/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_SRC="$REPO_ROOT/scripts/git-hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

chmod +x "$REPO_ROOT/scripts/register_bug_feat.py"
for hook in pre-commit commit-msg post-push; do
    cp "$HOOKS_SRC/$hook" "$HOOKS_DST/$hook"
    chmod +x "$HOOKS_DST/$hook"
done

echo "✅ Đã kích hoạt Git Hooks (pre-commit, commit-msg, post-push) tại $HOOKS_DST"

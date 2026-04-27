#!/usr/bin/env bash
# Canonical deployment check wrapper for the current VPS/PostgreSQL runtime contract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Running canonical VPS/PostgreSQL runtime audit..."
node "$REPO_ROOT/scripts/audit-vps-postgres.mjs"

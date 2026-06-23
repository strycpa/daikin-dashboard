#!/usr/bin/env bash
# Backwards-compatible wrapper — use scripts/setup-gcp.sh
exec "$(dirname "$0")/setup-gcp.sh" "$@"

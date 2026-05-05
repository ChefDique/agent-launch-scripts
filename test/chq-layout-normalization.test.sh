#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CHQ_TMUX_LIB_ONLY=1 source "${ROOT}/chq-tmux.sh"

actual="$(
  pane_ids_to_break_for_window_normalization <<'FIXTURE'
@1	%1
@1	%2
@1	%3
@2	%4
@3	%5
@3	%6
FIXTURE
)"

expected=$'%2\n%3\n%6'

if [[ "${actual}" != "${expected}" ]]; then
  printf 'expected pane ids:\n%s\n\nactual pane ids:\n%s\n' "${expected}" "${actual}" >&2
  exit 1
fi

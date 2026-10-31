#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
godot_bin=${GODOT_BIN:-godot}
check_dir=${CHRONICLE_CHECK_DIR:-/tmp/ashen-chronicle-check}
mkdir -p "$check_dir"
"$godot_bin" --headless --editor --path "$project_dir" --import > "$check_dir/import.log" 2>&1
if rg -n 'SCRIPT ERROR|^ERROR:' "$check_dir/import.log"; then exit 1; fi
for suite in run_tests art_checks scene_smoke visual_scene_checks playthrough; do
  if ! timeout 60s "$godot_bin" --headless --path "$project_dir" --script "tests/$suite.gd" > "$check_dir/$suite.log" 2>&1; then
    cat "$check_dir/$suite.log"
    exit 1
  fi
  if rg -n 'SCRIPT ERROR|^ERROR:' "$check_dir/$suite.log"; then exit 1; fi
  tail -5 "$check_dir/$suite.log"
done

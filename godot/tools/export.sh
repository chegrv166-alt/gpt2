#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
godot_bin=${GODOT_BIN:-godot}
mkdir -p "$project_dir/build/windows" "$project_dir/build/linux"
"$godot_bin" --headless --editor --path "$project_dir" --import
"$godot_bin" --headless --path "$project_dir" --export-release "Windows Desktop" "$project_dir/build/windows/Ashen-Covenant-Chronicle.exe"
"$godot_bin" --headless --path "$project_dir" --export-release "Linux Desktop" "$project_dir/build/linux/Ashen-Covenant-Chronicle.x86_64"

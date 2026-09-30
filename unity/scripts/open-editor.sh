#!/usr/bin/env bash
# Opens a Unity project in the editor and waits until the MCP bridge is connected.
#
# Usage: unity/scripts/open-editor.sh [project-dir]
#   project-dir defaults to the only Unity project under unity/.
#
# The editor owns the MCP server: it starts the server on load and stops it on quit.
# A freshly launched editor that never became the active app does not advance Play
# mode, so the script activates it once and then hands focus back.

set -euo pipefail

UNITY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly UNITY_ROOT
readonly MCP_PORT="${UNITY_MCP_HTTP_PORT:-8642}"
readonly BRIDGE_TIMEOUT_SECONDS=300
readonly POLL_INTERVAL_SECONDS=2
readonly ACTIVATION_SECONDS=2
readonly UNITY_CLI="${UNITY_CLI:-$HOME/.unity/bin/unity}"
readonly EDITOR_BUNDLE_ID="com.unity3d.UnityEditor5.x"

fail() {
  echo "error: $1" >&2
  exit 1
}

resolve_project_dir() {
  if [[ $# -gt 0 ]]; then
    (cd "$1" 2>/dev/null && pwd) || fail "project directory not found: $1"
    return
  fi

  local projects=()
  local version_file
  for version_file in "$UNITY_ROOT"/*/ProjectSettings/ProjectVersion.txt; do
    [[ -f "$version_file" ]] && projects+=("$(dirname "$(dirname "$version_file")")")
  done

  [[ ${#projects[@]} -eq 1 ]] || fail "expected one Unity project under $UNITY_ROOT, found ${#projects[@]}; pass the project directory"
  echo "${projects[0]}"
}

editor_version() {
  awk '/^m_EditorVersion:/ { print $2 }' "$1/ProjectSettings/ProjectVersion.txt"
}

editor_app_path() {
  echo "/Applications/Unity/Hub/Editor/$(editor_version "$1")/Unity.app"
}

# Reads process command lines on stdin; succeeds when a Unity editor has exactly this project open.
# The path must end the line or be followed by the next flag, so "Sandbox" does not match "Sandbox2".
matches_editor_for_project() {
  awk -v project_dir="$1" '
    BEGIN { needle = tolower("-projectpath " project_dir) }
    index($0, "Unity.app/Contents/MacOS/Unity ") == 0 { next }
    {
      line = tolower($0)
      start = index(line, needle)
      if (start == 0) next
      rest = substr(line, start + length(needle))
      if (rest == "" || substr(rest, 1, 2) == " -") found = 1
    }
    END { exit found ? 0 : 1 }'
}

is_editor_running() {
  ps -axo command= | matches_editor_for_project "$1"
}

is_bridge_connected() {
  UNITY_MCP_HTTP_PORT="$MCP_PORT" unity-mcp instance list 2>/dev/null | grep -qF -- "• $1@"
}

launch_editor() {
  local project_dir="$1"
  if [[ -x "$UNITY_CLI" ]]; then
    "$UNITY_CLI" open "$project_dir" --no-banner --non-interactive >/dev/null
    return
  fi

  local editor_app
  editor_app="$(editor_app_path "$project_dir")"
  [[ -d "$editor_app" ]] || fail "Unity editor not installed: $editor_app"
  open -na "$editor_app" --args -projectpath "$project_dir"
}

wait_for_bridge() {
  local project_name="$1"
  local waited=0
  until is_bridge_connected "$project_name"; do
    [[ $waited -lt $BRIDGE_TIMEOUT_SECONDS ]] || fail "MCP bridge did not connect within ${BRIDGE_TIMEOUT_SECONDS}s; check the Unity window for a dialog waiting for input"
    sleep "$POLL_INTERVAL_SECONDS"
    waited=$((waited + POLL_INTERVAL_SECONDS))
  done
}

frontmost_app() {
  osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true' 2>/dev/null || true
}

activate_editor_once() {
  local editor_app
  editor_app="$(editor_app_path "$1")"
  local previous_app="$2"

  open -a "$editor_app"
  sleep "$ACTIVATION_SECONDS"
  if [[ -n "$previous_app" && "$previous_app" != "$EDITOR_BUNDLE_ID" ]]; then
    open -b "$previous_app"
  fi
}

main() {
  command -v unity-mcp >/dev/null 2>&1 || fail "unity-mcp not found; install it with: uv tool install mcpforunityserver"

  local project_dir
  project_dir="$(resolve_project_dir "$@")"
  local project_name
  project_name="$(basename "$project_dir")"
  # Captured before launching: the launch itself brings the editor to the front.
  local previous_app
  previous_app="$(frontmost_app)"

  if is_editor_running "$project_dir"; then
    echo "editor already running for $project_name"
  else
    echo "opening $project_name (Unity $(editor_version "$project_dir"))"
    launch_editor "$project_dir"
  fi

  wait_for_bridge "$project_name"
  activate_editor_once "$project_dir" "$previous_app"
  echo "ready: $project_name is connected to the MCP server on port $MCP_PORT"
}

main "$@"

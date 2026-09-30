#!/usr/bin/env python3
"""
Runs Unity tests in the open editor through the MCP server and prints a summary.

    unity/scripts/run-tests.py [EditMode|PlayMode]

Refreshes assets first (so new scripts compile), waits for the run, lists every failure and exits non-zero
when a test fails.
"""
import json
import os
import subprocess
import sys
import time

POLL_SECONDS = 20
TIMEOUT_SECONDS = 1800


def mcp(*args):
    env = dict(os.environ, UNITY_MCP_HTTP_PORT=os.environ.get("UNITY_MCP_HTTP_PORT", "8642"))
    result = subprocess.run(["unity-mcp", "--format", "json", *args], capture_output=True, text=True, env=env)
    try:
        # Some commands print a progress line before the JSON document.
        payload = json.loads(result.stdout[result.stdout.index("{"):], strict=False)
    except (ValueError, json.JSONDecodeError):
        sys.exit(f"unity-mcp {' '.join(args)} failed:\n{result.stdout}{result.stderr}")
    data = payload.get("result", {})
    return data.get("data", data)


def wait_for_editor():
    for _ in range(120):
        result = subprocess.run(["unity-mcp", "instance", "list"], capture_output=True, text=True,
                                env=dict(os.environ, UNITY_MCP_HTTP_PORT=os.environ.get("UNITY_MCP_HTTP_PORT", "8642")))
        if "@" in result.stdout:
            return
        time.sleep(2)
    sys.exit("The editor is not connected; run unity/scripts/open-editor.sh")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "EditMode"
    wait_for_editor()
    mcp("editor", "refresh")
    wait_for_editor()
    errors = mcp("editor", "console", "--type", "error", "--count", "20")
    if isinstance(errors, list) and errors:
        print("Console errors before the run:")
        for entry in errors:
            print(" ", str(entry)[:400])

    job = mcp("editor", "tests", "--mode", mode).get("job_id")
    if not job:
        sys.exit("Could not start the test run")

    deadline = time.time() + TIMEOUT_SECONDS
    status = mcp("editor", "poll-test", job, "--wait", str(POLL_SECONDS), "--failed-only")
    while status.get("status") == "running" and time.time() < deadline:
        status = mcp("editor", "poll-test", job, "--wait", str(POLL_SECONDS), "--failed-only")

    progress = status.get("progress") or {}
    result = status.get("result") or {}
    summary = result.get("summary") or {}
    failures = progress.get("failures_so_far") or []
    total = summary.get("total", progress.get("total"))
    print(f"{mode}: {status.get('status')} — {total} tests, {summary.get('passed', '?')} passed, "
          f"{summary.get('failed', len(failures))} failed, {summary.get('skipped', 0)} skipped")
    for failure in failures:
        print(f"- {failure.get('full_name')}\n    {str(failure.get('message', '')).strip()[:1500]}")
    sys.exit(0 if status.get("status") == "succeeded" else 1)


if __name__ == "__main__":
    main()

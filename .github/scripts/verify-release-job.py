"""Verify the release job structure in .github/workflows/build.yml."""

import re
import sys
import yaml
from pathlib import Path


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


workflow_path = Path(__file__).resolve().parent.parent / "workflows" / "build.yml"
with open(workflow_path, encoding="utf-8") as f:
    wf = yaml.safe_load(f)

jobs = wf.get("jobs", {})

# --- 1. release job exists ---------------------------------------------------
if "release" not in jobs:
    fail("release job not found in workflow")
ok("1. release job exists")

release = jobs["release"]

# --- 2. needs: [validate, gdevelop-js-build, app-build, platform-build] -----
needs = release.get("needs", [])
expected_needs = {"validate", "gdevelop-js-build", "app-build", "platform-build"}
actual_needs = set(needs) if isinstance(needs, list) else set()
if actual_needs != expected_needs:
    fail(f"release.needs expected {sorted(expected_needs)}, got {sorted(actual_needs)}")
ok("2. needs: [validate, gdevelop-js-build, app-build, platform-build]")

# --- 3. permissions: has contents: write -------------------------------------
permissions = release.get("permissions", {})
if permissions.get("contents") != "write":
    fail(f"release.permissions.contents expected write, got {permissions.get('contents')}")
ok("3. permissions: contents: write")

# --- 4. download-artifact@v4 step with pattern: gdevelop-* -------------------
steps = release.get("steps", [])
download_steps = [s for s in steps
                  if s.get("uses", "").startswith("actions/download-artifact")]
download_with_pattern = [
    ds for ds in download_steps
    if ds.get("with", {}).get("pattern", "") == "gdevelop-*"
]
if not download_with_pattern:
    fail("No actions/download-artifact step found with pattern: gdevelop-*")
ok("4. actions/download-artifact@v4 step with pattern: gdevelop-*")

# --- 5. merge-multiple: true on download step --------------------------------
ds = download_with_pattern[0]
if ds.get("with", {}).get("merge-multiple") is not True:
    fail(f"download-artifact merge-multiple expected true, got {ds.get('with', {}).get('merge-multiple')}")
ok("5. merge-multiple: true on download-artifact step")

# --- 6. files: on softprops step with all 5 glob patterns ---------------------
softprops_steps = [s for s in steps
                   if s.get("uses", "").startswith("softprops/action-gh-release")]
if not softprops_steps:
    fail("No softprops/action-gh-release step found")
softprops = softprops_steps[0]
files = softprops.get("with", {}).get("files", "")
required_globs = {".AppImage", ".deb", ".dmg", ".exe", ".zip"}
found_globs = set()
for line in files.splitlines():
    line = line.strip()
    if line.startswith("*."):
        found_globs.add(line.replace("*", ""))
missing_globs = required_globs - found_globs
if missing_globs:
    fail(f"softprops files missing globs: {sorted(missing_globs)}. Found: {sorted(found_globs)}")
ok(f"6. files: present with all 5 glob patterns ({', '.join(sorted(required_globs))})")

# --- 7. Pre-release auto-generation uses timestamp+SHA format ----------------
info_steps = [s for s in steps if s.get("id") == "info"]
if not info_steps:
    fail("No step with id=info (tag/type determination)")
info_run = info_steps[0].get("run", "")
# Check for the timestamp+SHA tag format
if 'date -u +%Y%m%d%H%M%S' not in info_run:
    fail("info step missing timestamp generation (date -u +%Y%m%d%H%M%S)")
ok("7. Pre-release auto-generation uses timestamp format (date -u +%Y%m%d%H%M%S)")

if 'GITHUB_SHA:0:7' not in info_run:
    fail("info step missing SHA shortener (GITHUB_SHA:0:7)")
ok("7b. Pre-release tag includes short SHA (GITHUB_SHA:0:7)")

# Check the actual TAG= line format
tag_line_match = re.search(r'TAG="(v\$\{[^}]+\}-pre\.\$\{[^}]+\}\.\$\{[^}]+\})"', info_run)
if not tag_line_match:
    fail(f"info step TAG format does not match expected v${{VERSION}}-pre.${{TS}}.${{SHA}} pattern. Run content: {info_run[:200]}")
ok("7c. Pre-release TAG uses v{VERSION}-pre.{TS}.{SHA} format")

# --- 8. prerelease: true for master pushes -----------------------------------
if softprops.get("with", {}).get("prerelease") != "${{ steps.info.outputs.is_prerelease == 'true' }}":
    fail(f"softprops prerelease not wired to info.outputs.is_prerelease: {softprops.get('with', {}).get('prerelease')}")
ok("8. prerelease: info.outputs.is_prerelease == true (master pushes)")

# --- 9. draft: true only for tag pushes --------------------------------------
if softprops.get("with", {}).get("draft") != "${{ steps.info.outputs.is_prerelease != 'true' }}":
    fail(f"softprops draft not wired to inverse of is_prerelease: {softprops.get('with', {}).get('draft')}")
ok("9. draft: true only when is_prerelease != true (tag pushes)")

# --- 10. GITHUB_TOKEN not overridden -----------------------------------------
# softprops/action-gh-release uses GITHUB_TOKEN by default via the
# github.token input.  If the step sets token: or env: GH_TOKEN, that
# would override the default.
softprops_token = softprops.get("with", {}).get("token", "")
softprops_env = softprops.get("env", {})
if softprops_token:
    fail(f"softprops has explicit token override: {softprops_token}")
if "GH_TOKEN" in softprops_env or "GITHUB_TOKEN" in softprops_env:
    fail(f"softprops has env-level token override: {softprops_env}")
ok("10. GITHUB_TOKEN not overridden (uses default token)")

print()
print("=" * 50)
print("All release job structure checks passed.")
print("=" * 50)

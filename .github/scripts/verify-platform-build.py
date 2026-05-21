"""Verify the platform-build job structure in .github/workflows/build.yml."""

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

# --- platform-build job exists -------------------------------------------------
if "platform-build" not in jobs:
    fail("platform-build job not found in workflow")
ok("platform-build job exists")

pb = jobs["platform-build"]

# --- needs: [app-build] --------------------------------------------------------
if pb.get("needs") != ["app-build"]:
    fail(f"platform-build.needs expected [app-build], got {pb.get('needs')}")
ok("needs: [app-build]")

# --- continue-on-error: true ---------------------------------------------------
if pb.get("continue-on-error") is not True:
    fail(f"platform-build.continue-on-error expected true, got {pb.get('continue-on-error')}")
ok("continue-on-error: true")

# --- 5 matrix entries ----------------------------------------------------------
strategy = pb.get("strategy", {})
matrix = strategy.get("matrix", {})
entries = matrix.get("include", [])
if len(entries) != 5:
    fail(f"Expected 5 matrix entries, got {len(entries)}")

expected_names = {"linux-x64", "linux-arm64", "mac-universal", "win-x64", "win-arm64"}
actual_names = {e.get("name") for e in entries}
if actual_names != expected_names:
    fail(f"Matrix names mismatch. Expected {expected_names}, got {actual_names}")
ok("5 matrix entries with correct names")

# --- has upload-artifact step --------------------------------------------------
steps = pb.get("steps", [])
upload_steps = [s for s in steps if s.get("uses", "").startswith("actions/upload-artifact")]
if not upload_steps:
    fail("No upload-artifact step found")
# Verify artifact name uses matrix.name
upload_name = upload_steps[0].get("with", {}).get("name", "")
if "${{ matrix.name }}" not in upload_name:
    fail(f"upload-artifact name does not reference matrix.name: {upload_name}")
ok(f"upload-artifact step present (name={upload_name})")

# --- has both download-artifact steps ------------------------------------------
download_steps = [s for s in steps if s.get("uses", "").startswith("actions/download-artifact")]
download_names = [s.get("with", {}).get("name", "") for s in download_steps]
if "gdjs-build" not in download_names:
    fail("Missing download-artifact for gdjs-build")
if "app-build" not in download_names:
    fail("Missing download-artifact for app-build")
ok("Both download-artifact steps present (gdjs-build + app-build)")

# --- libfuse2 step with Linux-only condition -----------------------------------
libfuse_steps = [s for s in steps if "libfuse2" in str(s)]
if not libfuse_steps:
    fail("Missing libfuse2 install step")
libfuse = libfuse_steps[0]
condition = libfuse.get("if", "")
if "startsWith" not in condition or "ubuntu" not in condition:
    fail(f"libfuse2 step missing Linux-only condition: if={condition}")
ok("libfuse2 step present with Linux-only condition")

# --- --publish never in electron-builder step ----------------------------------
eb_steps = [s for s in steps if "electron-builder" in str(s.get("run", ""))]
if not eb_steps:
    fail("Missing electron-builder step")
eb_run = eb_steps[0].get("run", "")
if "--publish never" not in eb_run:
    fail(f"electron-builder step missing --publish never: {eb_run}")
ok("electron-builder step has --publish never")

# --- node-version references env.NODE_VERSION ----------------------------------
setup_node = [s for s in steps if s.get("uses", "").startswith("actions/setup-node")]
if setup_node:
    node_ver = setup_node[0].get("with", {}).get("node-version", "")
    if "${{ env.NODE_VERSION }}" not in node_ver:
        fail(f"setup-node node-version does not reference env.NODE_VERSION: {node_ver}")
    ok("setup-node uses env.NODE_VERSION")
else:
    fail("Missing setup-node step")

print()
print("=" * 50)
print("All platform-build structure checks passed.")
print("=" * 50)

#!/usr/bin/env python3
"""
Compiles project assemblies with Unity's own C# compiler, without the editor.

    unity/scripts/check-compile.py [project-dir]

Why: an editor that starts with compile errors stops at the "Enter Safe Mode?" dialog, and nothing can dismiss
it from a terminal. Run this before opening the editor after editing scripts.

It reuses the response files (.rsp) Unity wrote the last time it compiled each assembly — the exact references,
defines and flags — but swaps in the current source files. An assembly Unity never compiled borrows the
response file of a template assembly (see TEMPLATES).
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

EDITOR = "/Applications/Unity/Hub/Editor/6000.5.0f1/Unity.app/Contents/Resources/Scripting"
DOTNET = os.path.join(EDITOR, "DotNetSdk", "dotnet")
CSC = glob.glob(os.path.join(EDITOR, "DotNetSdk", "sdk", "*", "Roslyn", "bincore", "csc.dll"))

# New assemblies compile with the flags of an assembly that has the same kind of references.
TEMPLATES = {
    "runtime": "Assembly-CSharp",
    "editor": "Assembly-CSharp-Editor",
}


def find_asmdefs(project):
    """All project asmdefs under Assets, with the folder they own."""
    result = []
    for path in glob.glob(os.path.join(project, "Assets", "**", "*.asmdef"), recursive=True):
        with open(path, encoding="utf-8-sig") as handle:
            data = json.load(handle)
        result.append({"name": data["name"], "dir": os.path.dirname(path), "data": data})
    return result


def sources_for(asmdef, all_asmdefs):
    """The .cs files an asmdef owns: everything under its folder except folders owned by another asmdef."""
    owned_elsewhere = [a["dir"] for a in all_asmdefs if a["dir"] != asmdef["dir"] and a["dir"].startswith(asmdef["dir"] + os.sep)]
    files = []
    for path in glob.glob(os.path.join(asmdef["dir"], "**", "*.cs"), recursive=True):
        if any(path.startswith(other + os.sep) for other in owned_elsewhere):
            continue
        files.append(path)
    return sorted(files)


def latest_rsp(project, name):
    candidates = glob.glob(os.path.join(project, "Library", "Bee", "artifacts", "*.dag", f"{name}.rsp"))
    return max(candidates, key=os.path.getmtime) if candidates else None


def order_by_dependencies(asmdefs):
    by_name = {a["name"]: a for a in asmdefs}
    ordered, seen = [], set()

    def visit(asmdef):
        if asmdef["name"] in seen:
            return
        seen.add(asmdef["name"])
        for reference in asmdef["data"].get("references", []):
            if reference in by_name:
                visit(by_name[reference])
        ordered.append(asmdef)

    for asmdef in asmdefs:
        visit(asmdef)
    return ordered


def is_editor_only(asmdef):
    return asmdef["data"].get("includePlatforms") == ["Editor"]


def uses_nunit(asmdef):
    return "nunit.framework.dll" in asmdef["data"].get("precompiledReferences", [])


def template_candidates(asmdef, all_asmdefs):
    """Assemblies whose flags a new assembly can borrow, best match first."""
    if not is_editor_only(asmdef):
        return [TEMPLATES["runtime"]]
    # A test assembly needs NUnit and the test runner; another project test assembly has exactly those.
    siblings = [a["name"] for a in all_asmdefs if a["name"] != asmdef["name"] and is_editor_only(a)]
    tests = [name for name in siblings if uses_nunit(next(a for a in all_asmdefs if a["name"] == name))]
    others = [name for name in siblings if name not in tests]
    preferred = tests + others if uses_nunit(asmdef) else others + tests
    return [TEMPLATES["editor"]] + preferred if not uses_nunit(asmdef) else preferred + [TEMPLATES["editor"]]


def compile_assembly(project, asmdef, all_asmdefs, outputs, workdir):
    name = asmdef["name"]
    rsp = latest_rsp(project, name)
    template = None
    if rsp is None:
        for candidate in template_candidates(asmdef, all_asmdefs):
            rsp = latest_rsp(project, candidate)
            if rsp is not None:
                template = candidate
                break
    if rsp is None:
        return False, f"{name}: no response file to borrow (open the project in Unity once)"

    with open(rsp, encoding="utf-8") as handle:
        lines = [line.rstrip("\n") for line in handle]

    kept = []
    for line in lines:
        stripped = line.strip().strip('"')
        if stripped.endswith(".cs") or line.startswith("-out:") or line.startswith("-refout:"):
            continue
        if line.startswith("-r:") and "Library/Bee/artifacts" in line:
            referenced = os.path.splitext(os.path.basename(line[3:].strip('"')))[0].replace(".ref", "")
            if referenced in outputs:
                continue  # replaced by the freshly compiled assembly below
        kept.append(line)

    # A borrowed template does not reference our own assemblies; add every one this asmdef depends on.
    for reference in asmdef["data"].get("references", []):
        if reference in outputs:
            kept.append(f'-r:"{outputs[reference]}"')

    output = os.path.join(workdir, f"{name}.dll")
    kept.append(f'-out:"{output}"')
    kept.extend(f'"{source}"' for source in sources_for(asmdef, all_asmdefs))

    response = os.path.join(workdir, f"{name}.rsp")
    with open(response, "w", encoding="utf-8") as handle:
        handle.write("\n".join(kept) + "\n")

    result = subprocess.run([DOTNET, CSC[0], "-nologo", f"@{response}"], cwd=project, capture_output=True, text=True)
    outputs[name] = output
    messages = [line for line in (result.stdout + result.stderr).splitlines() if "error" in line or "warning CS" in line]
    errors = [line for line in messages if ": error " in line]
    label = f"{name}" + (f" (flags of {template})" if template else "")
    if result.returncode != 0 or errors:
        return False, label + "\n  " + "\n  ".join(errors or messages or [result.stdout[-2000:]])
    return True, label


def main():
    project = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "TrapTheOrb"))
    if not CSC:
        sys.exit("Unity's csc.dll was not found")
    asmdefs = [a for a in find_asmdefs(project) if "/Library/" not in a["dir"]]
    workdir = tempfile.mkdtemp(prefix="unity-check-compile-")
    outputs, failed = {}, False
    try:
        for asmdef in order_by_dependencies(asmdefs):
            ok, message = compile_assembly(project, asmdef, asmdefs, outputs, workdir)
            print(("ok     " if ok else "FAILED ") + message)
            failed = failed or not ok
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

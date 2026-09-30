# Unity games

Unity projects live in `unity/<Project>/`. They are separate from the pnpm workspace: nothing under `unity/` is linted, type-checked or sent to Docker.

| Project | Unity | Render pipeline | Notes |
| --- | --- | --- | --- |
| `Sandbox` | 6000.5.0f1 | URP 3D | Placeholder name from setup. Rename the folder and `productName` when the game has a name. |

## Toolchain

| Piece | Where | Purpose |
| --- | --- | --- |
| Unity Hub + Editor 6000.5.0f1 | `/Applications/Unity/Hub/Editor/` | Build modules installed: macOS (Mono), WebGL. |
| Unity CLI (`unity`, 1.0.0-beta.8) | `~/.unity/bin/unity` | Open projects, register them in the Hub, install editors and modules, build, test. |
| MCP for Unity 10.2.0 | `Packages/manifest.json`, pinned to `#v10.2.0` | Live control of the open editor. |
| `unity-mcp` CLI | `~/.local/bin/unity-mcp` (`uv tool install mcpforunityserver==10.2.0`) | The same commands from Bash. Reads `UNITY_MCP_HTTP_PORT`. |
| glTFast 6.20.0 | `Packages/manifest.json` | Imports `.glb` and `.gltf`. |
| Unity plugin for Claude Code | `.claude/settings.json` | Skills such as `ui-uitk`, `optimize-web`, `urp-postprocessing`. |

Keep the package, the `unity-mcp` CLI and the server on the same version.

## Working with the editor

Open the editor with the helper. It waits until the bridge is connected.

```sh
unity/scripts/open-editor.sh            # the only project under unity/
unity/scripts/open-editor.sh unity/Foo  # a specific project
```

The editor owns the MCP server. It starts `http://127.0.0.1:8642/mcp` on load and stops it on quit. The port is 8642 because a Docker container on this machine uses 8080. The port is stored in the editor preferences of this machine, so it is the same for every Unity project.

Claude Code is registered with `claude mcp add --scope local --transport http UnityMCP http://127.0.0.1:8642/mcp`. The tools are named `mcp__UnityMCP__*`. If the session started before the editor, run `/mcp` to reconnect.

- Only the `core` tool group is on by default. Turn on `testing`, `ui`, `animation`, `vfx` and the others with `manage_tools` when a task needs them.
- Edit C# with the normal file tools. Then refresh, wait for the compile, and read the console: `unity-mcp editor refresh`, then `unity-mcp editor console`.
- A script compile or entering Play mode reloads the domain. The bridge drops for a few seconds and reconnects. Wait for `unity-mcp instance list` to show the project again before the next command.
- Take screenshots into `Temp/`, without the inline image, and open the file: `unity-mcp raw manage_camera '{"action":"screenshot","output_folder":"Temp/MCPCaptures","include_image":false,...}'`.
- `manage_gameobject` with `prefab_path` creates an empty object for a model file. To place a model, run `PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(path))` with `unity-mcp code execute`.
- `code execute` blocks calls such as `AssetDatabase.DeleteAsset` and `EditorApplication.Exit`. Use the dedicated command instead, for example `unity-mcp asset delete`.

## Known traps

- **A dialog in the editor blocks everything.** The bridge never connects or a command never returns. The terminal has no screen or accessibility access, so check the main thread: `sample <pid> 1 | grep -E "runModal"`. Ask the user to answer the dialog, or restart the editor if nothing is unsaved.
- **A project created with `Unity -batchmode -createProject` opens with a "URP Material upgrade" dialog.** Batch mode leaves `m_LastMaterialVersion: 9` in `ProjectSettings/URPProjectSettings.asset`. A project created by the Hub has `m_LastMaterialVersion: 10` and `m_ProjectSettingFolderPath: URPDefaultResources`. Set both before the first open when the project has no materials yet. `unity projects new` is untested here, so check the file after using it.
- **A package that changes the Burst version while the editor is open** makes Burst ask for an editor restart. Add such packages while the editor is closed.
- **Play mode does not advance in a background editor** until the editor has been the active app once. The helper does this. `Run In Background` is on in the Player settings for the same reason.
- **Killing the editor leaves the MCP server running.** Stop it before the next start: `pkill -f mcp-for-unity`.
- **Unity sign-in expires** when the Hub is not opened for a few weeks. The editor then exits with "No valid Unity Editor license found". The user signs in to the Hub again. Check with `unity license`.

## 3D assets from Meshy

Meshy generation costs credits. State the cost and get the user's confirmation before every paid call.

1. Decide the format before generating, because `target_formats` is fixed at creation: `glb` for static props, `fbx` for rigged or animated characters.
2. Download straight into the project with an absolute `save_to`, for example `unity/<Project>/Assets/Art/Models/<AssetName>/<AssetName>.glb`. Without `save_to` the file lands in `meshy_output/`, which git ignores.
3. Refresh the editor and confirm the import: `unity-mcp asset info "Assets/Art/Models/<AssetName>/<AssetName>.glb"`.
4. Place it in a scene, take a screenshot and look at it.

Both importers are verified in this project. A `.glb` comes in through glTFast with the `Shader Graphs/glTF-pbrMetallicRoughness` shader. An `.fbx` comes in through the built-in importer with `Universal Render Pipeline/Lit`. Scale and orientation match between the two.

The Blender MCP server is also connected. It needs Blender open with its add-on running.

## Tests and builds

- Tests use the Unity Test Framework: `unity-mcp editor tests --mode EditMode`, then `unity-mcp editor poll-test <job-id> --wait 60`. A run is slower while the editor is in the background.
- Add build targets with `unity install-modules`. iOS and Android are not installed.

## Not installed on purpose

- `com.unity.pipeline`: experimental, and MCP for Unity already controls the editor. The `unity command` calls in the Unity plugin skills need it, so use the MCP for Unity equivalent.
- Unity's own MCP server in `com.unity.ai.assistant`: needs a Unity AI subscription and a manual approval of each new connection.
- A C# language server: Unity lists every source file in generated project files, so diagnostics for new files would be stale. The Unity console is the source of truth for compile errors.

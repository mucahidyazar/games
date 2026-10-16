# Unity games

Unity projects live in `unity/<Project>/`. They are separate from the pnpm workspace: nothing under `unity/` is linted, type-checked or sent to Docker.

| Project | Unity | Render pipeline | Notes |
| --- | --- | --- | --- |
| `TrapTheOrb` | 6000.5.0f1 | URP 3D | Product name "Trap The Orb". |

## Toolchain

| Piece | Where | Purpose |
| --- | --- | --- |
| Unity Hub + Editor 6000.5.0f1 | `/Applications/Unity/Hub/Editor/` | Build modules installed: macOS (Mono), WebGL, iOS, Android (with Unity's Android SDK, NDK and OpenJDK). |
| Unity CLI (`unity`, 1.0.0-beta.8) | `~/.unity/bin/unity` | Open projects, register them in the Hub, install editors and modules, build, test. |
| MCP for Unity 10.2.0 | `Packages/manifest.json`, pinned to `#v10.2.0` | Live control of the open editor. |
| `unity-mcp` CLI | `~/.local/bin/unity-mcp` (`uv tool install mcpforunityserver==10.2.0`) | The same commands from Bash. Reads `UNITY_MCP_HTTP_PORT`. |
| glTFast 6.20.0 | `Packages/manifest.json` | Imports `.glb` and `.gltf`. |
| Unity plugin for Claude Code | `.claude/settings.json` | Skills such as `ui-uitk`, `optimize-web`, `urp-postprocessing`. |
| `check-compile.py`, `run-tests.py` | `unity/scripts/` | Compile assemblies without the editor; run EditMode/PlayMode tests in the open editor through MCP. |

Keep the package, the `unity-mcp` CLI and the server on the same version.

## Working with the editor

Open the editor with the helper. It waits until the bridge is connected.

```sh
unity/scripts/open-editor.sh            # the only project under unity/
unity/scripts/open-editor.sh unity/Foo  # a specific project
```

The editor owns the MCP server. It starts `http://127.0.0.1:8642/mcp` on load and stops it on quit. The port is 8642 because a Docker container on this machine uses 8080. The port is stored in the editor preferences of this machine, so it is the same for every Unity project.

Claude Code is registered with `claude mcp add --scope local --transport http UnityMCP http://127.0.0.1:8642/mcp`. The tools are named `mcp__UnityMCP__*`. If the session started before the editor, run `/mcp` to reconnect. Local scope belongs to the folder, so register again after the repository moves.

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

## Trap The Orb's mobile UI

The UI is built in code with UI Toolkit (`Assets/_Project/App/UI`), designed for phones held upright; the product and design principles are in the repository's `PRODUCT.md`.

- `GameScreen` shows one of three screens: `HomeView` (the field's live preview behind the title, the mode and the play button), the play screen (`GameHud`, the field, the wall direction control) and `RunOverView`. One `BoardView` moves between the home and play screens.
- The HUD's main row (pause, progress, lives, level and score) fits a 360 dp phone. A countdown and a wall budget go in a second row, and more than three lives show as one heart and a count.
- Bottom sheets slide over them through `SheetLayer`: the game's own (pause, level cleared) and the ones the player opens (modes, Custom setup, settings, how to play, high scores).
- `ScreenRoutes` decides which screen, sheet and back-button action the game state calls for. It is plain logic with unit tests; keep decisions there rather than in the views. Android's back closes a sheet, pauses or resumes, leaves a finished run, and on the home screen sends the app to the background.
- Predictive back is off in the Player settings (`androidPredictiveBackSupport: 0`). With it on, Android sometimes ran its own back as well as the game's and finished the activity, which left a blank screen on the next start.
- Styles: `Tokens.uss` (colours of both themes), `Base.uss` (controls), `Game.uss` (screens), `Panels.uss` (sheets), `Dialogs.uss` (long sheet content). USS has no sibling selectors or `:last-child`, so gaps between children come from `Ui.Spaced` in code.
- Every control is at least 44pt tall, and frequent actions sit in the lower half of the screen.
- Reduced motion turns every transition into a jump: the scripted ones in `UiMotion` and the styles' own (the `app--reduced-motion` class). It is on when the in-game setting is, or when the system asks for it (iOS Reduce Motion, Android "Remove animations"), which then locks the setting.

## 3D assets from Meshy

Meshy generation costs credits. State the cost and get the user's confirmation before every paid call.

1. Decide the format before generating, because `target_formats` is fixed at creation: `glb` for static props, `fbx` for rigged or animated characters.
2. Download straight into the project with an absolute `save_to`, for example `unity/<Project>/Assets/Art/Models/<AssetName>/<AssetName>.glb`. Without `save_to` the file lands in `meshy_output/`, which git ignores.
3. Refresh the editor and confirm the import: `unity-mcp asset info "Assets/Art/Models/<AssetName>/<AssetName>.glb"`.
4. Place it in a scene, take a screenshot and look at it.

Both importers are verified in this project. A `.glb` comes in through glTFast with the `Shader Graphs/glTF-pbrMetallicRoughness` shader. An `.fbx` comes in through the built-in importer with `Universal Render Pipeline/Lit`. Scale and orientation match between the two.

The Blender MCP server is also connected. It needs Blender open with its add-on running.

## Tests and builds

Batch mode needs the project closed in the editor. Run it outside the Claude Code sandbox, which blocks the licensing client and `~/Library`, and use absolute paths. `Unity` below is `/Applications/Unity/Hub/Editor/6000.5.0f1/Unity.app/Contents/MacOS/Unity`.

- **Tests:** `Unity -batchmode -projectPath <project> -runTests -testPlatform EditMode -testResults <results.xml> -logFile <log>`. The log ends with `Test run completed. Exiting with code 0 (Ok)` or `code 2 (Failed)`, and the XML lists each failure. This is more reliable than a run through MCP, which can report "None tests". With the editor open, use `unity-mcp editor tests --mode EditMode`, then `unity-mcp editor poll-test <job-id> --wait 60`; a run is slower while the editor is in the background.
- **UI snapshots:** `TTO_SNAPSHOT_DIR=<folder> Unity -batchmode -projectPath <project> -runTests -testPlatform PlayMode -testCategory Snapshots -testResults <results.xml> -logFile <log>` renders every screen and sheet, in both themes, at iPhone 18 Pro, Pixel 8, iPhone SE and Galaxy S23 sizes into PNG files (`Tests/Snapshots/UiSnapshotTests.cs`). The Galaxy S23's 360 dp is the narrowest common Android width. It takes a few minutes, so check UI changes with it before a device build.
- **Player builds:** `Unity -batchmode -quit -projectPath <project> -buildTarget iOS -executeMethod TrapTheOrb.EditorTools.BuildScripts.IosSimulator -logFile <log>`. The other methods are `IosDevice` and `AndroidApk` (with `-buildTarget Android`). Output goes to `Builds/` in the project, and the log says `… build succeeded`.
- **iOS Simulator:** build `Builds/iOS-Simulator/Unity-iPhone.xcodeproj` (scheme `Unity-iPhone`) for the simulator, then install and launch the `.app` (bundle id `dev.mucahid.traptheorb`). The first Xcode build compiles all of IL2CPP's C++; later exports append to the Xcode project, so Xcode recompiles only what changed. Xcode 27's libc++ warns that it no longer supports the iOS 15 minimum.
- **Android emulator:** the AVD `TrapTheOrb_Pixel_8` (Pixel 8, Android 16, Google APIs, arm64, 2 GB of RAM to spare this Mac's memory) is in `~/.android/avd`; the emulator, platform-tools and system image are in `~/Library/Android/sdk`. The AVD was written by hand, because Unity's `avdmanager` only sees Unity's own SDK. Start it with `~/Library/Android/sdk/emulator/emulator -avd TrapTheOrb_Pixel_8 -no-boot-anim`, then run `adb install -r Builds/Android/TrapTheOrb.apk` and `adb shell am start -n dev.mucahid.traptheorb/com.unity3d.player.UnityPlayerGameActivity` (`adb` is in `~/Library/Android/sdk/platform-tools`).
- Unity sometimes crashes while quitting after a batch run (exit code 138, in `TcpMessagingSession`). The result line in the log is what counts.
- This Mac has 16 GB of memory. An IL2CPP build next to the emulator, a simulator and other heavy apps fills the swap and the compilers nearly stop: one Android build took 66 minutes. Close what you can while building.
- Add build targets with `unity install-modules`.

## Not installed on purpose

- `com.unity.pipeline`: experimental, and MCP for Unity already controls the editor. The `unity command` calls in the Unity plugin skills need it, so use the MCP for Unity equivalent.
- Unity's own MCP server in `com.unity.ai.assistant`: needs a Unity AI subscription and a manual approval of each new connection.
- A C# language server: Unity lists every source file in generated project files, so diagnostics for new files would be stale. The Unity console is the source of truth for compile errors.

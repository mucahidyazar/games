# Absurd Trolley Problems — Blender models

These scripts build every model in the game procedurally, so the art can be changed in code and rebuilt rather than edited by hand: the people (one body with every hairstyle and accessory, recoloured per actor in the game), the animals, the tram, the lever, the props on the tracks and the whole night set with its far skyline.

| File | Builds |
| --- | --- |
| `atp_layout.py` | The track geometry, actor slots and camera, shared with the game through `scene/layout.json` |
| `atp_characters.py` | The person rig, animals and arm poses (`scene/rig.json`) |
| `atp_props.py` | The tram, the lever, props, the sofa, crossing signals and the footbridge |
| `atp_env.py` | Ground, tracks, wall, trees, lamp, city and bridge, plus the scattered grass, flowers and pebbles |
| `atp_helpers.py` | Mesh building, toon materials and the glTF export |
| `atp_preview.py` | A preview render of the key frame (for checking the look in Blender) |
| `atp_export.py` / `build_all.py` | Builds everything and writes the files below |

## Rebuilding

Blender 5.1 or later, from the repository root:

```sh
blender -b -P apps/web/blender/absurd-trolley-problems/build_all.py
```

Or, with the Blender MCP add-on connected, import `atp_export` from this folder and call `atp_export.run()`. Either way it writes:

- `src/games/absurd-trolley-problems/assets/actors.glb` and `env.glb`
- `src/games/absurd-trolley-problems/scene/layout.json` and `rig.json`

The game swaps the exported PBR materials for toon ones by material name and finds parts by object name (`lever_arm`, `switch_rod`, `tram_light_L`, `hair_short`, `acc_phone`…), so keep those names when changing a model. Both tracks' rails start `SWITCH_RAILS` (2.6 m) past the junction: the game builds the switch's rails in that gap and bends them from one track to the other as the lever turns. `scene/assets.test.ts` loads the exported files and fails when a part the game uses is missing.

## Portal art

The portal's cover and icon (`public/games/absurd-trolley-problems/cover.png` and `icon.png`) are rendered from the game itself. With `pnpm dev` running:

```sh
node apps/web/scripts/capture-trolley-art.mjs
```

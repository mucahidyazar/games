"""Builds every asset and writes the game's GLB files and layout data.

Run through the Blender MCP add-on (import atp_export; atp_export.run()) or
headless: blender -b -P build_all.py
"""

import os

import bpy

import atp_characters
import atp_env
import atp_layout
import atp_props
from atp_helpers import export_glb, reset_scene


def _roots(coll_name):
    coll = bpy.data.collections[coll_name]
    return [obj for obj in coll.objects if obj.parent is None]


def run():
    reset_scene()
    cast = atp_characters.build()
    props = atp_props.build()
    env_roots, _camera = atp_env.build()

    # The previews spread the assets out; the game places them itself.
    for root in cast + props:
        root.location = (0.0, 0.0, 0.0)
        root.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    os.makedirs(atp_layout.ASSET_DIR, exist_ok=True)
    actors = os.path.join(atp_layout.ASSET_DIR, 'actors.glb')
    env = os.path.join(atp_layout.ASSET_DIR, 'env.glb')
    export_glb(actors, cast + props)
    export_glb(env, _roots('ATP_Env'), cameras=True)
    layout = atp_layout.write_layout()
    rig = atp_characters.write_rig()
    return {path: os.path.getsize(path) for path in (actors, env, layout, rig)}

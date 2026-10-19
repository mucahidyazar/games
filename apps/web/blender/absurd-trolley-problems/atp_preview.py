"""Stages the key frame in Blender (tram, lever, influencers, cat) to judge the
composition through the scene camera. Preview only: nothing here is exported.
"""

import math

import bpy

from atp_characters import RIG
from atp_helpers import collection
from atp_layout import ACTOR_SCALE, LEVER, TRAM_SCALE, TRAM_START, VICTIMS_A, VICTIMS_B, branch_track, incoming, main_track, point_at

TRAM_Z = 0.21
STAND_Z = 0.13


def clone(name, coll, keep=None, pose=None):
    """Copies an asset hierarchy, keeping only the named children (all when keep is None)."""
    source = bpy.data.objects[name]

    def copy(obj, parent):
        new = obj.copy()
        coll.objects.link(new)
        new.hide_set(False)
        new.parent = parent
        if parent is not None:
            new.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
        if pose and obj.name in ('arm_R', 'arm_L'):
            new.rotation_euler = [math.radians(a) for a in RIG[pose][obj.name[-1]]]
        for child in obj.children:
            if keep is None or child.name in keep:
                copy(child, new)
        return new

    return copy(source, None)


def place(obj, points, distance, z, face_camera=True, along=False):
    (x, y), heading = point_at(points, distance)
    obj.location = (x, y, z)
    if along:
        obj.rotation_euler = (0, 0, heading + math.pi / 2)
    elif face_camera:
        obj.rotation_euler = (0, 0, 0)


def stage():
    coll = collection('PREVIEW')
    for name in ('ATP_Cast', 'ATP_Props'):
        source = bpy.data.collections.get(name)
        if source:
            for obj in source.all_objects:
                obj.hide_set(True)

    tram = clone('tram', coll)
    front = TRAM_START
    (fx, fy), heading = point_at(incoming(), front)
    (rx, ry), _ = point_at(incoming(), front - 5.2 * TRAM_SCALE)
    tram.location = ((fx + rx) / 2, (fy + ry) / 2, TRAM_Z)
    tram.scale = (TRAM_SCALE,) * 3
    tram.rotation_euler = (0, 0, heading + math.pi / 2)

    lever = clone('lever', coll)
    lever.location = (LEVER[0], LEVER[1], 0)
    lever.rotation_euler = (0, 0, math.radians(15))
    arm = next(child for child in lever.children if child.name.startswith('lever_arm'))
    arm.rotation_euler = (0, math.radians(-30), 0)

    looks = [
        ('hair_short', 'acc_cap'),
        ('hair_long', 'acc_sunglasses'),
        ('hair_short', 'acc_cap', 'acc_sunglasses', 'acc_beard'),
        ('hair_bun',),
        ('hair_short', 'acc_beanie', 'acc_chain'),
    ]
    main = main_track()
    for index, extra in enumerate(looks):
        keep = {'person_body', 'arm_R', 'arm_L', 'acc_phone', *extra}
        person = clone('person', coll, keep, pose='phone')
        place(person, main, VICTIMS_A['start'] + index * VICTIMS_A['spacing'], STAND_Z)
        person.scale = (ACTOR_SCALE['person'],) * 3

    cat = clone('cat', coll)
    place(cat, branch_track(), VICTIMS_B['center'], STAND_Z)
    cat.scale = (ACTOR_SCALE['cat'],) * 3
    return coll


def camera_view():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_perspective = 'CAMERA'
                space.shading.type = 'SOLID'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
                with bpy.context.temp_override(window=window, area=area, region=[r for r in area.regions if r.type == 'WINDOW'][0]):
                    bpy.ops.view3d.view_center_camera()


def render_frame(path, width=1520, height=540):
    """Viewport render through the scene camera, for judging the framing."""
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                region = [r for r in area.regions if r.type == 'WINDOW'][0]
                with bpy.context.temp_override(window=window, area=area, region=region):
                    bpy.ops.render.opengl(write_still=True, view_context=True)
    return path


def _set_hidden(names, hidden):
    for obj in bpy.data.objects:
        if obj.name in names:
            obj.hide_set(hidden)


def render_composite(path, width=1520, height=540):
    """Renders the near set through camera_main over the backdrop seen by camera_far."""
    import numpy as np

    from atp_env import FAR_NAMES

    scene = bpy.context.scene
    view = None
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                view = area.spaces.active
    view.shading.background_type = 'VIEWPORT'
    view.shading.background_color = (0.012, 0.02, 0.05)

    near_names = [obj.name for obj in bpy.data.objects if obj.name not in FAR_NAMES and obj.type != 'CAMERA']
    visible_near = [obj.name for obj in bpy.data.objects if obj.name in near_names and obj.visible_get()]

    # Backdrop only.
    _set_hidden(visible_near, True)
    _set_hidden(FAR_NAMES, False)
    scene.camera = bpy.data.objects['camera_far']
    scene.render.film_transparent = False
    far_path = path.replace('.png', '_far.png')
    render_frame(far_path, width, height)

    # Near set, transparent where nothing is drawn.
    _set_hidden(FAR_NAMES, True)
    _set_hidden(visible_near, False)
    scene.camera = bpy.data.objects['camera_main']
    scene.render.film_transparent = True
    near_path = path.replace('.png', '_near.png')
    render_frame(near_path, width, height)
    scene.render.film_transparent = False

    far = bpy.data.images.load(far_path, check_existing=False)
    near = bpy.data.images.load(near_path, check_existing=False)
    a = np.array(far.pixels[:]).reshape(height, width, 4)
    b = np.array(near.pixels[:]).reshape(height, width, 4)
    alpha = b[..., 3:4]
    out = a * (1 - alpha) + b * alpha
    out[..., 3] = 1.0
    result = bpy.data.images.new('composite', width, height)
    result.pixels = out.ravel().tolist()
    result.filepath_raw = path
    result.file_format = 'PNG'
    result.save()
    for image in (far, near, result):
        bpy.data.images.remove(image)
    return path

"""Shared helpers for the Absurd Trolley Problems asset scripts.

Everything is modelled from primitives with bmesh, so the scripts run the
same through the Blender MCP add-on and headless (`blender -b -P build_all.py`).
Blender is Z-up and models face -Y; the glTF exporter turns that into
three.js' Y-up with the front facing +Z.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

TAU = math.tau


# ----------------------------------------------------------------- scene


def reset_scene():
    """Removes every object, mesh and material, keeping the scene itself."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def collection(name):
    """A top-level collection, created on first use and emptied on reuse."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    else:
        for obj in list(coll.all_objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    return coll


def empty(name, coll, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.2
    obj.location = location
    coll.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


# ------------------------------------------------------------- materials


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(value):
    value = value.lstrip('#')
    return tuple(srgb_to_linear(int(value[i : i + 2], 16) / 255) for i in (0, 2, 4))


def material(name, color, emission=None, strength=1.0, roughness=0.85, metallic=0.0):
    """A flat Principled material. Names matter: the game recolours by name."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    rgb = hex_rgb(color)
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*hex_rgb(emission), 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    else:
        bsdf.inputs['Emission Strength'].default_value = 0.0
    mat.diffuse_color = (*rgb, 1.0)  # viewport colour in Solid mode
    return mat


# ------------------------------------------------------------ primitives
# Each returns a free-standing bmesh; Builder.add() merges it into a mesh.


def _transform(bm, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    mat = (
        Matrix.Translation(Vector(location))
        @ Matrix.Rotation(rotation[2], 4, 'Z')
        @ Matrix.Rotation(rotation[1], 4, 'Y')
        @ Matrix.Rotation(rotation[0], 4, 'X')
        @ Matrix.Diagonal((*scale, 1.0))
    )
    bm.transform(mat)
    return bm


def box(size, location=(0, 0, 0), rotation=(0, 0, 0), bevel=0.0, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bevel = min(bevel, min(size) * 0.49)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, affect='EDGES', profile=0.5, clamp_overlap=True)
    return _transform(bm, location, rotation)


def quad(size, location=(0, 0, 0), rotation=(0, 0, 0)):
    """A single face of `size` (width, height) facing -Y: windows, signs."""
    bm = bmesh.new()
    w, h = size[0] / 2, size[1] / 2
    verts = [bm.verts.new((x, 0.0, z)) for x, z in ((-w, -h), (w, -h), (w, h), (-w, h))]
    bm.faces.new(verts)
    return _transform(bm, location, rotation)


def sphere(radius, location=(0, 0, 0), scale=(1, 1, 1), rotation=(0, 0, 0), segments=14, rings=9):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    return _transform(bm, location, rotation, scale)


def ico(radius, location=(0, 0, 0), scale=(1, 1, 1), subdivisions=1, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    return _transform(bm, location, rotation, scale)


def cylinder(radius, depth, location=(0, 0, 0), rotation=(0, 0, 0), segments=12, radius2=None, cap=True, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=cap,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=depth,
    )
    return _transform(bm, location, rotation, scale)


def cone(radius, depth, location=(0, 0, 0), rotation=(0, 0, 0), segments=12, scale=(1, 1, 1)):
    return cylinder(radius, depth, location, rotation, segments, radius2=0.0, scale=scale)


def torus(major, minor, location=(0, 0, 0), rotation=(0, 0, 0), major_segments=16, minor_segments=6, arc=TAU):
    """A torus (or part of one) built ring by ring, so a handle can be half a torus."""
    bm = bmesh.new()
    rings = []
    closed = abs(arc - TAU) < 1e-6
    count = major_segments if closed else major_segments + 1
    for i in range(count):
        a = arc * i / major_segments
        center = Vector((math.cos(a) * major, math.sin(a) * major, 0))
        outward = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(minor_segments):
            b = TAU * j / minor_segments
            ring.append(bm.verts.new(center + outward * math.cos(b) * minor + Vector((0, 0, math.sin(b) * minor))))
        rings.append(ring)
    pairs = len(rings) if closed else len(rings) - 1
    for i in range(pairs):
        r1, r2 = rings[i], rings[(i + 1) % len(rings)]
        for j in range(minor_segments):
            bm.faces.new((r1[j], r2[j], r2[(j + 1) % minor_segments], r1[(j + 1) % minor_segments]))
    return _transform(bm, location, rotation)


def prism(points, depth, location=(0, 0, 0), rotation=(0, 0, 0)):
    """Extrudes a 2D outline (in XZ, facing -Y) by `depth` along Y."""
    bm = bmesh.new()
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in points]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in points]
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    n = len(points)
    for i in range(n):
        bm.faces.new((front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _transform(bm, location, rotation)


def tube(path, radius, segments=8, cap=True):
    """A round tube along a list of points (a cane's hook, a tail)."""
    bm = bmesh.new()
    rings = []
    pts = [Vector(p) for p in path]
    for i, p in enumerate(pts):
        if i == 0:
            tangent = (pts[1] - pts[0]).normalized()
        elif i == len(pts) - 1:
            tangent = (pts[-1] - pts[-2]).normalized()
        else:
            tangent = (pts[i + 1] - pts[i - 1]).normalized()
        helper = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
        side = tangent.cross(helper).normalized()
        up = side.cross(tangent).normalized()
        r = radius(i / (len(pts) - 1)) if callable(radius) else radius
        rings.append([bm.verts.new(p + (side * math.cos(TAU * j / segments) + up * math.sin(TAU * j / segments)) * r) for j in range(segments)])
    for a, b in zip(rings, rings[1:]):
        for j in range(segments):
            bm.faces.new((a[j], a[(j + 1) % segments], b[(j + 1) % segments], b[j]))
    if cap:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cut_below(bm, plane_co, plane_no):
    """Deletes the part of a mesh on the negative side of a plane (no capping)."""
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(plane_co), plane_no=Vector(plane_no), clear_inner=True)
    return bm


# --------------------------------------------------------------- builder


class Builder:
    """Collects primitives (each with one material) into a single mesh object."""

    def __init__(self):
        self.bm = bmesh.new()
        self.materials = []

    def add(self, part, mat, smooth=True):
        if mat not in self.materials:
            self.materials.append(mat)
        index = self.materials.index(mat)
        for face in part.faces:
            face.material_index = index
            face.smooth = smooth
        tmp = bpy.data.meshes.new('_tmp')
        part.to_mesh(tmp)
        part.free()
        self.bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        return self

    def build(self, name, coll, location=(0, 0, 0), parent=None, sharp_angle=40):
        mesh = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        if sharp_angle is not None:
            mesh.set_sharp_from_angle(angle=math.radians(sharp_angle))
        obj = bpy.data.objects.new(name, mesh)
        coll.objects.link(obj)
        obj.location = location
        if parent is not None:
            obj.parent = parent
        return obj


def single(name, part, mat, coll, location=(0, 0, 0), parent=None, smooth=True, sharp_angle=40):
    return Builder().add(part, mat, smooth).build(name, coll, location, parent, sharp_angle)


def seeded(seed):
    return random.Random(seed)


# ---------------------------------------------------------------- export


def select_hierarchy(roots):
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        stack = [root]
        while stack:
            obj = stack.pop()
            obj.hide_set(False)
            obj.select_set(True)
            stack.extend(obj.children)


def export_glb(filepath, roots, cameras=False):
    """Exports the given root objects (and their children) to a binary glTF."""
    select_hierarchy(roots)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=cameras,
        export_lights=False,
        export_extras=True,
        export_materials='EXPORT',
        export_texcoords=False,
        export_normals=True,
        export_animations=False,
    )

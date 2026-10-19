"""The night-time set: tracks, stone wall, trees, city, bridge, lamp and fence.

Ground colour, grass tufts, pebbles and flowers are painted and scattered by
the game around the tracks; this script exports their source meshes.
"""

import math

import bmesh
import bpy
from mathutils import Vector

from atp_helpers import Builder, box, collection, cone, cylinder, empty, ico, material, quad, seeded, single, sphere
from atp_layout import GAUGE, HEADING, JUNCTION, LAMP, LEVER, SLEEPER_SPACING, SWITCH_RAILS, WALL_START, WALL_Y, branch_track, incoming, length_of, main_track, point_at


def env_mats():
    return {
        'ground': material('ground', '#2f4a43'),
        'ballast': material('ballast', '#4a5568'),
        'ballast_b': material('ballast_b', '#434d5f'),
        'sleeper': material('sleeper', '#6b4a33'),
        'rail': material('rail', '#c9d2dc', roughness=0.3, metallic=0.8),
        'rail_side': material('rail_side', '#5c6573', roughness=0.5, metallic=0.5),
        'stone_a': material('stone_a', '#5b6577'),
        'stone_b': material('stone_b', '#6b7487'),
        'stone_c': material('stone_c', '#4e5868'),
        'stone_cap': material('stone_cap', '#737d90'),
        'mortar': material('mortar', '#2b3140'),
        'trunk': material('trunk', '#3d2c25'),
        'foliage_a': material('foliage_a', '#1f4b45'),
        'foliage_b': material('foliage_b', '#2a5e52'),
        'foliage_c': material('foliage_c', '#183d3a'),
        'foliage_far': material('foliage_far', '#17293a'),
        'bush_a': material('bush_a', '#235243'),
        'bush_b': material('bush_b', '#2f6a4f'),
        'rock_a': material('rock_a', '#5d6675'),
        'rock_b': material('rock_b', '#4b5361'),
        'wood': material('wood', '#6b4a33'),
        'wood_dark': material('wood_dark', '#4a3324'),
        'lamp_pole': material('lamp_pole', '#2b303c', roughness=0.5, metallic=0.4),
        'lamp_glass': material('lamp_glass', '#ffd27a', emission='#ffc865', strength=4.0),
        'building_a': material('building_a', '#2e3d66'),
        'building_b': material('building_b', '#374874'),
        'building_c': material('building_c', '#27345c'),
        'building_roof': material('building_roof', '#1c2644'),
        'window_warm': material('window_warm', '#ffcf6b', emission='#ffc456', strength=2.2),
        'window_amber': material('window_amber', '#ff9f4a', emission='#ff9a3d', strength=2.0),
        'window_cool': material('window_cool', '#a7d8ff', emission='#9fd3ff', strength=1.6),
        'window_dark': material('window_dark', '#161e33'),
        'beacon': material('beacon', '#ff4d4d', emission='#ff3b3b', strength=3.0),
        'bridge_bg': material('bridge_bg', '#3b4b78'),
        'bridge_rail': material('bridge_rail', '#56689a'),
        'bridge_light': material('bridge_light', '#ffe08a', emission='#ffd36b', strength=3.0),
        'house': material('house', '#3a3f55'),
        'house_roof': material('house_roof', '#5a3940'),
        'switch_box': material('switch_box', '#7c8796', roughness=0.55, metallic=0.3),
        'grass_tuft': material('grass_tuft', '#4f8a4f'),
        'grass_tuft_b': material('grass_tuft_b', '#6aa45a'),
        'flower_yellow': material('flower_yellow', '#ffd34d', emission='#ffc93d', strength=0.6),
        'flower_orange': material('flower_orange', '#ff8a3d', emission='#ff7a2e', strength=0.6),
        'flower_pink': material('flower_pink', '#ff7aa8', emission='#ff6aa0', strength=0.5),
        'stem': material('stem', '#3f7a45'),
        'pebble': material('pebble', '#6a7384'),
    }


Z_BALLAST = 0.06
Z_SLEEPER = (0.05, 0.13)
Z_RAIL = (0.13, 0.23)


def heading_at(points, index):
    a = points[max(0, index - 1)]
    b = points[min(len(points) - 1, index + 1)]
    return math.atan2(b[1] - a[1], b[0] - a[0])


def ribbon(points, offsets, z_top, z_bottom=0.0, start=0.0):
    """Extrudes a cross-section (list of (offset, z) pairs, left to right) along a path."""
    bm = bmesh.new()
    rings = []
    walked = 0.0
    for index, (x, y) in enumerate(points):
        if index > 0:
            walked += math.dist(points[index - 1], (x, y))
        if walked < start:
            continue
        angle = heading_at(points, index)
        nx, ny = -math.sin(angle), math.cos(angle)
        rings.append([bm.verts.new((x + nx * off, y + ny * off, z)) for off, z in offsets])
    count = len(offsets)
    for a, b in zip(rings, rings[1:]):
        for j in range(count - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    if rings:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def rail_section(offset):
    w, foot = 0.035, 0.06
    z0, z1 = Z_RAIL
    return [(offset - foot, z0), (offset - w, z0 + 0.03), (offset - w, z1), (offset + w, z1), (offset + w, z0 + 0.03), (offset + foot, z0)]


def build_tracks(coll):
    m = env_mats()
    tracks = Builder()
    ballast = [(-1.05, 0.0), (-0.78, Z_BALLAST), (0.78, Z_BALLAST), (1.05, 0.0)]
    branch_ballast = [(-1.05, 0.0), (-0.78, Z_BALLAST - 0.008), (0.78, Z_BALLAST - 0.008), (1.05, 0.0)]
    paths = {'incoming': incoming(), 'main': main_track(), 'branch': branch_track()}
    tracks.add(ribbon(paths['incoming'], ballast, Z_BALLAST), m['ballast'], smooth=False)
    tracks.add(ribbon(paths['main'], ballast, Z_BALLAST), m['ballast'], smooth=False)
    tracks.add(ribbon(paths['branch'], branch_ballast, Z_BALLAST), m['ballast_b'], smooth=False)
    for name, points in paths.items():
        # The first metres past the junction are the switch: the game builds those rails and bends them with the lever.
        start = SWITCH_RAILS - 0.05 if name in ('main', 'branch') else 0.0
        for side in (-1, 1):
            tracks.add(ribbon(points, rail_section(side * GAUGE / 2), Z_RAIL[1], start=start), m['rail'], smooth=False)
    tracks.build('tracks', coll, sharp_angle=30)

    # Sleepers. Where the branch still overlaps the main line, the main line's sleepers carry both.
    sleepers = Builder()
    main = paths['main']
    for name, points in paths.items():
        total = length_of(points)
        distance = 0.2
        while distance < total - 0.1:
            (x, y), angle = point_at(points, distance)
            if name == 'branch':
                nearest = min(math.dist((x, y), p) for p in main[: len(main) // 2])
                if nearest < 1.25:
                    distance += SLEEPER_SPACING
                    continue
            sleepers.add(box((0.2, 1.32, Z_SLEEPER[1] - Z_SLEEPER[0]), (x, y, sum(Z_SLEEPER) / 2), rotation=(0, 0, angle)), m['sleeper'], smooth=False)
            distance += SLEEPER_SPACING
    sleepers.build('sleepers', coll, sharp_angle=None)

    # The switch machine by the junction and the rod from the lever, which slides when the lever turns.
    switch = Builder()
    jx, jy = JUNCTION
    bx, by = jx - 0.4, jy - 1.2
    switch.add(box((0.5, 0.36, 0.3), (bx, by, 0.15), rotation=(0, 0, HEADING), bevel=0.03), m['switch_box'])
    lx, ly = LEVER
    sx, sy = bx - 0.1, by - 0.12
    rod_angle = math.atan2(sy - ly, sx - lx)
    rod_len = math.dist((lx, ly), (sx, sy))
    for t in (0.25, 0.5, 0.75):
        switch.add(box((0.08, 0.14, 0.08), (lx + (sx - lx) * t, ly + (sy - ly) * t, 0.04), rotation=(0, 0, rod_angle)), m['sleeper'], smooth=False)
    switch.build('switch', coll)
    rod = Builder()
    rod.add(box((rod_len, 0.05, 0.05), ((lx + sx) / 2, (ly + sy) / 2, 0.09), rotation=(0, 0, rod_angle)), m['rail_side'], smooth=False)
    rod.build('switch_rod', coll)


def build_ground(coll):
    """Ends just behind the wall (the backdrop layer shows above it), except on
    the left where the tram comes in between the trees."""
    m = env_mats()
    ground = Builder()
    back = WALL_Y + 0.9
    for (x0, x1, y0, y1) in ((-34.0, 34.0, -28.0, back), (-34.0, WALL_START - 0.3, back, 18.0)):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
        bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, 1), verts=bm.verts)
        bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, 0.0), verts=bm.verts)
        ground.add(bm, m['ground'], smooth=False)
    ground.build('ground', coll, sharp_angle=None)


def wall_segment(wall, m, rng, start, end, height, depth):
    """Courses of stones along a straight line, on a dark mortar core."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    length = direction.length
    angle = math.atan2(direction.y, direction.x)
    unit = direction.normalized()

    def at(t, offset=0.0):
        p = start + unit * t
        return (p.x - unit.y * offset, p.y + unit.x * offset)

    cx, cy = at(length / 2)
    wall.add(box((length, depth - 0.08, height), (cx, cy, height / 2), rotation=(0, 0, angle)), m['mortar'], smooth=False)
    stones = (m['stone_a'], m['stone_b'], m['stone_c'])
    z = 0.0
    course = 0
    while z < height - 0.2:
        h = min(rng.uniform(0.3, 0.42), height - 0.2 - z)
        t = 0.0 if course % 2 == 0 else -0.3
        while t < length:
            w = min(rng.uniform(0.5, 0.95), length - t)
            begin = max(t, 0.0)
            width = t + w - begin
            if width > 0.12:
                x, y = at(begin + width / 2, rng.uniform(-0.03, 0.02))
                wall.add(box((width - 0.05, depth, h - 0.05), (x, y, z + h / 2), rotation=(0, 0, angle)), stones[rng.randrange(3)], smooth=False)
            t += w
        z += h
        course += 1
    t = 0.0
    while t < length:
        w = min(rng.uniform(0.7, 1.1), length - t)
        x, y = at(t + w / 2)
        wall.add(box((w - 0.04, depth + 0.12, 0.2), (x, y, height - 0.1), rotation=(0, 0, angle)), m['stone_cap'], smooth=False)
        t += w


def build_wall(coll):
    m = env_mats()
    rng = seeded(21)
    wall = Builder()
    height, depth = 2.1, 0.5
    wall_segment(wall, m, rng, (WALL_START, WALL_Y), (24.0, WALL_Y), height, depth)
    wall_segment(wall, m, rng, (WALL_START, WALL_Y + 3.2), (WALL_START, WALL_Y + 0.25), height, depth)
    wall.build('wall', coll, sharp_angle=None)


def tree(builder, m, rng, x, y, scale):
    builder.add(cylinder(0.14 * scale, 1.4 * scale, (x, y, 0.7 * scale), segments=7, radius2=0.1 * scale), m['trunk'], smooth=False)
    shades = (m['foliage_a'], m['foliage_b'], m['foliage_c'])
    blobs = [(0.0, 0.0, 2.0, 1.15), (-0.55, 0.15, 1.7, 0.8), (0.6, -0.1, 1.75, 0.85), (0.1, 0.25, 2.65, 0.8), (-0.2, -0.3, 2.4, 0.7)]
    for index, (dx, dy, dz, r) in enumerate(blobs):
        builder.add(
            ico(r * scale * rng.uniform(0.9, 1.1), (x + dx * scale, y + dy * scale, dz * scale), scale=(1.0, 1.0, 0.85), subdivisions=1, rotation=(rng.uniform(0, 1), rng.uniform(0, 1), rng.uniform(0, 3))),
            shades[(index + rng.randrange(3)) % 3],
            smooth=True,
        )


def build_trees(coll):
    m = env_mats()
    rng = seeded(5)
    trees = Builder()
    spots = [
        # Behind the left half of the wall.
        (-4.6, 3.6, 1.3), (-2.2, 4.4, 1.15), (-0.2, 3.5, 1.0), (-1.2, 6.2, 1.35),
        # Around the tram's tail, top left.
        (-10.4, 3.2, 1.35), (-12.8, 1.4, 1.25), (-8.6, 5.4, 1.4), (-14.4, 4.6, 1.3), (-6.6, 6.8, 1.2), (-16.4, -0.2, 1.1), (-11.6, 7.6, 1.3),
        # Far right, behind the lamp.
        (8.6, 3.6, 1.1), (11.8, 4.2, 1.25), (15.0, 3.4, 1.05),
        # Front left, framing the lever.
        (-13.4, -4.2, 1.15), (-15.0, -1.6, 1.25),
    ]
    for x, y, s in spots:
        tree(trees, m, rng, x, y, s)
    trees.build('trees', coll, sharp_angle=None)


    bushes = Builder()
    for x, y, r in ((-10.4, -2.6, 0.9), (-9.4, -4.6, 1.1), (-11.8, -6.2, 1.2), (-8.0, -7.0, 0.8), (-4.8, 0.95, 0.5), (0.6, 0.95, 0.45), (3.4, 0.95, 0.5), (8.2, 0.95, 0.55), (7.4, -6.4, 0.8), (9.6, -4.8, 0.9), (-12.6, -8.8, 1.3)):
        for k in range(3):
            bushes.add(ico(r * rng.uniform(0.6, 0.9), (x + rng.uniform(-0.5, 0.5) * r, y + rng.uniform(-0.3, 0.3) * r, r * 0.45), scale=(1.1, 1.0, 0.8), subdivisions=1, rotation=(rng.uniform(0, 1), 0, rng.uniform(0, 3))), m['bush_a'] if k % 2 == 0 else m['bush_b'], smooth=True)
    bushes.build('bushes', coll, sharp_angle=None)


def build_rocks(coll):
    m = env_mats()
    rng = seeded(9)
    rocks = Builder()
    for x, y, r in ((-8.4, -1.4, 0.5), (-4.4, -4.0, 0.36), (-2.4, -6.0, 0.55), (0.2, -1.5, 0.3), (5.6, -5.6, 0.42), (7.4, -2.0, 0.36), (-9.0, 1.8, 0.42), (2.2, 0.9, 0.28), (-7.2, -4.6, 0.3), (6.8, 0.8, 0.3)):
        rocks.add(ico(r, (x, y, r * 0.35), scale=(1.3, 1.0, 0.75), subdivisions=1, rotation=(rng.uniform(0, 1), rng.uniform(0, 1), rng.uniform(0, 3))), m['rock_a'] if rng.random() < 0.5 else m['rock_b'], smooth=False)
    rocks.build('rocks', coll, sharp_angle=None)


def build_fence(coll):
    m = env_mats()
    fence = Builder()
    start, end = Vector((3.9, -2.3)), Vector((8.6, -1.5))
    direction = (end - start)
    count = 6
    angle = math.atan2(direction.y, direction.x)
    for index in range(count + 1):
        p = start + direction * (index / count)
        fence.add(box((0.12, 0.12, 0.85), (p.x, p.y, 0.42), rotation=(0, 0, angle), bevel=0.02), m['wood_dark'])
    mid = (start + end) / 2
    for z in (0.38, 0.68):
        fence.add(box((direction.length + 0.2, 0.06, 0.1), (mid.x, mid.y, z), rotation=(0, 0, angle), bevel=0.015), m['wood'])
    fence.build('fence', coll)


def build_lamp(coll):
    m = env_mats()
    x, y = LAMP
    lamp = Builder()
    lamp.add(cylinder(0.16, 0.3, (x, y, 0.15), segments=8), m['lamp_pole'])
    lamp.add(cylinder(0.06, 3.1, (x, y, 1.75), segments=8), m['lamp_pole'])
    lamp.add(box((0.5, 0.06, 0.06), (x - 0.2, y, 3.1)), m['lamp_pole'])
    lamp.add(cylinder(0.16, 0.08, (x - 0.42, y, 3.02), segments=8, radius2=0.06), m['lamp_pole'])
    lamp.add(box((0.18, 0.18, 0.24), (x - 0.42, y, 2.86), bevel=0.02), m['lamp_glass'])
    lamp.build('lamp_post', coll)
    empty('lamp_light', coll, (x - 0.42, y, 2.8))


def windows_on(builder, m, rng, x0, x1, y, z0, z1, lit=0.35, face='front'):
    cols = max(1, int((x1 - x0) / 0.8))
    rows = max(1, int((z1 - z0) / 1.0))
    for row in range(rows):
        for col in range(cols):
            wx = x0 + (col + 0.5) * (x1 - x0) / cols
            wz = z0 + (row + 0.5) * (z1 - z0) / rows
            roll = rng.random()
            mat = m['window_dark']
            if roll < lit * 0.7:
                mat = m['window_warm']
            elif roll < lit * 0.85:
                mat = m['window_amber']
            elif roll < lit:
                mat = m['window_cool']
            if face == 'front':
                builder.add(quad((0.34, 0.46), (wx, y - 0.01, wz)), mat, smooth=False)
            else:
                builder.add(quad((0.34, 0.46), (y - 0.01, wx, wz), rotation=(0, 0, -math.pi / 2)), mat, smooth=False)


def build_far_trees(coll):
    m = env_mats()
    rng = seeded(17)
    far = Builder()
    for index in range(30):
        x = -30 + index * 2.2 + rng.uniform(-0.6, 0.6)
        y = FAR_Y['trees'] + rng.uniform(-0.8, 1.2)
        r = rng.uniform(1.3, 2.3)
        far.add(ico(r, (x, y, r * 0.6), scale=(1.2, 1.0, 1.0), subdivisions=1, rotation=(0, 0, rng.uniform(0, 3))), m['foliage_far'], smooth=True)
    far.build('far_trees', coll, sharp_angle=None)


def build_city(coll):
    m = env_mats()
    rng = seeded(13)
    city = Builder()
    bodies = (m['building_a'], m['building_b'], m['building_c'])
    x = -40.0
    while x < 46.0:
        w = rng.uniform(3.0, 6.5)
        d = rng.uniform(3.0, 5.0)
        h = rng.uniform(6.0, 16.0) if abs(x - 4) > 8 else rng.uniform(8.0, 18.0)
        y = FAR_Y['city'] + rng.uniform(0.0, 5.0)
        city.add(box((w, d, h), (x + w / 2, y + d / 2, h / 2)), bodies[rng.randrange(3)], smooth=False)
        city.add(box((w + 0.2, d + 0.2, 0.25), (x + w / 2, y + d / 2, h + 0.1)), m['building_roof'], smooth=False)
        windows_on(city, m, rng, x + 0.3, x + w - 0.3, y - 0.02, 0.8, h - 0.6, lit=0.52)
        if rng.random() < 0.35:
            city.add(cylinder(0.05, 1.6, (x + w * 0.7, y + d / 2, h + 0.9), segments=5), m['building_roof'], smooth=False)
            city.add(sphere(0.12, (x + w * 0.7, y + d / 2, h + 1.75), segments=6, rings=4), m['beacon'], smooth=False)
        elif rng.random() < 0.4:
            city.add(cylinder(0.5, 0.9, (x + w * 0.3, y + d / 2, h + 0.7), segments=8), m['building_roof'], smooth=False)
        x += w + rng.uniform(0.2, 1.4)
    # A second, taller and dimmer row behind.
    x = -44.0
    while x < 50.0:
        w = rng.uniform(4.0, 8.0)
        h = rng.uniform(12.0, 26.0)
        y = FAR_Y['city'] + 11.0
        city.add(box((w, 4.0, h), (x + w / 2, y + 2.0, h / 2)), m['building_c'], smooth=False)
        windows_on(city, m, rng, x + 0.4, x + w - 0.4, y - 0.02, 1.0, h - 1.0, lit=0.22)
        x += w + rng.uniform(0.5, 2.0)
    city.build('far_city', coll, sharp_angle=None)

    house = Builder()
    house.add(box((3.0, 2.6, 2.4), (-13.6, 6.4, 1.2)), m['house'], smooth=False)
    house.add(box((3.3, 2.9, 0.2), (-13.6, 6.4, 2.5)), m['house_roof'], smooth=False)
    house.add(box((0.6, 0.04, 0.7), (-12.7, 5.08, 1.4)), m['window_warm'], smooth=False)
    house.add(box((0.6, 0.04, 0.7), (-14.4, 5.08, 1.4)), m['window_amber'], smooth=False)
    house.build('house', coll, sharp_angle=None)


def build_bridge(coll):
    """A long viaduct on the skyline: arches, a railing and a row of warm lamps."""
    m = env_mats()
    bridge = Builder()
    y, deck = FAR_Y['bridge'], 3.4
    x0, x1 = -16.0, 34.0
    bridge.add(box((x1 - x0, 1.6, 0.5), ((x0 + x1) / 2, y, deck)), m['bridge_bg'], smooth=False)
    bridge.add(box((x1 - x0, 0.1, 0.12), ((x0 + x1) / 2, y - 0.78, deck + 0.75)), m['bridge_rail'], smooth=False)
    bridge.add(box((x1 - x0, 0.1, 0.08), ((x0 + x1) / 2, y - 0.78, deck + 0.42)), m['bridge_rail'], smooth=False)
    x = x0
    while x <= x1:
        bridge.add(box((0.6, 1.4, deck), (x, y, deck / 2)), m['bridge_bg'], smooth=False)
        for k in range(1, 4):
            bridge.add(box((0.07, 0.07, 0.75), (x + k * 0.95, y - 0.78, deck + 0.4)), m['bridge_rail'], smooth=False)
        # A lamp on every other pier.
        if round((x - x0) / 3.8) % 2 == 0:
            bridge.add(cylinder(0.05, 1.5, (x, y - 0.78, deck + 1.0), segments=5), m['bridge_rail'], smooth=False)
            bridge.add(box((0.36, 0.3, 0.3), (x, y - 0.78, deck + 1.82)), m['bridge_light'], smooth=False)
        x += 3.8
    bridge.build('far_bridge', coll, sharp_angle=None)


def build_scatter_sources(coll):
    """Single meshes the game scatters as instances."""
    m = env_mats()
    tuft = Builder()
    for index, (dx, dy, tilt) in enumerate(((0, 0, 0), (0.05, 0.02, 0.4), (-0.05, -0.01, -0.4), (0.02, -0.04, 0.2), (-0.02, 0.04, -0.2))):
        tuft.add(cone(0.035, 0.24 if index == 0 else 0.18, (dx, dy, 0.1), rotation=(0, tilt, index), segments=3), m['grass_tuft'] if index % 2 == 0 else m['grass_tuft_b'], smooth=False)
    tuft.build('scatter_tuft', coll, sharp_angle=None)

    for name in ('flower_yellow', 'flower_orange', 'flower_pink'):
        flower = Builder()
        flower.add(cylinder(0.01, 0.16, (0, 0, 0.08), segments=4), m['stem'], smooth=False)
        flower.add(ico(0.045, (0, 0, 0.17), subdivisions=1), m[name], smooth=False)
        flower.build(f'scatter_{name}', coll, sharp_angle=None)

    single('scatter_pebble', ico(0.08, (0, 0, 0.02), scale=(1.3, 1.0, 0.5), subdivisions=1), m['pebble'], coll, smooth=False, sharp_angle=None)


def make_camera(coll, name, location, target, fov=20.0):
    data = bpy.data.cameras.new(name)
    data.lens_unit = 'FOV'
    data.sensor_fit = 'VERTICAL'
    data.angle_y = math.radians(fov)
    data.clip_start = 0.5
    data.clip_end = 160.0
    cam = bpy.data.objects.new(name, data)
    coll.objects.link(cam)
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return cam


def build_camera(coll):
    target = Vector((JUNCTION[0] + 0.75, -1.1, 0.95))
    elevation = math.radians(24.0)
    distance = 17.4
    main = make_camera(coll, 'camera_main', target + Vector((0.0, -math.cos(elevation), math.sin(elevation))) * distance, target)
    far_eye = Vector((target.x, -16.0, 1.6))
    make_camera(coll, 'camera_far', far_eye, far_eye + Vector((0.0, 30.0, 2.4)))
    bpy.context.scene.camera = main
    bpy.context.scene.render.resolution_x = 1520
    bpy.context.scene.render.resolution_y = 540
    return main


FAR_Y = {'trees': 14.0, 'bridge': 17.0, 'city': 28.0}
FAR_NAMES = ('far_bridge', 'far_city')


def build(coll_name='ATP_Env'):
    coll = collection(coll_name)
    build_ground(coll)
    build_tracks(coll)
    build_wall(coll)
    build_trees(coll)
    build_rocks(coll)
    build_fence(coll)
    build_lamp(coll)
    build_city(coll)
    build_bridge(coll)
    build_scatter_sources(coll)
    cam = build_camera(coll)
    return [obj for obj in coll.objects if obj.parent is None], cam

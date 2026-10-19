"""The tram, the lever, the things on the tracks and a few scene props.

Every root faces -Y (towards the camera), like the cast. The tram's front is
-Y too; the game turns it along the track.
"""

import math

from atp_helpers import Builder, box, collection, cone, cylinder, empty, ico, material, seeded, single, sphere, torus, tube


def prop_mats():
    return {
        'tram_blue': material('tram_blue', '#2f56b0', roughness=0.6),
        'tram_dark': material('tram_dark', '#23346b', roughness=0.7),
        'tram_cream': material('tram_cream', '#efe6cf', roughness=0.7),
        'tram_roof': material('tram_roof', '#b8c0cc', roughness=0.7),
        'tram_under': material('tram_under', '#23262e'),
        'tram_wheel': material('tram_wheel', '#3b3f4a', roughness=0.5, metallic=0.4),
        'tram_window': material('tram_window', '#ffd27a', emission='#ffc865', strength=2.4),
        'tram_cab': material('tram_cab', '#fff1cf', emission='#ffe9b8', strength=1.6),
        'tram_headlight': material('tram_headlight', '#fff6d6', emission='#fff3c4', strength=5.0),
        'tram_sign': material('tram_sign', '#ffb347', emission='#ff9f2e', strength=2.2),
        'tram_panto': material('tram_panto', '#3b3f4a', roughness=0.5, metallic=0.4),
        'driver': material('driver', '#3a4a6e'),
        'driver_skin': material('driver_skin', '#e0ad86'),
        'lever_base': material('lever_base', '#7c8796', roughness=0.55, metallic=0.3),
        'lever_dark': material('lever_dark', '#2b2f3a'),
        'lever_stick': material('lever_stick', '#c5ccd6', roughness=0.35, metallic=0.6),
        'lever_knob': material('lever_knob', '#e8433f', roughness=0.35),
        'steel': material('steel', '#b9c3cf', roughness=0.35, metallic=0.7),
        'server_body': material('server_body', '#2b2f3a', roughness=0.6),
        'server_panel': material('server_panel', '#1d2028'),
        'led_a': material('led_a', '#5cff9d', emission='#5cff9d', strength=2.5),
        'led_b': material('led_b', '#59c7ff', emission='#59c7ff', strength=2.5),
        'ai_screen': material('ai_screen', '#7fe8ff', emission='#5fdcff', strength=2.0),
        'ai_face': material('ai_face', '#11303d'),
        'cookie': material('cookie', '#d69a52'),
        'cookie_edge': material('cookie_edge', '#b97a3a'),
        'choc': material('choc', '#4a2c1d'),
        'porcelain': material('porcelain', '#f4f1ea', roughness=0.4),
        'tulip': material('tulip', '#d9473f'),
        'tea': material('tea', '#b2361e', roughness=0.3),
        'phone_body': material('phone_body', '#1f2430', roughness=0.4),
        'phone_screen': material('phone_screen', '#7fd8ff', emission='#7fd8ff', strength=1.6),
        'app_a': material('app_a', '#ff7aa2', emission='#ff7aa2', strength=1.4),
        'app_b': material('app_b', '#ffd34d', emission='#ffd34d', strength=1.4),
        'app_c': material('app_c', '#7fe3b8', emission='#7fe3b8', strength=1.4),
        'terracotta': material('terracotta', '#c8643b'),
        'soil': material('soil', '#4a3222'),
        'leaf': material('leaf', '#3f9a4f'),
        'leaf_dark': material('leaf_dark', '#2c7a3c'),
        'cherry': material('cherry', '#d43a3a', roughness=0.4),
        'sofa': material('sofa', '#3a8f8a'),
        'sofa_cushion': material('sofa_cushion', '#4fb3ad'),
        'wood_dark': material('wood_dark', '#5a3d27'),
        'pole': material('pole', '#2b2f3a', roughness=0.5, metallic=0.3),
        'signal_box': material('signal_box', '#1f2228'),
        'lamp_red_on': material('lamp_red_on', '#ff4a4a', emission='#ff3b3b', strength=3.0),
        'lamp_red_off': material('lamp_red_off', '#4a1f22'),
        'lamp_green_on': material('lamp_green_on', '#4aff8a', emission='#3bff7d', strength=3.0),
        'lamp_green_off': material('lamp_green_off', '#1c3a2a'),
        'bridge_metal': material('bridge_metal', '#55607a', roughness=0.5, metallic=0.3),
        'bridge_deck': material('bridge_deck', '#7a6a5a'),
    }


# ------------------------------------------------------------------- tram


def build_tram(coll):
    m = prop_mats()
    root = empty('tram', coll)
    body = Builder()
    length, width = 5.2, 1.52
    half = length / 2

    # Running gear.
    for y in (-1.55, 1.55):
        body.add(box((1.2, 1.35, 0.34), (0, y, 0.3), bevel=0.04), m['tram_under'])
        for dy in (-0.42, 0.42):
            for x in (-0.6, 0.6):
                body.add(cylinder(0.2, 0.1, (x, y + dy, 0.22), rotation=(0, math.pi / 2, 0), segments=12), m['tram_wheel'])
    body.add(box((1.46, length - 0.2, 0.22), (0, 0, 0.5), bevel=0.04), m['tram_dark'])

    # Body: blue skirt, cream window band, blue cornice, grey roof.
    body.add(box((width, length, 0.62), (0, 0, 0.92), bevel=0.07, segments=3), m['tram_blue'])
    body.add(box((width - 0.02, length - 0.06, 0.66), (0, 0, 1.55), bevel=0.05), m['tram_cream'])
    body.add(box((width - 0.04, length - 0.12, 0.3), (0, 0, 2.0), bevel=0.09, segments=3), m['tram_blue'])
    body.add(box((width - 0.24, length - 0.6, 0.16), (0, 0, 2.2), bevel=0.06), m['tram_roof'])
    body.add(box((width + 0.01, length - 0.3, 0.05), (0, 0, 1.2), bevel=0.01), m['tram_cream'])

    # Side windows, warm and lit, with a door on each side.
    window_y = [-1.7, -1.0, -0.3, 0.4, 1.1, 1.8]
    for side in (-1, 1):
        x = side * (width / 2 + 0.002)
        for index, y in enumerate(window_y):
            if index == 2:
                body.add(box((0.03, 0.62, 1.2), (x, y, 1.15), bevel=0.01), m['tram_dark'])
                body.add(box((0.035, 0.22, 0.5), (x, y - 0.15, 1.5)), m['tram_window'])
                body.add(box((0.035, 0.22, 0.5), (x, y + 0.15, 1.5)), m['tram_window'])
                continue
            body.add(box((0.03, 0.56, 0.46), (x, y, 1.56), bevel=0.012), m['tram_window'])

    # The front: lit cab, the driver's silhouette, headlights, route sign, bumper.
    front = -half - 0.003
    body.add(box((1.22, 0.03, 0.56), (0, front, 1.58), bevel=0.02), m['tram_cab'])
    body.add(sphere(1.0, (0.18, front - 0.02, 1.52), scale=(0.15, 0.02, 0.16), segments=10, rings=7), m['driver_skin'])
    body.add(box((0.42, 0.02, 0.22), (0.18, front - 0.02, 1.36), bevel=0.04), m['driver'])
    body.add(box((0.32, 0.02, 0.07), (0.18, front - 0.025, 1.67), bevel=0.02), m['driver'])
    body.add(box((0.72, 0.03, 0.17), (0, front, 2.0), bevel=0.02), m['tram_sign'])
    for side in (-1, 1):
        body.add(cylinder(0.12, 0.06, (side * 0.5, front - 0.01, 0.86), rotation=(math.pi / 2, 0, 0), segments=14), m['tram_headlight'])
        body.add(cylinder(0.15, 0.04, (side * 0.5, front + 0.02, 0.86), rotation=(math.pi / 2, 0, 0), segments=14), m['tram_under'])
    body.add(box((1.36, 0.14, 0.16), (0, front - 0.05, 0.56), bevel=0.04), m['tram_under'])
    body.add(box((1.52, 0.03, 0.05), (0, front - 0.004, 1.2), bevel=0.01), m['tram_cream'])

    # Pantograph: a folding diamond on the roof.
    body.add(box((0.5, 0.5, 0.06), (0, -0.4, 2.31)), m['tram_panto'])
    panto = tube([(-0.32, -0.62, 2.33), (0.0, -0.4, 2.8), (0.32, -0.62, 2.33)], 0.018, segments=5)
    body.add(panto, m['tram_panto'])
    panto = tube([(-0.32, -0.18, 2.33), (0.0, -0.4, 2.8), (0.32, -0.18, 2.33)], 0.018, segments=5)
    body.add(panto, m['tram_panto'])
    body.add(box((0.95, 0.06, 0.04), (0, -0.4, 2.82)), m['tram_panto'])
    body.build('tram_body', coll, parent=root)

    for side, name in ((-1, 'tram_light_R'), (1, 'tram_light_L')):
        empty(name, coll, (side * 0.5, front - 0.05, 0.86), parent=root)
    return root


# ------------------------------------------------------------------ lever


def build_lever(coll):
    m = prop_mats()
    root = empty('lever', coll)
    base = Builder()
    base.add(box((0.56, 0.4, 0.22), (0, 0, 0.11), bevel=0.04), m['lever_base'])
    base.add(box((0.4, 0.13, 0.05), (0, 0, 0.235), bevel=0.01), m['lever_dark'])
    for x in (-0.22, 0.22):
        for y in (-0.14, 0.14):
            base.add(sphere(0.025, (x, y, 0.225), segments=8, rings=5), m['steel'])
    base.add(box((0.2, 0.2, 0.08), (0.36, 0, 0.06), bevel=0.02), m['lever_base'])
    base.build('lever_base', coll, parent=root)

    arm = Builder()
    arm.add(cylinder(0.075, 0.07, (0, 0, 0.0), rotation=(math.pi / 2, 0, 0), segments=12), m['lever_dark'])
    arm.add(cylinder(0.034, 0.72, (0, 0, 0.36), segments=10), m['lever_stick'])
    arm.add(sphere(0.115, (0, 0, 0.76), segments=14, rings=10), m['lever_knob'])
    lever_arm = arm.build('lever_arm', coll, location=(0, 0, 0.25), parent=root)
    lever_arm.rotation_mode = 'XYZ'
    return root


# ---------------------------------------------------------- track actors


def build_server(coll):
    m = prop_mats()
    root = empty('prop_server', coll)
    rack = Builder()
    rack.add(box((0.64, 0.54, 1.3), (0, 0, 0.65), bevel=0.04), m['server_body'])
    rack.add(box((0.52, 0.02, 0.62), (0, -0.27, 0.42)), m['server_panel'])
    rack.add(box((0.48, 0.02, 0.26), (0, -0.275, 1.04), bevel=0.01), m['ai_screen'])
    for x in (-0.09, 0.09):
        rack.add(box((0.05, 0.012, 0.07), (x, -0.287, 1.07)), m['ai_face'])
    for x in (-0.06, -0.02, 0.02, 0.06):
        rack.add(box((0.04, 0.012, 0.018), (x, -0.287, 0.985 - (0.012 if abs(x) < 0.04 else 0))), m['ai_face'])
    rack.add(box((0.6, 0.5, 0.05), (0, 0, 1.33)), m['server_panel'])
    rack.build('server_rack', coll, parent=root)

    leds = Builder()
    rng = seeded(7)
    for row in range(8):
        z = 0.16 + row * 0.07
        for col in range(5):
            if rng.random() < 0.7:
                leds.add(box((0.035, 0.012, 0.022), (-0.18 + col * 0.09, -0.284, z)), m['led_a'] if rng.random() < 0.6 else m['led_b'])
    leds.build('server_leds', coll, parent=root)
    return root


def build_cookie(coll):
    m = prop_mats()
    root = empty('prop_cookie', coll)
    cookie = Builder()
    cookie.add(cylinder(0.58, 0.15, (0, 0, 0.6), rotation=(math.pi / 2, 0, 0), segments=22), m['cookie'])
    cookie.add(torus(0.58, 0.07, (0, 0, 0.6), rotation=(math.pi / 2, 0, 0), major_segments=22, minor_segments=6), m['cookie_edge'])
    rng = seeded(3)
    for face in (-1, 1):
        for _ in range(9):
            angle = rng.uniform(0, math.tau)
            radius = rng.uniform(0.08, 0.46)
            cookie.add(ico(rng.uniform(0.05, 0.075), (math.cos(angle) * radius, face * 0.075, 0.6 + math.sin(angle) * radius), scale=(1, 0.5, 1)), m['choc'], smooth=False)
    cookie.build('cookie', coll, parent=root, sharp_angle=60)
    root.rotation_euler = (0.0, 0.0, 0.0)
    return root


def build_teapot(coll):
    m = prop_mats()
    root = empty('prop_teapot', coll)
    pot = Builder()
    # Bottom: the big steel kettle.
    pot.add(cylinder(0.34, 0.46, (0, 0, 0.25), segments=18, radius2=0.29), m['steel'])
    pot.add(cylinder(0.3, 0.04, (0, 0, 0.5), segments=18), m['steel'])
    pot.add(tube([(0.3, 0, 0.18), (0.45, 0, 0.3), (0.56, 0, 0.42)], lambda t: 0.06 - 0.025 * t, segments=8), m['steel'])
    pot.add(torus(0.14, 0.025, (-0.33, 0, 0.3), rotation=(math.pi / 2, 0, math.pi / 2), arc=math.pi, minor_segments=6), m['steel'])
    # Top: the porcelain teapot with its tulip band, brewing.
    pot.add(cylinder(0.2, 0.3, (0, 0, 0.67), segments=16, radius2=0.17), m['porcelain'])
    pot.add(cylinder(0.205, 0.05, (0, 0, 0.64), segments=16), m['tulip'])
    pot.add(cylinder(0.12, 0.05, (0, 0, 0.84), segments=14), m['porcelain'])
    pot.add(sphere(0.045, (0, 0, 0.89)), m['tulip'])
    pot.add(tube([(0.17, 0, 0.62), (0.27, 0, 0.7), (0.33, 0, 0.8)], lambda t: 0.04 - 0.015 * t, segments=8), m['porcelain'])
    pot.add(torus(0.1, 0.022, (-0.2, 0, 0.68), rotation=(math.pi / 2, 0, math.pi / 2), arc=math.pi, minor_segments=6), m['porcelain'])
    pot.build('teapot', coll, parent=root)
    return root


def build_big_phone(coll):
    m = prop_mats()
    root = empty('prop_phone', coll)
    phone = Builder()
    phone.add(box((0.66, 0.09, 1.24), (0, 0, 0.66), bevel=0.09, segments=3), m['phone_body'])
    phone.add(box((0.56, 0.02, 1.06), (0, -0.046, 0.67), bevel=0.03), m['phone_screen'])
    phone.add(box((0.16, 0.02, 0.035), (0, -0.05, 1.18), bevel=0.012), m['phone_body'])
    apps = (m['app_a'], m['app_b'], m['app_c'])
    for row in range(4):
        for col in range(3):
            phone.add(box((0.11, 0.012, 0.11), (-0.16 + col * 0.16, -0.06, 0.98 - row * 0.17), bevel=0.02), apps[(row + col) % 3])
    phone.add(box((0.5, 0.36, 0.06), (0, 0.16, 0.03), rotation=(0.0, 0, 0)), m['phone_body'])
    phone.add(box((0.08, 0.06, 0.6), (0, 0.18, 0.32), rotation=(-0.45, 0, 0)), m['phone_body'])
    phone.build('big_phone', coll, parent=root)
    return root


def build_coffee_plant(coll):
    m = prop_mats()
    root = empty('prop_coffeePlant', coll)
    plant = Builder()
    plant.add(cylinder(0.25, 0.34, (0, 0, 0.17), segments=16, radius2=0.19), m['terracotta'])
    plant.add(cylinder(0.275, 0.07, (0, 0, 0.32), segments=16), m['terracotta'])
    plant.add(cylinder(0.24, 0.02, (0, 0, 0.35), segments=16), m['soil'])
    plant.add(cylinder(0.025, 0.4, (0, 0, 0.55), segments=6), m['wood_dark'])
    rng = seeded(11)
    for index in range(9):
        angle = index * 2.4
        height = 0.55 + (index % 4) * 0.13
        radius = 0.1 + rng.uniform(0.0, 0.12)
        plant.add(ico(rng.uniform(0.13, 0.18), (math.cos(angle) * radius, math.sin(angle) * radius, height), scale=(1.2, 1.2, 0.8)), m['leaf'] if index % 2 else m['leaf_dark'], smooth=False)
    for index in range(12):
        angle = index * 1.9
        plant.add(sphere(0.035, (math.cos(angle) * 0.24, math.sin(angle) * 0.24 - 0.04, 0.55 + (index % 5) * 0.09), segments=8, rings=6), m['cherry'])
    plant.build('coffee_plant', coll, parent=root, sharp_angle=50)
    return root


# ---------------------------------------------------------- scene props


def build_sofa(coll):
    m = prop_mats()
    root = empty('sofa', coll)
    sofa = Builder()
    sofa.add(box((1.4, 0.72, 0.3), (0, 0, 0.27), bevel=0.06), m['sofa'])
    sofa.add(box((1.4, 0.24, 0.56), (0, 0.27, 0.64), bevel=0.08), m['sofa'])
    for side in (-1, 1):
        sofa.add(box((0.2, 0.74, 0.48), (side * 0.72, 0, 0.42), bevel=0.07), m['sofa'])
        sofa.add(box((0.6, 0.56, 0.12), (side * 0.31, -0.05, 0.47), bevel=0.05), m['sofa_cushion'])
        sofa.add(box((0.06, 0.06, 0.12), (side * 0.66, -0.3, 0.06)), m['wood_dark'])
        sofa.add(box((0.06, 0.06, 0.12), (side * 0.66, 0.3, 0.06)), m['wood_dark'])
    sofa.add(box((0.34, 0.12, 0.3), (-0.3, 0.12, 0.66), rotation=(0.25, 0, 0.15), bevel=0.06), m['tulip'])
    sofa.build('sofa_body', coll, parent=root)
    return root


def build_signal(coll, name, stop):
    m = prop_mats()
    root = empty(name, coll)
    signal = Builder()
    signal.add(cylinder(0.045, 1.6, (0, 0, 0.8), segments=10), m['pole'])
    signal.add(box((0.28, 0.22, 0.54), (0, 0, 1.82), bevel=0.03), m['signal_box'])
    signal.add(box((0.2, 0.03, 0.2), (0, -0.115, 1.95), bevel=0.02), m['lamp_red_on'] if stop else m['lamp_red_off'])
    signal.add(box((0.2, 0.03, 0.2), (0, -0.115, 1.69), bevel=0.02), m['lamp_green_off'] if stop else m['lamp_green_on'])
    signal.add(box((0.3, 0.06, 0.03), (0, -0.1, 2.08)), m['signal_box'])
    signal.add(box((0.3, 0.06, 0.03), (0, -0.1, 1.82)), m['signal_box'])
    signal.build(f'{name}_body', coll, parent=root)
    return root


def build_footbridge(coll):
    """Spans 3.6 m across a track (along X here); the deck is 2.7 m up."""
    m = prop_mats()
    root = empty('footbridge', coll)
    bridge = Builder()
    deck_z = 2.75
    bridge.add(box((3.8, 1.3, 0.18), (0, 0, deck_z), bevel=0.03), m['bridge_deck'])
    for side in (-1, 1):
        bridge.add(box((0.2, 0.2, deck_z), (side * 1.8, -0.5, deck_z / 2)), m['bridge_metal'])
        bridge.add(box((0.2, 0.2, deck_z), (side * 1.8, 0.5, deck_z / 2)), m['bridge_metal'])
        bridge.add(box((3.8, 0.05, 0.06), (0, side * 0.62, deck_z + 0.62)), m['bridge_metal'])
        bridge.add(box((3.8, 0.04, 0.04), (0, side * 0.62, deck_z + 0.32)), m['bridge_metal'])
        for index in range(9):
            bridge.add(box((0.04, 0.04, 0.62), (-1.8 + index * 0.45, side * 0.62, deck_z + 0.31)), m['bridge_metal'])
    bridge.add(box((3.8, 0.1, 0.22), (0, -0.62, deck_z - 0.15)), m['bridge_metal'])
    bridge.build('footbridge_body', coll, parent=root)
    return root


def build(coll_name='ATP_Props'):
    coll = collection(coll_name)
    roots = [
        build_tram(coll),
        build_lever(coll),
        build_server(coll),
        build_cookie(coll),
        build_teapot(coll),
        build_big_phone(coll),
        build_coffee_plant(coll),
        build_sofa(coll),
        build_signal(coll, 'signal_stop', True),
        build_signal(coll, 'signal_walk', False),
        build_footbridge(coll),
    ]
    x = 0.0
    for root in roots:
        root.location = (x, 4.0, 0)
        x += 6.0 if root.name in ('tram', 'footbridge') else 1.8
    return roots

"""People (one body, many hairstyles and accessories) and animals.

The game shows one hairstyle and a few accessories per person, recolours the
`skin`, `top`, `bottom`, `shoes`, `hair` and `hat` materials, and poses the
arms with the rotations in RIG (Blender XYZ Euler, degrees). Hand-held
accessories are modelled with the arm in its pose, then parented to it.
"""

import json
import math
import os

import bpy
from mathutils import Euler, Matrix, Vector

from atp_helpers import Builder, box, collection, cone, cut_below, cylinder, empty, material, single, sphere, torus, tube
from atp_layout import GAME_DIR

RIG_JSON = os.path.join(GAME_DIR, 'scene', 'rig.json')

HEAD = (0.0, 0.0, 0.885)
HEAD_R = (0.215, 0.195, 0.205)
SHOULDER = {'R': (-0.205, 0.0, 0.62), 'L': (0.205, 0.0, 0.62)}

RIG = {
    'stand': {'R': (0, 5, 0), 'L': (0, -5, 0)},
    'phone': {'R': (-160, -25, 0), 'L': (0, -5, 0)},
    'cheer': {'R': (0, 150, 0), 'L': (0, -150, 0)},
    'hold': {'R': (-75, 5, 0), 'L': (0, -5, 0)},
    'shoulder': {'R': (-20, 155, 0), 'L': (0, -5, 0)},
}


def mats():
    return {
        'skin': material('skin', '#f0c39c'),
        'top': material('top', '#3a6fd8'),
        'bottom': material('bottom', '#4f6fa8'),
        'shoes': material('shoes', '#f4f4f2'),
        'hair': material('hair', '#4a2f1d'),
        'hat': material('hat', '#e0475a'),
        'eye': material('eye', '#17161d', roughness=0.4),
        'mouth': material('mouth', '#8a3f3f'),
        'tophat': material('tophat', '#1e1f26'),
        'hatband': material('hatband', '#b53a3a'),
        'partyhat': material('partyhat', '#ff5fa2'),
        'pompom': material('pompom', '#ffd34d'),
        'fedora': material('fedora', '#6b4a2e'),
        'fedora_band': material('fedora_band', '#2a2b33'),
        'shades': material('shades', '#101217', roughness=0.3),
        'frames': material('frames', '#262833'),
        'headphones': material('headphones', '#23252d'),
        'headphones_cup': material('headphones_cup', '#e05a5a'),
        'antenna': material('antenna', '#86d96b'),
        'antenna_tip': material('antenna_tip', '#f6ff8a', emission='#f6ff8a', strength=2.0),
        'alien_eye': material('alien_eye', '#0d0d12', roughness=0.25),
        'gold': material('gold', '#f2c94c', roughness=0.35, metallic=0.6),
        'tie': material('tie', '#d9473f'),
        'backpack': material('backpack', '#f08a3c'),
        'strap': material('strap', '#3b3f4a'),
        'phone_body': material('phone_body', '#1f2430', roughness=0.4),
        'phone_screen': material('phone_screen', '#7fd8ff', emission='#7fd8ff', strength=1.6),
        'mug': material('mug', '#f4f1ea'),
        'coffee': material('coffee', '#5a3a22'),
        'boombox': material('boombox', '#3b3f4a'),
        'speaker': material('speaker', '#16181d'),
        'display': material('display', '#7fe3b8', emission='#7fe3b8', strength=1.5),
        'cane': material('cane', '#7a5434'),
        'book': material('book', '#3a6fd8'),
        'pages': material('pages', '#f4f1ea'),
        'sack': material('sack', '#cfae73'),
        'sack_tie': material('sack_tie', '#8b6a3a'),
        'money': material('money', '#2f8f4e'),
    }


def at_head(location):
    return (HEAD[0] + location[0], HEAD[1] + location[1], HEAD[2] + location[2])


def hair_shell():
    shell = sphere(1.0, at_head((0, 0.012, 0.02)), scale=(0.232, 0.214, 0.222), segments=18, rings=12)
    cut_below(shell, at_head((0, 0, -0.10)), (0, 0, 1))
    cut_below(shell, at_head((0, -0.06, 0.0)), (0, 0.5, 0.866))
    return shell


def pose_arm(arm, pose):
    arm.rotation_euler = [math.radians(a) for a in RIG[pose]['R' if arm.name.endswith('_R') else 'L']]
    bpy.context.view_layer.update()


def attach_posed(obj, arm, pose):
    """Parents an accessory modelled in world space to an arm held in `pose`."""
    saved = tuple(arm.rotation_euler)
    pose_arm(arm, pose)
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    arm.rotation_euler = saved
    bpy.context.view_layer.update()


def hand_world(side, pose):
    """Where the hand ends up in a pose (the arm is 0.265 m to the palm)."""
    euler = Euler([math.radians(a) for a in RIG[pose][side]], 'XYZ')
    offset = Vector((0.0, -0.005, -0.265))
    offset.rotate(euler)
    return Vector(SHOULDER[side]) + offset


def build_person(coll):
    m = mats()
    root = empty('person', coll)

    body = Builder()
    for side in (-1, 1):
        body.add(box((0.13, 0.2, 0.075), (side * 0.078, -0.025, 0.0375), bevel=0.03), m['shoes'])
        body.add(box((0.12, 0.13, 0.27), (side * 0.075, 0.0, 0.2), bevel=0.035), m['bottom'])
        body.add(sphere(0.045, at_head((side * 0.205, 0.01, -0.01)), scale=(0.6, 1, 1)), m['skin'])
        body.add(sphere(1.0, at_head((side * 0.074, -0.183, -0.007)), scale=(0.028, 0.018, 0.042), segments=8, rings=6), m['eye'])
    body.add(box((0.3, 0.2, 0.08), (0, 0, 0.33), bevel=0.03), m['bottom'])
    body.add(box((0.34, 0.235, 0.36), (0, 0, 0.49), bevel=0.075, segments=3), m['top'])
    body.add(sphere(1.0, HEAD, scale=HEAD_R, segments=18, rings=12), m['skin'])
    body.add(box((0.05, 0.014, 0.014), at_head((0, -0.178, -0.085))), m['mouth'])
    body.build('person_body', coll, parent=root)

    arms = {}
    for side, (x, y, z) in SHOULDER.items():
        arm = Builder()
        arm.add(box((0.1, 0.115, 0.26), (0, 0, -0.115), bevel=0.04), m['top'])
        arm.add(sphere(0.056, (0, -0.005, -0.265)), m['skin'])
        arms[side] = arm.build(f'arm_{side}', coll, location=(x, y, z), parent=root)
        arms[side].rotation_mode = 'XYZ'

    # ------------------------------------------------------------ hair
    single('hair_short', hair_shell(), m['hair'], coll, parent=root)

    long_hair = Builder().add(hair_shell(), m['hair'])
    long_hair.add(box((0.38, 0.11, 0.34), at_head((0, 0.135, -0.14)), bevel=0.05), m['hair'])
    for side in (-1, 1):
        long_hair.add(box((0.07, 0.11, 0.27), at_head((side * 0.197, 0.03, -0.1)), bevel=0.03), m['hair'])
    long_hair.build('hair_long', coll, parent=root)

    Builder().add(hair_shell(), m['hair']).add(sphere(0.085, at_head((0, 0.07, 0.235))), m['hair']).build('hair_bun', coll, parent=root)

    spiky = Builder().add(hair_shell(), m['hair'])
    for angle, tilt in ((-0.9, 0.5), (-0.3, 0.35), (0.3, 0.35), (0.9, 0.5), (0.0, 0.15), (0.0, 0.8)):
        x = math.sin(angle) * 0.13
        y = 0.04 + tilt * 0.08
        spiky.add(cone(0.06, 0.17, at_head((x, y - 0.04, 0.2)), rotation=(-0.35 - tilt * 0.4, angle * 0.6, 0), segments=6), m['hair'])
    spiky.build('hair_spiky', coll, parent=root)

    messy = Builder().add(hair_shell(), m['hair'])
    for x, y, z, r in ((-0.1, -0.08, 0.17, 0.07), (0.04, -0.12, 0.15, 0.065), (0.12, -0.02, 0.18, 0.07), (-0.03, 0.02, 0.23, 0.075), (0.15, 0.08, 0.1, 0.06)):
        messy.add(sphere(r, at_head((x, y, z)), segments=10, rings=7), m['hair'])
    messy.build('hair_messy', coll, parent=root)

    # ------------------------------------------------------------ hats
    cap = Builder()
    dome = sphere(1.0, at_head((0, 0.005, 0.035)), scale=(0.238, 0.22, 0.215), segments=18, rings=12)
    cut_below(dome, at_head((0, 0, 0.05)), (0, 0, 1))
    cap.add(dome, m['hat'])
    cap.add(box((0.25, 0.17, 0.026), at_head((0, -0.215, 0.06)), rotation=(math.radians(-8), 0, 0), bevel=0.012), m['hat'])
    cap.add(sphere(0.024, at_head((0, 0.005, 0.25))), m['hat'])
    cap.build('acc_cap', coll, parent=root)

    beanie = Builder()
    dome = sphere(1.0, at_head((0, 0.008, 0.03)), scale=(0.236, 0.218, 0.235), segments=18, rings=12)
    cut_below(dome, at_head((0, 0, 0.03)), (0, 0, 1))
    beanie.add(dome, m['hat'])
    beanie.add(cylinder(0.232, 0.08, at_head((0, 0.008, 0.06)), segments=18, scale=(1, 0.93, 1)), m['hat'])
    beanie.add(sphere(0.05, at_head((0, 0.01, 0.27))), m['hat'])
    beanie.build('acc_beanie', coll, parent=root)

    top_hat = Builder()
    top_hat.add(cylinder(0.135, 0.27, at_head((0, 0.01, 0.33)), segments=16), m['tophat'])
    top_hat.add(cylinder(0.215, 0.022, at_head((0, 0.01, 0.195)), segments=18), m['tophat'])
    top_hat.add(cylinder(0.139, 0.045, at_head((0, 0.01, 0.228)), segments=16), m['hatband'])
    top_hat.build('acc_tophat', coll, parent=root)

    party = Builder()
    party.add(cone(0.11, 0.28, at_head((0.02, 0.0, 0.33)), rotation=(0, -0.15, 0), segments=12), m['partyhat'])
    party.add(torus(0.09, 0.014, at_head((0.012, 0.0, 0.27)), rotation=(0, -0.15, 0), minor_segments=5), m['pompom'])
    party.add(sphere(0.042, at_head((-0.001, 0.0, 0.47))), m['pompom'])
    party.build('acc_partyhat', coll, parent=root)

    fedora = Builder()
    fedora.add(cylinder(0.25, 0.02, at_head((0, 0.01, 0.15)), segments=18, scale=(1, 0.9, 1)), m['fedora'])
    fedora.add(cylinder(0.16, 0.15, at_head((0, 0.01, 0.235)), segments=14, radius2=0.13), m['fedora'])
    fedora.add(cylinder(0.163, 0.036, at_head((0, 0.01, 0.18)), segments=14, radius2=0.157), m['fedora_band'])
    fedora.build('acc_fedora', coll, parent=root)

    phones = Builder()
    phones.add(torus(0.235, 0.018, at_head((0, 0, 0.02)), rotation=(math.pi / 2, 0, 0), arc=math.pi, minor_segments=5), m['headphones'])
    for side in (-1, 1):
        phones.add(cylinder(0.068, 0.065, at_head((side * 0.225, 0, 0.0)), rotation=(0, math.pi / 2, 0), segments=12), m['headphones_cup'])
    phones.build('acc_headphones', coll, parent=root)

    antenna = Builder()
    for side in (-1, 1):
        antenna.add(tube([at_head((side * 0.07, 0, 0.18)), at_head((side * 0.12, 0, 0.29)), at_head((side * 0.15, 0, 0.36))], 0.013, segments=6), m['antenna'])
        antenna.add(sphere(0.032, at_head((side * 0.15, 0, 0.375))), m['antenna_tip'])
    antenna.build('acc_antenna', coll, parent=root)

    # ------------------------------------------------------------ face
    shades = Builder()
    for side in (-1, 1):
        shades.add(box((0.105, 0.03, 0.066), at_head((side * 0.072, -0.188, 0.003)), bevel=0.014), m['shades'])
    shades.add(box((0.05, 0.02, 0.016), at_head((0, -0.2, 0.02))), m['shades'])
    shades.build('acc_sunglasses', coll, parent=root)

    glasses = Builder()
    for side in (-1, 1):
        x = side * 0.074
        glasses.add(box((0.1, 0.02, 0.016), at_head((x, -0.192, 0.036))), m['frames'])
        glasses.add(box((0.1, 0.02, 0.014), at_head((x, -0.192, -0.028))), m['frames'])
        for edge in (-1, 1):
            glasses.add(box((0.014, 0.02, 0.066), at_head((x + edge * 0.045, -0.19, 0.004))), m['frames'])
    glasses.add(box((0.04, 0.018, 0.012), at_head((0, -0.2, 0.02))), m['frames'])
    glasses.build('acc_glasses', coll, parent=root)

    beard = sphere(1.0, at_head((0, -0.045, -0.105)), scale=(0.19, 0.155, 0.12), segments=16, rings=10)
    cut_below(beard, at_head((0, 0, -0.06)), (0, 0, -1))
    cut_below(beard, at_head((0, 0.05, 0)), (0, -1, 0))
    single('acc_beard', beard, m['hair'], coll, parent=root)
    single('acc_mustache', box((0.11, 0.03, 0.028), at_head((0, -0.181, -0.056)), bevel=0.01), m['hair'], coll, parent=root)

    eyes = Builder()
    for side in (-1, 1):
        eyes.add(sphere(1.0, at_head((side * 0.08, -0.172, 0.0)), scale=(0.07, 0.035, 0.088), rotation=(0, side * 0.35, 0)), m['alien_eye'])
    eyes.build('acc_alien_eyes', coll, parent=root)

    # ------------------------------------------------------------ body
    single('acc_chain', torus(0.09, 0.013, (0, -0.124, 0.62), rotation=(-math.pi / 2, 0, 0), arc=math.pi, minor_segments=5), m['gold'], coll, parent=root)

    tie = Builder()
    tie.add(box((0.05, 0.03, 0.04), (0, -0.12, 0.635), bevel=0.01), m['tie'])
    tie.add(box((0.055, 0.02, 0.2), (0, -0.122, 0.52), bevel=0.01), m['tie'])
    tie.build('acc_tie', coll, parent=root)

    pack = Builder()
    pack.add(box((0.27, 0.12, 0.3), (0, 0.17, 0.5), bevel=0.04), m['backpack'])
    for side in (-1, 1):
        pack.add(box((0.04, 0.02, 0.3), (side * 0.09, -0.121, 0.5)), m['strap'])
    pack.build('acc_backpack', coll, parent=root)

    pile = Builder()
    for x, y, s in ((0.32, -0.1, 1.0), (-0.34, -0.06, 0.85)):
        pile.add(sphere(0.12 * s, (x, y, 0.11 * s), scale=(1, 1, 0.95)), m['sack'])
        pile.add(cylinder(0.045 * s, 0.06 * s, (x, y, 0.235 * s)), m['sack'])
        pile.add(torus(0.045 * s, 0.012, (x, y, 0.215 * s), minor_segments=5), m['sack_tie'])
        pile.add(box((0.05 * s, 0.01, 0.07 * s), (x, y - 0.118 * s, 0.11 * s)), m['money'])
    pile.build('acc_moneypile', coll, parent=root)

    # ------------------------------------------------------------ hands
    # Phone: held up beside the head, screen towards the camera.
    hand = hand_world('R', 'phone')
    along = (hand - Vector(SHOULDER['R'])).normalized()
    away = Vector((0, 1, 0))
    away = (away - along * away.dot(along)).normalized()
    across = away.cross(along).normalized()
    orient = Matrix((across, away, along)).transposed().to_4x4()
    phone = Builder()
    phone.add(box((0.095, 0.02, 0.16), (0, 0, 0), bevel=0.01), m['phone_body'])
    phone.add(box((0.08, 0.006, 0.13), (0, -0.012, 0.0)), m['phone_screen'])
    obj = phone.build('acc_phone', coll)
    obj.matrix_world = Matrix.Translation(hand + along * 0.09) @ orient
    bpy.context.view_layer.update()
    attach_posed(obj, arms['R'], 'phone')

    # Mug: held in front of the chest, upright.
    hand = hand_world('R', 'hold')
    mug = Builder()
    mug.add(cylinder(0.052, 0.1, (0, 0, 0), segments=12), m['mug'])
    mug.add(cylinder(0.044, 0.01, (0, 0, 0.047), segments=12), m['coffee'])
    mug.add(torus(0.03, 0.011, (0.058, 0, 0.0), rotation=(math.pi / 2, 0, 0), arc=math.pi, minor_segments=5), m['mug'])
    obj = mug.build('acc_mug', coll)
    obj.location = (hand.x + 0.02, hand.y - 0.045, hand.z + 0.03)
    obj.rotation_euler = (0, 0, math.pi / 2 + 0.3)
    bpy.context.view_layer.update()
    attach_posed(obj, arms['R'], 'hold')

    # Boombox: on the shoulder, speakers facing the camera.
    hand = hand_world('R', 'shoulder')
    radio = Builder()
    radio.add(box((0.34, 0.12, 0.19), (0, 0, 0), bevel=0.02), m['boombox'])
    for side in (-1, 1):
        radio.add(cylinder(0.062, 0.02, (side * 0.1, -0.062, -0.01), rotation=(math.pi / 2, 0, 0), segments=12), m['speaker'])
    radio.add(box((0.08, 0.012, 0.04), (0, -0.062, 0.035)), m['display'])
    radio.add(box((0.22, 0.03, 0.025), (0, 0, 0.12)), m['speaker'])
    for side in (-1, 1):
        radio.add(box((0.025, 0.03, 0.05), (side * 0.1, 0, 0.1)), m['speaker'])
    obj = radio.build('acc_boombox', coll)
    obj.location = (hand.x - 0.15, hand.y + 0.02, hand.z + 0.01)
    bpy.context.view_layer.update()
    attach_posed(obj, arms['R'], 'shoulder')

    # Left hand, arm down: cane, book, money bag.
    hand = hand_world('L', 'stand')
    cane = tube([(hand.x + 0.03, hand.y - 0.05, 0.0), (hand.x + 0.01, hand.y - 0.02, hand.z - 0.02), (hand.x + 0.0, hand.y - 0.02, hand.z + 0.05), (hand.x - 0.035, hand.y - 0.02, hand.z + 0.09), (hand.x - 0.075, hand.y - 0.02, hand.z + 0.06)], 0.016, segments=6)
    obj = single('acc_cane', cane, m['cane'], coll)
    attach_posed(obj, arms['L'], 'stand')

    book = Builder()
    book.add(box((0.05, 0.17, 0.22), (0, 0, 0), bevel=0.008), m['book'])
    book.add(box((0.04, 0.155, 0.2), (-0.008, -0.004, 0)), m['pages'])
    obj = book.build('acc_book', coll)
    obj.location = (hand.x + 0.035, hand.y - 0.01, hand.z + 0.02)
    obj.rotation_euler = (0.15, 0, 0)
    bpy.context.view_layer.update()
    attach_posed(obj, arms['L'], 'stand')

    bag = Builder()
    bag.add(sphere(0.11, (0, 0, -0.1), scale=(1, 1, 1.05)), m['sack'])
    bag.add(cylinder(0.04, 0.05, (0, 0, 0.01)), m['sack'])
    bag.add(torus(0.042, 0.012, (0, 0, -0.005), minor_segments=5), m['sack_tie'])
    bag.add(box((0.05, 0.01, 0.07), (0, -0.108, -0.1)), m['money'])
    obj = bag.build('acc_moneybag', coll)
    obj.location = (hand.x + 0.04, hand.y - 0.02, hand.z - 0.02)
    bpy.context.view_layer.update()
    attach_posed(obj, arms['L'], 'stand')

    return root


# ------------------------------------------------------------------ animals


def animal_mats():
    return {
        'coat': material('coat', '#f0973f'),
        'accent': material('accent', '#f7f1e6'),
        'stripe': material('stripe', '#c96a22'),
        'eye': material('eye', '#17161d', roughness=0.4),
        'nose': material('nose', '#f28aa0'),
        'nose_dark': material('nose_dark', '#1d1a1f'),
        'inner_ear': material('inner_ear', '#f5a6b6'),
        'tongue': material('tongue', '#f07a8a'),
        'hoof': material('hoof', '#3b2f2a'),
    }


def build_cat(coll):
    m = animal_mats()
    root = empty('cat', coll)
    body = Builder()
    body.add(sphere(1.0, (0, 0.04, 0.17), scale=(0.17, 0.19, 0.18)), m['coat'])
    body.add(sphere(1.0, (0, -0.095, 0.17), scale=(0.1, 0.075, 0.13)), m['accent'])
    for side in (-1, 1):
        body.add(sphere(1.0, (side * 0.065, -0.13, 0.035), scale=(0.05, 0.06, 0.035)), m['accent'])
        body.add(sphere(1.0, (side * 0.11, 0.07, 0.08), scale=(0.075, 0.12, 0.08)), m['coat'])
        body.add(cone(0.058, 0.11, (side * 0.092, -0.03, 0.56), rotation=(0.1, side * 0.32, 0), segments=4), m['coat'])
        body.add(cone(0.032, 0.06, (side * 0.088, -0.062, 0.545), rotation=(0.1, side * 0.32, 0), segments=4), m['inner_ear'])
        body.add(sphere(1.0, (side * 0.06, -0.162, 0.44), scale=(0.023, 0.012, 0.031), segments=8, rings=6), m['eye'])
    body.add(sphere(1.0, (0, -0.04, 0.42), scale=(0.165, 0.145, 0.14)), m['coat'])
    body.add(sphere(1.0, (0, -0.163, 0.38), scale=(0.075, 0.045, 0.05)), m['accent'])
    body.add(sphere(0.017, (0, -0.205, 0.404)), m['nose'])
    for x in (-0.04, 0.0, 0.04):
        body.add(box((0.018, 0.02, 0.06), (x, -0.165, 0.52), rotation=(0.6, 0, 0)), m['stripe'])
    for z in (0.12, 0.2, 0.28):
        body.add(box((0.2, 0.03, 0.025), (0, 0.2, z), rotation=(0, 0, 0)), m['stripe'])
    body.build('cat_body', coll, parent=root)
    tail = tube([(0, 0, 0), (0.06, 0.05, 0.05), (0.13, 0.06, 0.15), (0.14, 0.03, 0.27), (0.1, -0.01, 0.34)], lambda t: 0.036 - 0.012 * t, segments=7)
    single('cat_tail', tail, m['coat'], coll, location=(0.02, 0.19, 0.06), parent=root)
    return root


def build_dog(coll):
    m = animal_mats()
    root = empty('dog', coll)
    body = Builder()
    body.add(sphere(1.0, (0, 0.06, 0.2), scale=(0.17, 0.21, 0.2)), m['coat'])
    body.add(sphere(1.0, (0, -0.095, 0.21), scale=(0.11, 0.075, 0.14)), m['accent'])
    for side in (-1, 1):
        body.add(box((0.075, 0.085, 0.21), (side * 0.07, -0.1, 0.1), bevel=0.03), m['coat'])
        body.add(sphere(1.0, (side * 0.07, -0.13, 0.025), scale=(0.05, 0.065, 0.03)), m['accent'])
        body.add(sphere(1.0, (side * 0.12, 0.1, 0.09), scale=(0.075, 0.12, 0.085)), m['coat'])
        body.add(box((0.065, 0.1, 0.17), (side * 0.155, -0.05, 0.43), rotation=(0, side * 0.28, 0), bevel=0.03), m['stripe'])
        body.add(sphere(1.0, (side * 0.06, -0.178, 0.505), scale=(0.021, 0.012, 0.027), segments=8, rings=6), m['eye'])
    body.add(sphere(1.0, (0, -0.06, 0.47), scale=(0.152, 0.142, 0.142)), m['coat'])
    body.add(box((0.115, 0.13, 0.085), (0, -0.2, 0.43), bevel=0.035), m['accent'])
    body.add(sphere(0.026, (0, -0.268, 0.458)), m['nose_dark'])
    body.add(box((0.045, 0.03, 0.035), (0, -0.25, 0.39), bevel=0.01), m['tongue'])
    body.build('dog_body', coll, parent=root)
    tail = tube([(0, 0, 0), (0.0, 0.06, 0.06), (0.02, 0.1, 0.16), (0.03, 0.11, 0.24)], lambda t: 0.035 - 0.012 * t, segments=7)
    single('dog_tail', tail, m['coat'], coll, location=(0, 0.25, 0.12), parent=root)
    return root


def build_duck(coll):
    m = animal_mats()
    root = empty('duck', coll)
    body = Builder()
    body.add(sphere(1.0, (0, 0.03, 0.17), scale=(0.15, 0.2, 0.13)), m['coat'])
    body.add(cone(0.07, 0.12, (0, 0.21, 0.24), rotation=(-0.9, 0, 0), segments=8), m['coat'])
    body.add(sphere(1.0, (0, -0.1, 0.34), scale=(0.1, 0.1, 0.1)), m['coat'])
    body.add(box((0.085, 0.095, 0.032), (0, -0.21, 0.315), bevel=0.014), m['accent'])
    for side in (-1, 1):
        body.add(sphere(1.0, (side * 0.135, 0.04, 0.18), scale=(0.04, 0.13, 0.08)), m['coat'])
        body.add(sphere(1.0, (side * 0.055, -0.175, 0.36), scale=(0.018, 0.012, 0.022), segments=8, rings=6), m['eye'])
        body.add(cylinder(0.012, 0.07, (side * 0.05, 0.0, 0.04)), m['accent'])
        body.add(box((0.06, 0.08, 0.015), (side * 0.05, -0.03, 0.008), bevel=0.005), m['accent'])
    body.build('duck_body', coll, parent=root)
    return root


def build_horse(coll):
    m = animal_mats()
    root = empty('horse', coll)
    body = Builder()
    body.add(box((0.27, 0.6, 0.29), (0, 0.02, 0.63), bevel=0.11, segments=3), m['coat'])
    for x in (-1, 1):
        for y in (-1, 1):
            body.add(box((0.08, 0.085, 0.48), (x * 0.085, y * 0.21, 0.27), bevel=0.025), m['coat'])
            body.add(box((0.09, 0.095, 0.06), (x * 0.085, y * 0.21, 0.03), bevel=0.01), m['hoof'])
    body.add(box((0.15, 0.17, 0.4), (0, -0.3, 0.86), rotation=(math.radians(-28), 0, 0), bevel=0.06), m['coat'])
    body.add(box((0.15, 0.32, 0.15), (0, -0.44, 1.02), rotation=(math.radians(28), 0, 0), bevel=0.06), m['coat'])
    body.add(box((0.06, 0.24, 0.32), (0, -0.25, 0.95), rotation=(math.radians(-28), 0, 0), bevel=0.025), m['accent'])
    for side in (-1, 1):
        body.add(cone(0.035, 0.08, (side * 0.05, -0.36, 1.17), segments=4), m['coat'])
        body.add(sphere(0.02, (side * 0.078, -0.45, 1.06), segments=8, rings=6), m['eye'])
    body.build('horse_body', coll, parent=root)
    tail = tube([(0, 0, 0), (0, 0.06, -0.08), (0, 0.08, -0.22), (0, 0.07, -0.34)], lambda t: 0.05 - 0.02 * t, segments=7)
    single('horse_tail', tail, m['accent'], coll, location=(0, 0.33, 0.7), parent=root)
    return root


def write_rig():
    os.makedirs(os.path.dirname(RIG_JSON), exist_ok=True)
    with open(RIG_JSON, 'w') as handle:
        json.dump({'shoulder': {k: list(v) for k, v in SHOULDER.items()}, 'poses': {k: {s: list(r) for s, r in v.items()} for k, v in RIG.items()}}, handle, separators=(',', ':'))
        handle.write('\n')
    return RIG_JSON


def build(coll_name='ATP_Cast'):
    coll = collection(coll_name)
    roots = [build_person(coll), build_cat(coll), build_dog(coll), build_duck(coll), build_horse(coll)]
    spacing = 1.1
    for index, root in enumerate(roots):
        root.location.x = index * spacing
    write_rig()
    return roots

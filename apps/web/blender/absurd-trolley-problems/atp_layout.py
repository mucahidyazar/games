"""Track layout shared by the Blender scene and the game.

Coordinates are Blender's: X right, Y away from the camera, Z up, metres.
`write_layout()` stores the sampled paths in the game's scene/layout.json,
converted to three.js axes (x, y, z) = (x, z, -y).
"""

import json
import math
import os

GAME_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'games', 'absurd-trolley-problems'))
ASSET_DIR = os.path.join(GAME_DIR, 'assets')
LAYOUT_JSON = os.path.join(GAME_DIR, 'scene', 'layout.json')

GAUGE = 0.84  # distance between the rails
SWITCH_RAILS = 2.6  # past the junction, the rails the lever moves: the game builds and bends them itself
SLEEPER_SPACING = 0.42
JUNCTION = (-3.5, 0.0)
HEADING = math.radians(-30.0)  # towards the camera, so the tram shows its lit front
MAIN_RADIUS = 6.0
BRANCH_RADIUS = 14.0
BRANCH_HEADING = math.radians(-38.0)
STEP = 0.2


def _dir(angle):
    return (math.cos(angle), math.sin(angle))


def _line(start, angle, length, step=STEP):
    dx, dy = _dir(angle)
    count = max(1, int(round(length / step)))
    return [(start[0] + dx * length * i / count, start[1] + dy * length * i / count) for i in range(count + 1)]


def _arc(start, heading, radius, end_heading):
    """A circular arc from `start`, turning left when end_heading > heading."""
    turn = 1.0 if end_heading > heading else -1.0
    nx, ny = -math.sin(heading) * turn, math.cos(heading) * turn
    center = (start[0] + nx * radius, start[1] + ny * radius)
    phi0 = heading - turn * math.pi / 2
    phi1 = end_heading - turn * math.pi / 2
    count = max(2, int(round(abs(phi1 - phi0) * radius / STEP)))
    return [(center[0] + radius * math.cos(phi0 + (phi1 - phi0) * i / count), center[1] + radius * math.sin(phi0 + (phi1 - phi0) * i / count)) for i in range(count + 1)]


def incoming():
    """From the far left, behind the trees, to the switch."""
    length = 16.0
    dx, dy = _dir(HEADING)
    start = (JUNCTION[0] - dx * length, JUNCTION[1] - dy * length)
    return _line(start, HEADING, length)


def main_track():
    """Track A: eases into a straight line that runs across the screen, in front of the wall."""
    arc = _arc(JUNCTION, HEADING, MAIN_RADIUS, 0.0)
    end = arc[-1]
    straight = _line(end, 0.0, 22.0 - end[0])
    return arc + straight[1:]


def branch_track():
    """Track B: curves away towards the camera."""
    arc = _arc(JUNCTION, HEADING, BRANCH_RADIUS, BRANCH_HEADING)
    straight = _line(arc[-1], BRANCH_HEADING, 20.0)
    return arc + straight[1:]


def length_of(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def point_at(points, distance):
    """The point `distance` metres along a polyline, and the heading there."""
    walked = 0.0
    for a, b in zip(points, points[1:]):
        seg = math.dist(a, b)
        if walked + seg >= distance:
            t = (distance - walked) / seg
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), math.atan2(b[1] - a[1], b[0] - a[0])
        walked += seg
    a, b = points[-2], points[-1]
    return b, math.atan2(b[1] - a[1], b[0] - a[0])


# Where the actors wait: distances along each track, measured from the switch.
# Track A's slots run from `start` in steps of `spacing`; track B's are centred
# on `center` but never closer to the switch than `min`, where the tracks still touch.
VICTIMS_A = {'start': 2.9, 'spacing': 1.33}
VICTIMS_B = {'center': 6.0, 'spacing': 1.2, 'min': 4.4}
LEVER = (-6.1, -2.6)
LAMP = (5.4, 0.95)
WALL_Y = 1.5
WALL_START = -4.1
FOOTBRIDGE_AT = 3.9  # along track A
TRAM_START = 14.0  # front of the tram, along the incoming line
TRAM_SCALE = 1.1
LEVER_SCALE = 1.6
# The key frame draws everyone larger than life next to the tram.
ACTOR_SCALE = {'person': 1.7, 'cat': 2.0, 'dog': 1.8, 'duck': 1.7, 'horse': 0.5, 'prop': 1.25}


def to_three(x, y, z=0.0):
    return [round(x, 3), round(z, 3), round(-y, 3)]


def write_layout():
    data = {
        'gauge': GAUGE,
        'switchRails': SWITCH_RAILS,
        'incoming': [to_three(x, y) for x, y in incoming()],
        'main': [to_three(x, y) for x, y in main_track()],
        'branch': [to_three(x, y) for x, y in branch_track()],
        'victimsA': VICTIMS_A,
        'victimsB': VICTIMS_B,
        'lever': to_three(*LEVER),
        'lamp': to_three(*LAMP, 3.05),
        'footbridgeAt': FOOTBRIDGE_AT,
        'tramStart': TRAM_START,
        'tramScale': TRAM_SCALE,
        'leverScale': LEVER_SCALE,
        'actorScale': ACTOR_SCALE,
    }
    os.makedirs(os.path.dirname(LAYOUT_JSON), exist_ok=True)
    with open(LAYOUT_JSON, 'w') as handle:
        json.dump(data, handle, separators=(',', ':'))
        handle.write('\n')
    return LAYOUT_JSON

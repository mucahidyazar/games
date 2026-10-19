"""Headless entry point: blender -b -P apps/web/blender/absurd-trolley-problems/build_all.py"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import atp_export  # noqa: E402

for path, size in atp_export.run().items():
    print(f'{size / 1024:8.1f} KiB  {path}')

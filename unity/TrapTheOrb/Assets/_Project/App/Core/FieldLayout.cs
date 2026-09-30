using System;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Core
{
    /// <summary>How the grid sits inside the board: a uniform scale, centred (render/layout.ts).</summary>
    public readonly struct FieldLayout
    {
        public FieldLayout(float width, float height, float scale, float offsetX, float offsetY)
        {
            Width = width;
            Height = height;
            Scale = scale;
            OffsetX = offsetX;
            OffsetY = offsetY;
        }

        /// <summary>Board size in UI units.</summary>
        public float Width { get; }
        public float Height { get; }

        /// <summary>UI units per grid cell.</summary>
        public float Scale { get; }

        /// <summary>Letterbox offsets of the field inside the board.</summary>
        public float OffsetX { get; }
        public float OffsetY { get; }

        public static FieldLayout Fit(float width, float height, GridDims dims)
        {
            float scale = Math.Min(width / dims.Cols, height / dims.Rows);
            return new FieldLayout(width, height, scale, (width - dims.Cols * scale) / 2, (height - dims.Rows * scale) / 2);
        }

        /// <summary>Grid cell under a point in board units, or null outside the field.</summary>
        public CellPoint? CellAt(GridDims dims, float x, float y)
        {
            if (Scale <= 0) return null;
            int col = (int)Math.Floor((x - OffsetX) / Scale);
            int row = (int)Math.Floor((y - OffsetY) / Scale);
            if (col < 0 || row < 0 || col >= dims.Cols || row >= dims.Rows) return null;
            return new CellPoint(col, row);
        }

        public float X(double col) => OffsetX + (float)col * Scale;

        public float Y(double row) => OffsetY + (float)row * Scale;
    }

    public static class Runs
    {
        /// <summary>Centre of mass of a set of cell runs, in cell coordinates; null when empty.</summary>
        public static (double X, double Y)? Centroid(ReadOnlyArray<CellRun> runs)
        {
            double total = 0;
            double sumX = 0;
            double sumY = 0;
            foreach (CellRun run in runs)
            {
                int length = run.End - run.Start;
                total += length;
                sumX += (run.Start + run.End) / 2.0 * length;
                sumY += (run.Row + 0.5) * length;
            }
            return total == 0 ? ((double, double)?)null : (sumX / total, sumY / total);
        }
    }
}

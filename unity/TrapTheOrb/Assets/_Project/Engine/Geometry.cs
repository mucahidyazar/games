using System;

namespace TrapTheOrb.Engine
{
    public static class Geometry
    {
        /// <summary>True when the circle and the rectangle share any area (touching is not overlapping).</summary>
        public static bool CircleIntersectsRect(double cx, double cy, double radius, Rect rect)
        {
            double nearestX = Math.Max(rect.Left, Math.Min(cx, rect.Right));
            double nearestY = Math.Max(rect.Top, Math.Min(cy, rect.Bottom));
            double dx = cx - nearestX;
            double dy = cy - nearestY;
            return dx * dx + dy * dy < radius * radius;
        }

        /// <summary>True when a circle overlaps any solid cell (or leaves the grid).</summary>
        public static bool CircleOverlapsSolid(Grid grid, double cx, double cy, double radius)
        {
            int minCol = (int)Math.Floor(cx - radius);
            int maxCol = (int)Math.Floor(cx + radius);
            int minRow = (int)Math.Floor(cy - radius);
            int maxRow = (int)Math.Floor(cy + radius);
            double radiusSq = radius * radius;
            ReadOnlySpan<byte> cells = grid.Cells;

            for (int row = minRow; row <= maxRow; row++)
            {
                double dy = cy < row ? row - cy : cy > row + 1 ? cy - row - 1 : 0;
                if (dy * dy >= radiusSq) continue;

                for (int col = minCol; col <= maxCol; col++)
                {
                    bool outside = col < 0 || row < 0 || col >= grid.Cols || row >= grid.Rows;
                    if (!outside && cells[row * grid.Cols + col] == CellState.Free) continue;

                    double dx = cx < col ? col - cx : cx > col + 1 ? cx - col - 1 : 0;
                    if (dx * dx + dy * dy < radiusSq) return true;
                }
            }

            return false;
        }
    }
}

using System;

namespace TrapTheOrb.Engine
{
    public static class Walls
    {
        /// <summary>
        /// Two halves that grow apart from the far edge of the tapped cell: the backward half claims the tapped cell
        /// itself, the forward half starts at the next cell. Every cell therefore belongs to exactly one half, which
        /// keeps the solid cells of a finished half identical to its collision area.
        /// </summary>
        public static (WallHalf Backward, WallHalf Forward) CreatePair(Orientation orientation, int col, int row, int firstId)
        {
            bool vertical = orientation == Orientation.Vertical;
            int line = vertical ? col : row;
            int origin = (vertical ? row : col) + 1;
            return (
                new WallHalf(firstId, orientation, line, origin, -1, 0),
                new WallHalf(firstId + 1, orientation, line, origin, 1, 0));
        }

        /// <summary>Position of the growing end along the wall's axis.</summary>
        public static double Tip(WallHalf wall) => wall.Origin + wall.Direction * wall.Length;

        private static bool SolidAlong(Grid grid, WallHalf wall, int index) =>
            wall.Orientation == Orientation.Vertical ? grid.IsSolid(wall.Line, index) : grid.IsSolid(index, wall.Line);

        /// <summary>
        /// Grows a wall half by <paramref name="distance"/> cells. When the tip would enter a solid cell it stops
        /// flush against it and the half is reported as completed.
        /// </summary>
        public static AdvanceResult Advance(WallHalf wall, Grid grid, double distance)
        {
            double tip = Tip(wall);
            double target = tip + wall.Direction * distance;

            if (wall.Direction == 1)
            {
                int last = (int)Math.Ceiling(target) - 1;
                for (int index = (int)Math.Floor(tip); index <= last; index++)
                {
                    if (SolidAlong(grid, wall, index)) return new AdvanceResult(wall.WithLength(index - wall.Origin), true);
                }
            }
            else
            {
                int last = (int)Math.Floor(target);
                for (int index = (int)Math.Ceiling(tip) - 1; index >= last; index--)
                {
                    if (SolidAlong(grid, wall, index)) return new AdvanceResult(wall.WithLength(wall.Origin - (index + 1)), true);
                }
            }

            return new AdvanceResult(wall.WithLength(wall.Length + distance), false);
        }

        /// <summary>Area currently covered by a wall half, in cell units.</summary>
        public static Rect CoveredRect(WallHalf wall)
        {
            double tip = Tip(wall);
            double start = Math.Min(wall.Origin, tip);
            double end = Math.Max(wall.Origin, tip);

            return wall.Orientation == Orientation.Vertical
                ? new Rect(wall.Line, start, wall.Line + 1, end)
                : new Rect(start, wall.Line, end, wall.Line + 1);
        }

        /// <summary>Row-major indices of every cell the wall half touches.</summary>
        public static int[] Cells(WallHalf wall, int cols)
        {
            double tip = Tip(wall);
            int first = (int)Math.Floor(Math.Min(wall.Origin, tip));
            int last = (int)Math.Ceiling(Math.Max(wall.Origin, tip)) - 1;
            if (last < first) return Array.Empty<int>();

            var indices = new int[last - first + 1];
            for (int index = first; index <= last; index++)
            {
                indices[index - first] = wall.Orientation == Orientation.Vertical ? index * cols + wall.Line : wall.Line * cols + index;
            }
            return indices;
        }

        /// <summary>
        /// The cells a wall through (col, row) would cover once both halves finish, ignoring balls — used to preview
        /// a wall before it is placed. Null when the cell cannot hold a wall.
        /// </summary>
        public static Extent? PreviewExtent(Grid grid, int col, int row, Orientation orientation)
        {
            if (grid.IsSolid(col, row)) return null;

            bool vertical = orientation == Orientation.Vertical;
            int line = vertical ? col : row;
            int at = vertical ? row : col;
            bool Solid(int index) => vertical ? grid.IsSolid(line, index) : grid.IsSolid(index, line);

            int start = at;
            while (!Solid(start - 1)) start--;
            int end = at + 1;
            while (!Solid(end)) end++;

            return new Extent(start, end);
        }
    }

    public readonly struct AdvanceResult
    {
        public AdvanceResult(WallHalf wall, bool completed)
        {
            Wall = wall;
            Completed = completed;
        }

        public WallHalf Wall { get; }
        public bool Completed { get; }
    }

    /// <summary>Cells covered along a wall's growth axis: from <see cref="Start"/> to one before <see cref="End"/>.</summary>
    public readonly struct Extent : IEquatable<Extent>
    {
        public Extent(int start, int end)
        {
            Start = start;
            End = end;
        }

        public int Start { get; }
        public int End { get; }

        public bool Equals(Extent other) => Start == other.Start && End == other.End;

        public override bool Equals(object obj) => obj is Extent other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Start, End);

        public override string ToString() => $"Extent({Start}..{End})";
    }
}

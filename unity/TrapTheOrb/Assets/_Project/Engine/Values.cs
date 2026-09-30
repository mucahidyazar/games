using System;

namespace TrapTheOrb.Engine
{
    /// <summary>
    /// An orb. Coordinates are in grid cells: the cell (col, row) spans x ∈ [col, col + 1) and y ∈ [row, row + 1).
    /// </summary>
    public readonly struct Ball : IEquatable<Ball>
    {
        public Ball(int id, double x, double y, double vx, double vy, double radius, int tier)
        {
            Id = id;
            X = x;
            Y = y;
            Vx = vx;
            Vy = vy;
            Radius = radius;
            Tier = tier;
        }

        public int Id { get; }
        public double X { get; }
        public double Y { get; }

        /// <summary>Velocity in cells per second.</summary>
        public double Vx { get; }
        public double Vy { get; }

        public double Radius { get; }

        /// <summary>Speed tier (0 calm … 3 blazing); the renderer colours orbs by it.</summary>
        public int Tier { get; }

        public Ball WithMotion(double x, double y, double vx, double vy) => new Ball(Id, x, y, vx, vy, Radius, Tier);

        public Ball WithVelocity(double vx, double vy) => new Ball(Id, X, Y, vx, vy, Radius, Tier);

        public bool Equals(Ball other) =>
            Id == other.Id && X.Equals(other.X) && Y.Equals(other.Y) && Vx.Equals(other.Vx) && Vy.Equals(other.Vy) &&
            Radius.Equals(other.Radius) && Tier == other.Tier;

        public override bool Equals(object obj) => obj is Ball other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Id, X, Y, Vx, Vy, Radius, Tier);

        public override string ToString() => $"Ball {Id} ({X}, {Y}) v=({Vx}, {Vy}) tier {Tier}";
    }

    /// <summary>One of the two halves of a wall that grow away from the tapped point.</summary>
    public readonly struct WallHalf : IEquatable<WallHalf>
    {
        public WallHalf(int id, Orientation orientation, int line, int origin, int direction, double length)
        {
            Id = id;
            Orientation = orientation;
            Line = line;
            Origin = origin;
            Direction = direction;
            Length = length;
        }

        public int Id { get; }
        public Orientation Orientation { get; }

        /// <summary>Column of a vertical wall, row of a horizontal wall.</summary>
        public int Line { get; }

        /// <summary>Position along the growth axis where the wall started.</summary>
        public int Origin { get; }

        /// <summary>-1 or 1.</summary>
        public int Direction { get; }

        /// <summary>How far the tip has travelled from the origin, in cells.</summary>
        public double Length { get; }

        public WallHalf WithLength(double length) => new WallHalf(Id, Orientation, Line, Origin, Direction, length);

        public bool Equals(WallHalf other) =>
            Id == other.Id && Orientation == other.Orientation && Line == other.Line && Origin == other.Origin &&
            Direction == other.Direction && Length.Equals(other.Length);

        public override bool Equals(object obj) => obj is WallHalf other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Id, Orientation, Line, Origin, Direction, Length);
    }

    /// <summary>An axis-aligned rectangle in cell units.</summary>
    public readonly struct Rect : IEquatable<Rect>
    {
        public Rect(double left, double top, double right, double bottom)
        {
            Left = left;
            Top = top;
            Right = right;
            Bottom = bottom;
        }

        public double Left { get; }
        public double Top { get; }
        public double Right { get; }
        public double Bottom { get; }

        public bool Equals(Rect other) =>
            Left.Equals(other.Left) && Top.Equals(other.Top) && Right.Equals(other.Right) && Bottom.Equals(other.Bottom);

        public override bool Equals(object obj) => obj is Rect other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Left, Top, Right, Bottom);

        public override string ToString() => $"Rect({Left}, {Top}, {Right}, {Bottom})";
    }

    /// <summary>A horizontal run of cells on one row, <see cref="End"/> exclusive.</summary>
    public readonly struct CellRun : IEquatable<CellRun>
    {
        public CellRun(int row, int start, int end)
        {
            Row = row;
            Start = start;
            End = end;
        }

        public int Row { get; }
        public int Start { get; }
        public int End { get; }

        public bool Equals(CellRun other) => Row == other.Row && Start == other.Start && End == other.End;

        public override bool Equals(object obj) => obj is CellRun other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Row, Start, End);

        public override string ToString() => $"Run(row {Row}, {Start}..{End})";
    }

    public readonly struct GridDims : IEquatable<GridDims>
    {
        public GridDims(int cols, int rows)
        {
            Cols = cols;
            Rows = rows;
        }

        public int Cols { get; }
        public int Rows { get; }

        public bool Equals(GridDims other) => Cols == other.Cols && Rows == other.Rows;

        public override bool Equals(object obj) => obj is GridDims other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Cols, Rows);
    }

    /// <summary>A cell of the grid, e.g. where the player aims.</summary>
    public readonly struct CellPoint : IEquatable<CellPoint>
    {
        public CellPoint(int col, int row)
        {
            Col = col;
            Row = row;
        }

        public int Col { get; }
        public int Row { get; }

        public bool Equals(CellPoint other) => Col == other.Col && Row == other.Row;

        public override bool Equals(object obj) => obj is CellPoint other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Col, Row);

        public override string ToString() => $"({Col}, {Row})";
    }
}

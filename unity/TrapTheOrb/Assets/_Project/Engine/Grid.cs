using System;

namespace TrapTheOrb.Engine
{
    /// <summary>
    /// The playing field: row-major cell states inside a permanent one-cell solid border ring.
    /// Immutable — every change returns a new grid with a higher <see cref="Version"/>.
    /// </summary>
    public sealed class Grid
    {
        private const int MinSize = 3;

        private readonly byte[] cells;

        private Grid(int cols, int rows, byte[] cells, int solidInteriorCount, int version)
        {
            Cols = cols;
            Rows = rows;
            this.cells = cells;
            InteriorCount = (cols - 2) * (rows - 2);
            SolidInteriorCount = solidInteriorCount;
            Version = version;
        }

        public int Cols { get; }
        public int Rows { get; }

        /// <summary>Cells inside the permanent border ring.</summary>
        public int InteriorCount { get; }

        /// <summary>Interior cells that are walls or captured territory.</summary>
        public int SolidInteriorCount { get; }

        /// <summary>Incremented on every change so renderers can cache static layers.</summary>
        public int Version { get; }

        public int CellCount => cells.Length;

        public ReadOnlySpan<byte> Cells => cells;

        /// <summary>Share of the interior that is walls or captured territory, 0–100.</summary>
        public double CapturedPercent => (double)SolidInteriorCount / InteriorCount * 100;

        /// <summary>An empty field surrounded by a one-cell solid border ring.</summary>
        public static Grid Create(int cols, int rows)
        {
            if (cols < MinSize || rows < MinSize)
            {
                throw new ArgumentOutOfRangeException(nameof(cols), $"Grid must be at least 3x3 whole cells, got {cols}x{rows}");
            }

            var cells = new byte[cols * rows];
            for (int col = 0; col < cols; col++)
            {
                cells[col] = CellState.Wall;
                cells[(rows - 1) * cols + col] = CellState.Wall;
            }
            for (int row = 0; row < rows; row++)
            {
                cells[row * cols] = CellState.Wall;
                cells[row * cols + cols - 1] = CellState.Wall;
            }
            return new Grid(cols, rows, cells, 0, 0);
        }

        public static Grid Create(GridDims dims) => Create(dims.Cols, dims.Rows);

        /// <summary>Cell state at (col, row); everything outside the grid counts as wall.</summary>
        public byte CellAt(int col, int row)
        {
            if (col < 0 || row < 0 || col >= Cols || row >= Rows) return CellState.Wall;
            return cells[row * Cols + col];
        }

        /// <summary>Cell state at a row-major index; indices outside the grid count as wall.</summary>
        public byte CellAtIndex(int index) => (uint)index < (uint)cells.Length ? cells[index] : CellState.Wall;

        public bool IsSolid(int col, int row) => CellAt(col, row) != CellState.Free;

        /// <summary>
        /// A new grid where the given free cells take <paramref name="state"/>. Cells that are already solid keep
        /// their state and are not counted again. Returns this grid when nothing changes.
        /// </summary>
        public Grid Fill(ReadOnlySpan<int> indices, byte state)
        {
            byte[] next = null;
            int added = 0;

            foreach (int index in indices)
            {
                if ((uint)index >= (uint)cells.Length || cells[index] != CellState.Free) continue;
                next ??= (byte[])cells.Clone();
                if (next[index] != CellState.Free) continue;
                next[index] = state;
                added++;
            }

            return next == null ? this : new Grid(Cols, Rows, next, SolidInteriorCount + added, Version + 1);
        }

        /// <summary>Hands out a copy of the cells, for the capture flood fill to edit.</summary>
        internal byte[] CopyCells() => (byte[])cells.Clone();

        /// <summary>A new grid with the given cells, owned by the grid from now on.</summary>
        internal Grid WithCells(byte[] ownedCells, int solidInteriorCount) =>
            new Grid(Cols, Rows, ownedCells, solidInteriorCount, Version + 1);
    }
}

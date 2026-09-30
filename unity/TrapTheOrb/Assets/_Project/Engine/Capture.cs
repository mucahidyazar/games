using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    public static class Capture
    {
        /// <summary>
        /// Flood-fills free space from every ball (4-connected) and turns all free cells that no ball can reach into
        /// captured territory.
        /// </summary>
        public static CaptureResult EnclosedAreas(Grid grid, ReadOnlyArray<Ball> balls)
        {
            FloodBuffers buffers = FloodBuffers.For(grid.CellCount);
            ReadOnlySpan<byte> cells = grid.Cells;
            var orbRegionSizes = new List<int>(balls.Count);

            foreach (Ball ball in balls)
            {
                int start = (int)Math.Floor(ball.Y) * grid.Cols + (int)Math.Floor(ball.X);
                if (grid.CellAtIndex(start) != CellState.Free || buffers.Reachable[start] == 1) continue;
                orbRegionSizes.Add(Flood(cells, grid.Cols, start, buffers.Reachable, buffers.Stack));
            }

            return CaptureUnreached(grid, buffers, ReadOnlyArray<int>.Wrap(orbRegionSizes.ToArray()));
        }

        private static CaptureResult CaptureUnreached(Grid grid, FloodBuffers buffers, ReadOnlyArray<int> orbRegionSizes)
        {
            int cols = grid.Cols;
            int rows = grid.Rows;
            ReadOnlySpan<byte> cells = grid.Cells;
            byte[] reachable = buffers.Reachable;
            byte[] next = null;
            int captured = 0;
            var runs = new List<CellRun>();

            for (int row = 1; row < rows - 1; row++)
            {
                int runStart = -1;
                for (int col = 1; col < cols; col++)
                {
                    int index = row * cols + col;
                    bool capture = col < cols - 1 && cells[index] == CellState.Free && reachable[index] == 0;

                    if (capture)
                    {
                        next ??= grid.CopyCells();
                        next[index] = CellState.Captured;
                        captured++;
                        if (runStart < 0) runStart = col;
                    }
                    else if (runStart >= 0)
                    {
                        runs.Add(new CellRun(row, runStart, col));
                        runStart = -1;
                    }
                }
            }

            if (next == null) return new CaptureResult(grid, 0, ReadOnlyArray<CellRun>.Empty, 0, orbRegionSizes);

            return new CaptureResult(
                grid.WithCells(next, grid.SolidInteriorCount + captured),
                captured,
                ReadOnlyArray<CellRun>.Wrap(runs.ToArray()),
                CountNewRegions(cells, cols, buffers),
                orbRegionSizes);
        }

        /// <summary>Counts 4-connected regions among the cells that were free but unreachable (the ones just captured).</summary>
        private static int CountNewRegions(ReadOnlySpan<byte> cells, int cols, FloodBuffers buffers)
        {
            // From here on "reachable" also marks cells already counted in a new region.
            byte[] visited = buffers.Reachable;
            int regions = 0;

            for (int start = 0; start < cells.Length; start++)
            {
                if (cells[start] != CellState.Free || visited[start] != 0) continue;
                regions++;
                Flood(cells, cols, start, visited, buffers.Stack);
            }
            return regions;
        }

        /// <summary>
        /// Marks the free region around <paramref name="start"/> in <paramref name="visited"/>; returns its size in cells.
        /// </summary>
        private static int Flood(ReadOnlySpan<byte> cells, int cols, int start, byte[] visited, int[] stack)
        {
            int size = 0;
            int regionSize = 0;
            Push(cells, start, visited, stack, ref size, ref regionSize);
            while (size > 0)
            {
                int index = stack[--size];
                Push(cells, index - 1, visited, stack, ref size, ref regionSize);
                Push(cells, index + 1, visited, stack, ref size, ref regionSize);
                Push(cells, index - cols, visited, stack, ref size, ref regionSize);
                Push(cells, index + cols, visited, stack, ref size, ref regionSize);
            }
            return regionSize;
        }

        private static void Push(ReadOnlySpan<byte> cells, int index, byte[] visited, int[] stack, ref int size, ref int regionSize)
        {
            if ((uint)index >= (uint)cells.Length || cells[index] != CellState.Free || visited[index] != 0) return;
            visited[index] = 1;
            stack[size++] = index;
            regionSize++;
        }

        /// <summary>
        /// Scratch arrays for the flood fills, reused between calls so a finished wall does not allocate a few
        /// hundred kilobytes of garbage. Invisible to callers: they are cleared before every use.
        /// </summary>
        private sealed class FloodBuffers
        {
            [ThreadStatic] private static FloodBuffers cached;

            private FloodBuffers(int length)
            {
                Reachable = new byte[length];
                Stack = new int[length];
            }

            public byte[] Reachable { get; }
            public int[] Stack { get; }

            public static FloodBuffers For(int length)
            {
                if (cached == null || cached.Reachable.Length != length) cached = new FloodBuffers(length);
                else Array.Clear(cached.Reachable, 0, length);
                return cached;
            }
        }
    }

    public sealed record CaptureResult(
        Grid Grid,
        int Captured,
        ReadOnlyArray<CellRun> Runs,
        int CapturedRegions,
        ReadOnlyArray<int> OrbRegionSizes);
}

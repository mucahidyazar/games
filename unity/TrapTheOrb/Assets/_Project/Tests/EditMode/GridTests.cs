using System;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class GridTests
    {
        [Test]
        public void Create_SurroundsAFreeInteriorWithASolidBorderRing()
        {
            Grid grid = Grid.Create(10, 6);

            Assert.That((grid.Cols, grid.Rows), Is.EqualTo((10, 6)));
            Assert.That(grid.CellAt(0, 0), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAt(9, 5), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAt(0, 3), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAt(4, 0), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAt(1, 1), Is.EqualTo(CellState.Free));
            Assert.That(grid.CellAt(8, 4), Is.EqualTo(CellState.Free));
        }

        [Test]
        public void Create_CountsOnlyInteriorCellsTowardsTheCapturableArea()
        {
            Grid grid = Grid.Create(10, 6);

            Assert.That(grid.InteriorCount, Is.EqualTo(8 * 4));
            Assert.That(grid.SolidInteriorCount, Is.Zero);
            Assert.That(grid.CapturedPercent, Is.Zero);
        }

        [Test]
        public void Create_RejectsGridsTooSmallToHaveAnInterior()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => Grid.Create(2, 10));
            Assert.Throws<ArgumentOutOfRangeException>(() => Grid.Create(10, 2));
        }

        [Test]
        public void IsSolid_TreatsEverythingOutsideTheGridAsSolid()
        {
            Grid grid = Grid.Create(10, 6);

            Assert.That(grid.IsSolid(-1, 2), Is.True);
            Assert.That(grid.IsSolid(10, 2), Is.True);
            Assert.That(grid.IsSolid(3, 6), Is.True);
            Assert.That(grid.IsSolid(3, 3), Is.False);
        }

        [Test]
        public void Fill_ReturnsANewGridAndLeavesTheOriginalUntouched()
        {
            Grid grid = Grid.Create(10, 6);

            Grid next = grid.Fill(new[] { 2 * 10 + 3 }, CellState.Wall);

            Assert.That(next, Is.Not.SameAs(grid));
            Assert.That(grid.CellAt(3, 2), Is.EqualTo(CellState.Free));
            Assert.That(next.CellAt(3, 2), Is.EqualTo(CellState.Wall));
            Assert.That(next.SolidInteriorCount, Is.EqualTo(1));
            Assert.That(next.Version, Is.EqualTo(grid.Version + 1));
        }

        [Test]
        public void Fill_DoesNotDoubleCountCellsThatAreAlreadySolid()
        {
            Grid grid = Grid.Create(10, 6).Fill(new[] { 23, 24 }, CellState.Wall);

            Grid next = grid.Fill(new[] { 23, 24, 25, 0, 25 }, CellState.Captured);

            Assert.That(next.SolidInteriorCount, Is.EqualTo(3));
            Assert.That(next.CellAt(3, 2), Is.EqualTo(CellState.Wall));
            Assert.That(next.CellAt(5, 2), Is.EqualTo(CellState.Captured));
        }

        [Test]
        public void Fill_ReturnsTheSameGridWhenNothingChanges()
        {
            Grid grid = Grid.Create(10, 6);

            Assert.That(grid.Fill(new[] { 0, 1, 2, -5, 999 }, CellState.Wall), Is.SameAs(grid));
        }

        [Test]
        public void CapturedPercent_ReportsTheSolidShareOfTheInterior()
        {
            Grid next = Grid.Create(12, 7).Fill(new[] { 13, 14, 15, 16, 17 }, CellState.Captured);

            Assert.That(next.CapturedPercent, Is.EqualTo(10).Within(1e-9));
        }

        [Test]
        public void CellAtIndex_TreatsIndicesOutsideTheGridAsWall()
        {
            Grid grid = Grid.Create(10, 6);

            Assert.That(grid.CellAtIndex(-1), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAtIndex(60), Is.EqualTo(CellState.Wall));
            Assert.That(grid.CellAtIndex(11), Is.EqualTo(CellState.Free));
        }
    }
}

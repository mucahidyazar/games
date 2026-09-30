using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class WallsTests
    {
        private static readonly Grid SmallGrid = Grid.Create(20, 12); // interior rows 1..10

        [Test]
        public void CreatePair_CreatesTwoZeroLengthHalvesGrowingApartFromTheTappedCell()
        {
            (WallHalf first, WallHalf second) = Walls.CreatePair(Orientation.Vertical, 5, 8, 10);

            Assert.That(first, Is.EqualTo(new WallHalf(10, Orientation.Vertical, 5, 9, -1, 0)));
            Assert.That(second, Is.EqualTo(new WallHalf(11, Orientation.Vertical, 5, 9, 1, 0)));
        }

        [Test]
        public void CreatePair_UsesTheColumnAsTheGrowthAxisForHorizontalWalls()
        {
            (WallHalf first, WallHalf second) = Walls.CreatePair(Orientation.Horizontal, 5, 8, 1);

            Assert.That((first.Line, first.Origin, first.Direction), Is.EqualTo((8, 6, -1)));
            Assert.That((second.Line, second.Origin, second.Direction), Is.EqualTo((8, 6, 1)));
        }

        [Test]
        public void Advance_GrowsFreelyWhileThePathIsClear()
        {
            (WallHalf up, _) = Walls.CreatePair(Orientation.Vertical, 5, 6, 1);

            AdvanceResult result = Walls.Advance(up, SmallGrid, 2);

            Assert.That(result.Completed, Is.False);
            Assert.That(result.Wall.Length, Is.EqualTo(2));
            Assert.That(Walls.Tip(result.Wall), Is.EqualTo(5));
        }

        [Test]
        public void Advance_StopsExactlyAtTheBorderAndReportsCompletion()
        {
            (WallHalf up, WallHalf down) = Walls.CreatePair(Orientation.Vertical, 5, 6, 1);

            AdvanceResult upResult = Walls.Advance(up, SmallGrid, 50);
            AdvanceResult downResult = Walls.Advance(down, SmallGrid, 50);

            Assert.That(upResult.Completed, Is.True);
            Assert.That(Walls.Tip(upResult.Wall), Is.EqualTo(1)); // bottom edge of the border row 0
            Assert.That(downResult.Completed, Is.True);
            Assert.That(Walls.Tip(downResult.Wall), Is.EqualTo(11)); // top edge of the border row 11
        }

        [Test]
        public void Advance_StopsAtWallsThatAlreadyExistInsideTheField()
        {
            Grid blocked = SmallGrid.Fill(new[] { 3 * 20 + 12 }, CellState.Wall); // cell (12, 3)
            (WallHalf left, WallHalf right) = Walls.CreatePair(Orientation.Horizontal, 4, 3, 1);

            AdvanceResult rightResult = Walls.Advance(right, blocked, 50);
            AdvanceResult leftResult = Walls.Advance(left, blocked, 50);

            Assert.That(rightResult.Completed, Is.True);
            Assert.That(Walls.Tip(rightResult.Wall), Is.EqualTo(12));
            Assert.That(leftResult.Completed, Is.True);
            Assert.That(Walls.Tip(leftResult.Wall), Is.EqualTo(1));
        }

        [Test]
        public void Advance_ClaimsOnlyTheTappedCellWhenTheCellBeyondIsAlreadySolid()
        {
            Grid blocked = SmallGrid.Fill(new[] { 5 * 20 + 5 }, CellState.Wall); // cell (5, 5)
            (WallHalf up, _) = Walls.CreatePair(Orientation.Vertical, 5, 6, 1);

            AdvanceResult result = Walls.Advance(up, blocked, 1.5);

            Assert.That(result.Completed, Is.True);
            Assert.That(result.Wall.Length, Is.EqualTo(1));
            Assert.That(Walls.Cells(result.Wall, 20), Is.EqualTo(new[] { 6 * 20 + 5 }));
        }

        [Test]
        public void Advance_CompletesAtZeroLengthWhenTheForwardNeighbourIsAlreadySolid()
        {
            Grid blocked = SmallGrid.Fill(new[] { 7 * 20 + 5 }, CellState.Wall); // cell (5, 7)
            (_, WallHalf down) = Walls.CreatePair(Orientation.Vertical, 5, 6, 1);

            AdvanceResult result = Walls.Advance(down, blocked, 0.5);

            Assert.That(result.Completed, Is.True);
            Assert.That(result.Wall.Length, Is.EqualTo(0));
            Assert.That(Walls.Cells(result.Wall, 20), Is.Empty);
        }

        [Test]
        public void Advance_StopsFlushAgainstItsObstacleAcrossSeveralAdvances()
        {
            (WallHalf up, _) = Walls.CreatePair(Orientation.Vertical, 5, 2, 1);

            AdvanceResult first = Walls.Advance(up, SmallGrid, 1.5);
            AdvanceResult second = Walls.Advance(first.Wall, SmallGrid, 1.5);

            Assert.That(first.Completed, Is.False);
            Assert.That(second.Completed, Is.True);
            Assert.That(Walls.Tip(second.Wall), Is.EqualTo(1));
        }

        [Test]
        public void CoveredRectAndCells_CoverTheColumnOfAVerticalWallBetweenOriginAndTip()
        {
            (_, WallHalf down) = Walls.CreatePair(Orientation.Vertical, 7, 3, 1);
            WallHalf grown = down.WithLength(2);

            Assert.That(Walls.CoveredRect(grown), Is.EqualTo(new Rect(7, 4, 8, 6)));
            Assert.That(Walls.Cells(grown, 20), Is.EqualTo(new[] { 4 * 20 + 7, 5 * 20 + 7 }));
        }

        [Test]
        public void CoveredRectAndCells_CoverTheRowOfAHorizontalWallBetweenTipAndOrigin()
        {
            (WallHalf left, _) = Walls.CreatePair(Orientation.Horizontal, 6, 2, 1);
            WallHalf grown = left.WithLength(1.5);

            Assert.That(Walls.CoveredRect(grown), Is.EqualTo(new Rect(5.5, 2, 7, 3)));
            Assert.That(Walls.Cells(grown, 20), Is.EqualTo(new[] { 2 * 20 + 5, 2 * 20 + 6 }));
        }

        [Test]
        public void Cells_CoverNothingBeforeTheWallStartsGrowing()
        {
            (WallHalf up, _) = Walls.CreatePair(Orientation.Vertical, 4, 4, 1);

            Assert.That(Walls.Cells(up, 20), Is.Empty);
        }

        [Test]
        public void PreviewExtent_SpansFromBorderToBorderAcrossAnEmptyField()
        {
            Assert.That(Walls.PreviewExtent(SmallGrid, 5, 6, Orientation.Vertical), Is.EqualTo(new Extent(1, 11)));
            Assert.That(Walls.PreviewExtent(SmallGrid, 5, 6, Orientation.Horizontal), Is.EqualTo(new Extent(1, 19)));
        }

        [Test]
        public void PreviewExtent_StopsAtWallsThatAreAlreadyBuilt()
        {
            Grid blocked = SmallGrid.Fill(new[] { 3 * 20 + 5, 3 * 20 + 12 }, CellState.Wall); // cells (5, 3) and (12, 3)

            Assert.That(Walls.PreviewExtent(blocked, 5, 6, Orientation.Vertical), Is.EqualTo(new Extent(4, 11)));
            Assert.That(Walls.PreviewExtent(blocked, 8, 3, Orientation.Horizontal), Is.EqualTo(new Extent(6, 12)));
        }

        [Test]
        public void PreviewExtent_IsNullForCellsThatCannotHoldAWall()
        {
            Assert.That(Walls.PreviewExtent(SmallGrid, 0, 6, Orientation.Vertical), Is.Null);
        }
    }
}

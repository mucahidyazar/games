using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class CaptureTests
    {
        private static Ball BallAt(double x, double y) => new Ball(1, x, y, 0, 0, 2, 0);

        private static ReadOnlyArray<Ball> BallsAt(params Ball[] balls) => ReadOnlyArray<Ball>.From(balls);

        /// <summary>22 x 12 grid (20 x 10 interior) split by a vertical wall on column 10.</summary>
        private static Grid SplitGrid() =>
            Grid.Create(22, 12).Fill(Enumerable.Range(1, 10).Select(i => i * 22 + 10).ToArray(), CellState.Wall);

        [Test]
        public void CapturesNothingWhileEveryRegionStillHoldsABall()
        {
            Grid grid = SplitGrid();

            CaptureResult result = Capture.EnclosedAreas(grid, BallsAt(BallAt(4, 5), BallAt(15, 5)));

            Assert.That(result.Captured, Is.Zero);
            Assert.That(result.Grid, Is.SameAs(grid));
            Assert.That(result.Runs.Count, Is.Zero);
            Assert.That(result.CapturedRegions, Is.Zero);
            Assert.That(result.OrbRegionSizes.ToArray(), Is.EqualTo(new[] { 90, 100 }));
        }

        [Test]
        public void FillsEveryFreeCellThatNoBallCanReach()
        {
            CaptureResult result = Capture.EnclosedAreas(SplitGrid(), BallsAt(BallAt(4, 5)));

            Assert.That(result.Captured, Is.EqualTo(10 * 10));
            Assert.That(result.CapturedRegions, Is.EqualTo(1));
            Assert.That(result.OrbRegionSizes.ToArray(), Is.EqualTo(new[] { 90 }));
            Assert.That(result.Grid.CellAt(15, 5), Is.EqualTo(CellState.Captured));
            Assert.That(result.Grid.CellAt(4, 5), Is.EqualTo(CellState.Free));
            Assert.That(result.Grid.CellAt(10, 5), Is.EqualTo(CellState.Wall));
            Assert.That(result.Grid.CapturedPercent, Is.EqualTo((10 + 100) / 200.0 * 100).Within(1e-9));
        }

        [Test]
        public void DescribesTheCapturedCellsAsHorizontalRunsForEffects()
        {
            CaptureResult result = Capture.EnclosedAreas(SplitGrid(), BallsAt(BallAt(4, 5)));

            Assert.That(result.Runs.Count, Is.EqualTo(10));
            Assert.That(result.Runs[0], Is.EqualTo(new CellRun(1, 11, 21)));
            Assert.That(result.Runs.All(run => run.Start == 11 && run.End == 21), Is.True);
        }

        [Test]
        public void DoesNotLeakThroughAWallThatOnlyTouchesDiagonally()
        {
            Grid grid = Grid.Create(22, 12).Fill(
                new[] { 4 * 22 + 1, 4 * 22 + 2, 4 * 22 + 3, 1 * 22 + 4, 2 * 22 + 4, 3 * 22 + 4 },
                CellState.Wall);

            CaptureResult result = Capture.EnclosedAreas(grid, BallsAt(BallAt(15, 8)));

            Assert.That(result.Captured, Is.EqualTo(9));
            Assert.That(result.Grid.CellAt(2, 2), Is.EqualTo(CellState.Captured));
        }

        [Test]
        public void CountsSeparateCapturedRegionsAndMeasuresTheRegionsLeftToEachOrb()
        {
            int[] walls = Enumerable.Range(1, 10).Select(i => i * 22 + 5).Concat(Enumerable.Range(1, 10).Select(i => i * 22 + 15)).ToArray();
            Grid grid = Grid.Create(22, 12).Fill(walls, CellState.Wall);

            CaptureResult result = Capture.EnclosedAreas(grid, BallsAt(BallAt(10, 5), BallAt(12, 6)));

            Assert.That(result.CapturedRegions, Is.EqualTo(2));
            Assert.That(result.Captured, Is.EqualTo(4 * 10 + 5 * 10));
            Assert.That(result.OrbRegionSizes.ToArray(), Is.EqualTo(new[] { 9 * 10 }));
        }

        [Test]
        public void GivesTheSameAnswerWhenCalledTwiceInARow()
        {
            // The flood fill reuses scratch buffers between calls; a stale buffer would change the second answer.
            Grid grid = SplitGrid();

            CaptureResult first = Capture.EnclosedAreas(grid, BallsAt(BallAt(4, 5)));
            CaptureResult second = Capture.EnclosedAreas(grid, BallsAt(BallAt(4, 5)));

            Assert.That(second.Captured, Is.EqualTo(first.Captured));
            Assert.That(second.CapturedRegions, Is.EqualTo(first.CapturedRegions));
            Assert.That(Fixtures.GridHash(second.Grid), Is.EqualTo(Fixtures.GridHash(first.Grid)));
        }
    }
}

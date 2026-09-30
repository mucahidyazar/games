using System;

namespace TrapTheOrb.Engine
{
    /// <summary>One playing tick: orbs move, walls grow, finish (capturing area) or break (costing a life).</summary>
    internal static class Simulation
    {
        private const double PercentScale = 100;

        public static GameState Simulate(GameState state, Game.EventSink events)
        {
            GameState moved = Game.MoveAllBalls(state, Constants.TickSeconds);
            Grid grid = moved.Grid;
            long score = moved.Score;
            RunStats stats = moved.Stats;
            int wallCount = moved.Walls.Count;
            WallHalf[] growing = wallCount > 0 ? new WallHalf[wallCount] : Array.Empty<WallHalf>();
            int growingCount = 0;
            int brokenCount = 0;
            WallHalf[] broken = wallCount > 0 ? new WallHalf[wallCount] : Array.Empty<WallHalf>();
            int[] brokenBy = wallCount > 0 ? new int[wallCount] : Array.Empty<int>();

            foreach (WallHalf wall in moved.Walls)
            {
                AdvanceResult advanced = Walls.Advance(wall, grid, moved.Config.WallSpeed * Constants.TickSeconds);

                if (FindHit(moved.Balls, advanced.Wall) is Ball hit)
                {
                    broken[brokenCount] = advanced.Wall;
                    brokenBy[brokenCount] = hit.Id;
                    brokenCount++;
                    continue;
                }
                if (!advanced.Completed)
                {
                    growing[growingCount++] = advanced.Wall;
                    continue;
                }

                (grid, score, stats) = CompleteWall(moved, advanced.Wall, grid, score, stats, events);
            }

            int lives = moved.Lives;
            int levelLivesLost = moved.LevelLivesLost;
            // Both halves breaking in the same instant (an orb right at the tap) is one mistake: one life.
            if (brokenCount > 0)
            {
                levelLivesLost += 1;
                if (moved.Rules.LivesPolicy != LivesPolicy.Infinite) lives = Math.Max(0, lives - 1);
                stats = Stats.AfterWallsBroken(stats, brokenCount);
                for (int index = 0; index < brokenCount; index++)
                {
                    events.Add(new WallBrokenEvent(broken[index], brokenBy[index], lives));
                }
            }

            return moved with
            {
                Grid = grid,
                Score = score,
                Stats = stats,
                Lives = lives,
                LevelLivesLost = levelLivesLost,
                Walls = growingCount == 0 ? ReadOnlyArray<WallHalf>.Empty : ReadOnlyArray<WallHalf>.Wrap(Trim(growing, growingCount)),
                LevelTicks = moved.LevelTicks + 1,
                Tick = moved.Tick + 1,
            };
        }

        private static (Grid, long, RunStats) CompleteWall(GameState moved, WallHalf wall, Grid grid, long score, RunStats stats, Game.EventSink events)
        {
            int solidBefore = grid.SolidInteriorCount;
            Grid walled = grid.Fill(Walls.Cells(wall, grid.Cols), CellState.Wall);
            CaptureResult capture = Capture.EnclosedAreas(walled, moved.Balls);
            Grid next = capture.Grid;

            double percentGained = (double)(next.SolidInteriorCount - solidBefore) / next.InteriorCount * PercentScale;
            long points = Scoring.CapturePoints(percentGained, moved.Level);
            int? smallestRegion = Smallest(capture.OrbRegionSizes);
            double? tightestRegionPct = smallestRegion is int smallest ? (double)smallest / next.InteriorCount * PercentScale : (double?)null;

            RunStats nextStats = Stats.AfterCapture(stats, new CaptureMoment(percentGained, capture.CapturedRegions, tightestRegionPct));
            events.Add(new WallCompletedEvent(
                wall,
                walled.SolidInteriorCount - solidBefore,
                capture.Captured,
                capture.CapturedRegions,
                percentGained,
                points,
                capture.Runs));
            return (next, score + points, nextStats);
        }

        private static Ball? FindHit(ReadOnlyArray<Ball> balls, WallHalf wall)
        {
            if (wall.Length <= 0) return null;
            Rect rect = Walls.CoveredRect(wall);
            foreach (Ball ball in balls)
            {
                if (Geometry.CircleIntersectsRect(ball.X, ball.Y, ball.Radius, rect)) return ball;
            }
            return null;
        }

        private static int? Smallest(ReadOnlyArray<int> values)
        {
            if (values.Count == 0) return null;
            int smallest = values[0];
            for (int index = 1; index < values.Count; index++) smallest = Math.Min(smallest, values[index]);
            return smallest;
        }

        private static WallHalf[] Trim(WallHalf[] walls, int count)
        {
            if (count == walls.Length) return walls;
            var trimmed = new WallHalf[count];
            Array.Copy(walls, trimmed, count);
            return trimmed;
        }
    }
}

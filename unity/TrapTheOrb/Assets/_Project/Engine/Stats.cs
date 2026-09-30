using System;

namespace TrapTheOrb.Engine
{
    /// <summary>Share of the field claimed by one wall, its separate regions, and the smallest pocket left to an orb.</summary>
    public sealed record CaptureMoment(double PercentGained, int CapturedRegions, double? TightestRegionPct);

    public sealed record LevelClear(double Percent, long ElapsedMs, int ParSeconds, int LivesLost, int WallsUsed, int OrbCount);

    public static class Stats
    {
        public static readonly RunStats Empty = new RunStats(0, 1, 0, 0, null, 0, null, 0, 0, null, 0, null);

        /// <summary>Levels need at least this many orbs before "fewest walls" counts — one orb is too easy to box in.</summary>
        private const int MinOrbsForWallRecord = 3;

        private const double MillisecondsPerSecond = 1000;

        private static double? Lowest(double? current, double? candidate) =>
            candidate == null ? current : current == null ? candidate : Math.Min(current.Value, candidate.Value);

        private static int? Lowest(int? current, int? candidate) =>
            candidate == null ? current : current == null ? candidate : Math.Min(current.Value, candidate.Value);

        public static RunStats AfterLevelStart(RunStats stats, int level) =>
            level > stats.HighestLevel ? stats with { HighestLevel = level } : stats;

        public static RunStats AfterWallStarted(RunStats stats) => stats with { WallsBuilt = stats.WallsBuilt + 1 };

        public static RunStats AfterWallsBroken(RunStats stats, int halves) => stats with { WallsBroken = stats.WallsBroken + halves };

        public static RunStats AfterCapture(RunStats stats, CaptureMoment moment) => stats with
        {
            BiggestCapturePct = Math.Max(stats.BiggestCapturePct, moment.PercentGained),
            MaxRegionsInOneWall = Math.Max(stats.MaxRegionsInOneWall, moment.CapturedRegions),
            TightestTrapPct = Lowest(stats.TightestTrapPct, moment.TightestRegionPct),
        };

        public static RunStats AfterLevelClear(RunStats stats, LevelClear clear)
        {
            int perfectStreak = clear.LivesLost == 0 ? stats.PerfectStreak + 1 : 0;
            double? ratio = clear.ParSeconds > 0 ? clear.ElapsedMs / (clear.ParSeconds * MillisecondsPerSecond) : (double?)null;

            return stats with
            {
                LevelsCleared = stats.LevelsCleared + 1,
                BestClearPct = stats.BestClearPct == null ? clear.Percent : Math.Max(stats.BestClearPct.Value, clear.Percent),
                PerfectStreak = perfectStreak,
                BestPerfectStreak = Math.Max(stats.BestPerfectStreak, perfectStreak),
                FastestClearRatio = Lowest(stats.FastestClearRatio, ratio),
                FewestWallsClear = clear.OrbCount >= MinOrbsForWallRecord
                    ? Lowest(stats.FewestWallsClear, clear.WallsUsed)
                    : stats.FewestWallsClear,
            };
        }
    }
}

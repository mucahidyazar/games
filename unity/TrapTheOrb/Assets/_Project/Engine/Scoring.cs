using System;

namespace TrapTheOrb.Engine
{
    public static class Scoring
    {
        private const double MillisecondsPerSecond = 1000;

        /// <summary>Points for newly claimed area: 10 per percent, multiplied by the level.</summary>
        public static long CapturePoints(double percentGained, int level) =>
            (long)JsMath.Round(percentGained * Constants.PointsPerPercent) * level;

        /// <summary>Level time in whole milliseconds.</summary>
        public static long TicksToMs(int ticks) => (long)JsMath.Round(ticks * MillisecondsPerSecond / Constants.TicksPerSecond);

        /// <summary>
        /// End-of-level payout for extra territory, remaining lives, speed and — in Limited Walls — unused walls.
        /// </summary>
        public static LevelResult ComputeLevelResult(LevelOutcome outcome)
        {
            LevelConfig config = outcome.Config;
            int level = config.Level;
            int elapsedSeconds = outcome.LevelTicks / Constants.TicksPerSecond;
            int secondsLeft = config.TimeLimitTicks is int limit
                ? Math.Max(0, FloorDiv(limit - outcome.LevelTicks, Constants.TicksPerSecond))
                : Math.Max(0, config.ParSeconds - elapsedSeconds);

            long areaBonus = (long)Math.Max(0, (int)Math.Floor(outcome.Percent) - config.TargetPercent) * Constants.AreaBonusPerPercent * level;
            long livesBonus = outcome.Rules.LivesPolicy == LivesPolicy.Infinite
                ? 0
                : (long)Math.Max(0, outcome.LivesLeft) * Constants.LifeBonus * level;
            long timeBonus = (long)secondsLeft * Constants.TimeBonusPerSecond * level;
            long wallBonus = outcome.WallsLeft is int walls ? (long)Math.Max(0, walls) * Constants.WallBonus * level : 0;

            return new LevelResult(
                level,
                outcome.Percent,
                TicksToMs(outcome.LevelTicks),
                outcome.LivesLeft,
                outcome.WallsLeft,
                areaBonus,
                livesBonus,
                timeBonus,
                wallBonus,
                areaBonus + livesBonus + timeBonus + wallBonus);
        }

        /// <summary>Math.floor of a division, also for negative numerators (C# division truncates towards zero).</summary>
        private static int FloorDiv(int numerator, int denominator) => (int)Math.Floor((double)numerator / denominator);
    }

    public sealed record LevelOutcome(
        LevelConfig Config,
        ModeRules Rules,
        double Percent,
        int LevelTicks,
        int LivesLeft,
        int? WallsLeft);
}

using System;

namespace TrapTheOrb.Engine
{
    /// <summary>Orb line-up of a Classic level and what changed compared with the previous level.</summary>
    public sealed record LevelPlan(ReadOnlyArray<int> OrbTiers, LevelChange Change);

    /// <summary>
    /// The Classic progression is a sawtooth that rises over time:
    /// a stage with n orbs starts with every orb at the stage's base speed, then speeds orbs up one tier at a time
    /// (two at a time from five orbs). When all of them are faster, the next stage adds an orb; if the base speed
    /// stays the same, everyone calms down again — a breather level. Base speed rises with the orb count: calm up to
    /// 3 orbs, quick up to 6, fast beyond — so every stage starts harder than the previous one.
    /// </summary>
    public static class Levels
    {
        /// <summary>Highest level we plan for; later levels repeat its difficulty.</summary>
        public const int MaxLevel = 9999;

        private static int BaseTierFor(int orbs) => orbs <= 3 ? 0 : orbs <= 6 ? 1 : 2;

        private static int PromotionsPerLevel(int orbs) => orbs >= 5 ? 2 : 1;

        private static int StageLength(int orbs) =>
            orbs == 1 ? 1 : 1 + (int)Math.Ceiling((double)orbs / PromotionsPerLevel(orbs));

        private static int Normalize(int level) => Math.Min(MaxLevel, Math.Max(1, level));

        private static int[] TiersFor(int level)
        {
            int remaining = level - 1;
            int orbs = 1;
            while (remaining >= StageLength(orbs))
            {
                remaining -= StageLength(orbs);
                orbs++;
            }

            int baseTier = BaseTierFor(orbs);
            int promoted = Math.Min(orbs, remaining * PromotionsPerLevel(orbs));
            var tiers = new int[orbs];
            for (int index = 0; index < orbs; index++)
            {
                tiers[index] = Math.Min(Constants.MaxSpeedTier, index < promoted ? baseTier + 1 : baseTier);
            }
            return tiers;
        }

        public static LevelPlan Plan(int level)
        {
            int safeLevel = Normalize(level);
            int[] orbTiers = TiersFor(safeLevel);
            if (safeLevel == 1) return new LevelPlan(ReadOnlyArray<int>.Wrap(orbTiers), LevelChange.First);

            int[] previous = TiersFor(safeLevel - 1);
            if (orbTiers.Length == previous.Length) return new LevelPlan(ReadOnlyArray<int>.Wrap(orbTiers), LevelChange.SpeedUp);

            bool slowedDown = false;
            for (int index = 0; index < previous.Length; index++)
            {
                int now = index < orbTiers.Length ? orbTiers[index] : 0;
                if (previous[index] > now) slowedDown = true;
            }
            return new LevelPlan(ReadOnlyArray<int>.Wrap(orbTiers), slowedDown ? LevelChange.Breather : LevelChange.NewOrb);
        }

        /// <summary>Colour tier for an arbitrary speed multiplier (Custom mode).</summary>
        public static int TierForSpeed(double multiplier)
        {
            int tier = 0;
            ReadOnlyArray<double> thresholds = Constants.SpeedTiers;
            for (int index = 0; index < thresholds.Count; index++)
            {
                if (multiplier >= thresholds[index]) tier = index;
            }
            return tier;
        }

        private static int ParFor(int orbCount) => Constants.ParBaseSeconds + Constants.ParSecondsPerOrb * orbCount;

        private static LevelConfig CustomConfig(int level, ModeRules rules)
        {
            CustomSettings custom = rules.Custom ?? throw new InvalidOperationException("Custom rules need custom settings");
            int tier = TierForSpeed(custom.Speed);
            var tiers = new int[custom.OrbCount];
            var speeds = new double[custom.OrbCount];
            for (int index = 0; index < custom.OrbCount; index++)
            {
                tiers[index] = tier;
                speeds[index] = Constants.BaseBallSpeed * custom.Speed;
            }

            return new LevelConfig(
                level,
                custom.OrbCount,
                ReadOnlyArray<int>.Wrap(tiers),
                ReadOnlyArray<double>.Wrap(speeds),
                custom.Lives ?? custom.OrbCount + 1,
                custom.Walls,
                custom.TimeLimitSeconds * Constants.TicksPerSecond,
                Constants.WallSpeed,
                custom.TargetPercent,
                ParFor(custom.OrbCount),
                level == 1 ? LevelChange.First : LevelChange.Repeat);
        }

        /// <summary>Everything a level needs: the orb line-up plus the limits of the current mode.</summary>
        public static LevelConfig ConfigFor(int level, ModeRules rules)
        {
            int safeLevel = Normalize(level);
            if (rules.Custom != null) return CustomConfig(safeLevel, rules);

            LevelPlan plan = Plan(safeLevel);
            int orbCount = plan.OrbTiers.Count;
            var speeds = new double[orbCount];
            for (int index = 0; index < orbCount; index++)
            {
                speeds[index] = Constants.BaseBallSpeed * Constants.SpeedMultiplier(plan.OrbTiers[index]);
            }

            return new LevelConfig(
                safeLevel,
                orbCount,
                plan.OrbTiers,
                ReadOnlyArray<double>.Wrap(speeds),
                rules.LivesPolicy == LivesPolicy.PerRun ? rules.RunLives : orbCount + 1,
                rules.LimitedWalls ? Constants.WallBudgetBase + Constants.WallBudgetPerOrb * orbCount : (int?)null,
                rules.Timed ? (Constants.TimeLimitBaseSeconds + Constants.TimeLimitSecondsPerOrb * orbCount) * Constants.TicksPerSecond : (int?)null,
                Constants.WallSpeed,
                Constants.TargetPercent,
                ParFor(orbCount),
                plan.Change);
        }
    }
}

using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    public enum BadgeId
    {
        Climber,
        Squeeze,
        LandGrab,
        Overachiever,
        Flawless,
        Lightning,
        DoubleTrap,
        Architect,
        Survivor,
        BeatTheClock,
        Frugal,
        Devotee,
    }

    public enum BadgeDirection
    {
        /// <summary>Higher values are better.</summary>
        AtLeast,

        /// <summary>Lower values are better.</summary>
        AtMost,
    }

    /// <summary>'Run' badges come from a single run's stats; 'account' badges are computed by the server.</summary>
    public enum BadgeSource
    {
        Run,
        Account,
    }

    /// <summary>A badge; <see cref="Modes"/> null means every ranked mode counts.</summary>
    public sealed record BadgeDefinition(
        BadgeId Id,
        BadgeDirection Direction,
        ReadOnlyArray<double> Thresholds,
        ReadOnlyArray<GameMode>? Modes,
        BadgeSource Source,
        Func<RunStats, double?> Metric);

    /// <summary>Tier 1 bronze, 2 silver, 3 gold.</summary>
    public readonly struct EarnedBadge : IEquatable<EarnedBadge>
    {
        public EarnedBadge(BadgeId id, int tier)
        {
            Id = id;
            Tier = tier;
        }

        public BadgeId Id { get; }
        public int Tier { get; }

        public bool Equals(EarnedBadge other) => Id == other.Id && Tier == other.Tier;

        public override bool Equals(object obj) => obj is EarnedBadge other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Id, Tier);

        public override string ToString() => $"{Id} tier {Tier}";
    }

    public static class Badges
    {
        private static readonly string[] Ids =
        {
            "climber", "squeeze", "landGrab", "overachiever", "flawless", "lightning", "doubleTrap", "architect", "survivor",
            "beatTheClock", "frugal", "devotee",
        };

        private static ReadOnlyArray<double> Thresholds(double bronze, double silver, double gold) =>
            ReadOnlyArray<double>.From(new[] { bronze, silver, gold });

        private static ReadOnlyArray<GameMode>? Only(GameMode mode) => ReadOnlyArray<GameMode>.From(new[] { mode });

        /// <summary>Badges are only awarded in ranked modes, so Custom and Zen cannot be farmed.</summary>
        public static readonly ReadOnlyArray<BadgeDefinition> All = ReadOnlyArray<BadgeDefinition>.From(new[]
        {
            new BadgeDefinition(BadgeId.Climber, BadgeDirection.AtLeast, Thresholds(5, 10, 20), null, BadgeSource.Run, s => s.HighestLevel),
            new BadgeDefinition(BadgeId.Squeeze, BadgeDirection.AtMost, Thresholds(3, 1.5, 0.75), null, BadgeSource.Run, s => s.TightestTrapPct),
            new BadgeDefinition(BadgeId.LandGrab, BadgeDirection.AtLeast, Thresholds(25, 40, 60), null, BadgeSource.Run, s => s.BiggestCapturePct),
            new BadgeDefinition(BadgeId.Overachiever, BadgeDirection.AtLeast, Thresholds(90, 95, 99), null, BadgeSource.Run, s => s.BestClearPct),
            new BadgeDefinition(BadgeId.Flawless, BadgeDirection.AtLeast, Thresholds(1, 3, 5), null, BadgeSource.Run, s => s.BestPerfectStreak),
            new BadgeDefinition(BadgeId.Lightning, BadgeDirection.AtMost, Thresholds(0.6, 0.45, 0.3), null, BadgeSource.Run, s => s.FastestClearRatio),
            new BadgeDefinition(BadgeId.DoubleTrap, BadgeDirection.AtLeast, Thresholds(2, 3, 4), null, BadgeSource.Run, s => s.MaxRegionsInOneWall),
            new BadgeDefinition(BadgeId.Architect, BadgeDirection.AtMost, Thresholds(6, 4, 3), null, BadgeSource.Run, s => s.FewestWallsClear),
            new BadgeDefinition(BadgeId.Survivor, BadgeDirection.AtLeast, Thresholds(3, 6, 10), Only(GameMode.Hardcore), BadgeSource.Run, s => s.HighestLevel),
            new BadgeDefinition(BadgeId.BeatTheClock, BadgeDirection.AtLeast, Thresholds(5, 10, 15), Only(GameMode.TimeAttack), BadgeSource.Run, s => s.HighestLevel),
            new BadgeDefinition(BadgeId.Frugal, BadgeDirection.AtLeast, Thresholds(5, 10, 15), Only(GameMode.LimitedWalls), BadgeSource.Run, s => s.HighestLevel),
            new BadgeDefinition(BadgeId.Devotee, BadgeDirection.AtLeast, Thresholds(3, 7, 30), Only(GameMode.Daily), BadgeSource.Account, _ => null),
        });

        public static string Id(this BadgeId badge) => Ids[(int)badge];

        public static BadgeDefinition ById(BadgeId id)
        {
            foreach (BadgeDefinition badge in All)
            {
                if (badge.Id == id) return badge;
            }
            throw new ArgumentOutOfRangeException(nameof(id), $"Unknown badge: {id}");
        }

        /// <summary>Highest tier a value reaches (0 when it reaches none).</summary>
        public static int TierFor(BadgeDefinition badge, double? value)
        {
            if (value is not double number || !JsMath.IsFinite(number)) return 0;
            int tier = 0;
            for (int index = 0; index < badge.Thresholds.Count; index++)
            {
                double threshold = badge.Thresholds[index];
                bool reached = badge.Direction == BadgeDirection.AtLeast ? number >= threshold : number <= threshold;
                if (reached) tier = index + 1;
            }
            return tier;
        }

        private static bool CountsIn(BadgeDefinition badge, GameMode mode)
        {
            if (badge.Modes is not ReadOnlyArray<GameMode> modes) return Engine.Modes.IsRanked(mode);
            foreach (GameMode candidate in modes)
            {
                if (candidate == mode) return true;
            }
            return false;
        }

        /// <summary>Badges a finished run earns, at the highest tier it reached.</summary>
        public static IReadOnlyList<EarnedBadge> EvaluateRun(RunStats stats, GameMode mode)
        {
            var earned = new List<EarnedBadge>();
            if (!Engine.Modes.IsRanked(mode)) return earned;

            foreach (BadgeDefinition badge in All)
            {
                if (badge.Source != BadgeSource.Run || !CountsIn(badge, mode)) continue;
                int tier = TierFor(badge, badge.Metric(stats));
                if (tier > 0) earned.Add(new EarnedBadge(badge.Id, tier));
            }
            return earned;
        }
    }
}

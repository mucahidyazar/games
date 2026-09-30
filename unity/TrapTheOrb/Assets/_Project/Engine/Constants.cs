namespace TrapTheOrb.Engine
{
    /// <summary>
    /// Tuning values of the game. They must stay identical to packages/trap-the-orb-engine/src/constants.ts:
    /// the parity tests replay runs recorded with the TypeScript engine.
    /// </summary>
    public static class Constants
    {
        /// <summary>Every run uses the same field: 300 × 150 cells, or that field turned on its side for portrait screens.</summary>
        public const int FieldLongSide = 300;
        public const int FieldShortSide = 150;

        /// <summary>Orb radius in cells (≈ 2.2% of the short side).</summary>
        public const double BallRadius = 3.3;

        /// <summary>Orb speed per axis at the calm tier, in cells per second.</summary>
        public const double BaseBallSpeed = 50;

        /// <summary>Highest speed tier: calm (0), quick, fast, blazing (3).</summary>
        public const int MaxSpeedTier = 3;

        /// <summary>Wall growth speed in cells per second.</summary>
        public const double WallSpeed = 105;

        public const int TargetPercent = 75;

        /// <summary>The simulation advances in fixed ticks, so a recorded run can be replayed exactly.</summary>
        public const int TicksPerSecond = 120;
        public const double TickSeconds = 1.0 / TicksPerSecond;

        public const int PointsPerPercent = 10;
        public const int AreaBonusPerPercent = 50;
        public const int LifeBonus = 100;
        public const int TimeBonusPerSecond = 5;

        /// <summary>Limited Walls: bonus per wall left unused when the level is cleared.</summary>
        public const int WallBonus = 50;

        public const int ParBaseSeconds = 20;
        public const int ParSecondsPerOrb = 10;

        /// <summary>Time Attack: countdown per level.</summary>
        public const int TimeLimitBaseSeconds = 30;
        public const int TimeLimitSecondsPerOrb = 15;

        /// <summary>Limited Walls: walls available per level.</summary>
        public const int WallBudgetBase = 4;
        public const int WallBudgetPerOrb = 2;

        /// <summary>Hardcore: lives for the entire run.</summary>
        public const int HardcoreLives = 1;

        private static readonly double[] SpeedTierMultipliers = { 1, 1.2, 1.4, 1.6 };

        /// <summary>Speed multipliers of the orb tiers: calm, quick, fast, blazing.</summary>
        public static ReadOnlyArray<double> SpeedTiers => ReadOnlyArray<double>.Wrap(SpeedTierMultipliers);

        /// <summary>Multiplier of a tier; unknown tiers move at the calm speed.</summary>
        public static double SpeedMultiplier(int tier) =>
            tier >= 0 && tier < SpeedTierMultipliers.Length ? SpeedTierMultipliers[tier] : 1;
    }
}

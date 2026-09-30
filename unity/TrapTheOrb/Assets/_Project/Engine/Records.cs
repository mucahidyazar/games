namespace TrapTheOrb.Engine
{
    /// <summary>Player-made rules for the unranked Custom mode. Null limits mean "unlimited".</summary>
    public sealed record CustomSettings(
        int OrbCount,
        double Speed,
        int? Lives,
        int? Walls,
        int? TimeLimitSeconds,
        int TargetPercent);

    public sealed record ModeRules(
        GameMode Mode,
        bool Ranked,
        LivesPolicy LivesPolicy,
        int RunLives,
        bool Timed,
        bool LimitedWalls,
        CustomSettings Custom);

    /// <summary>Everything a level needs: the orb line-up plus the limits of the current mode.</summary>
    public sealed record LevelConfig(
        int Level,
        int OrbCount,
        ReadOnlyArray<int> OrbTiers,
        ReadOnlyArray<double> OrbSpeeds,
        int Lives,
        int? WallBudget,
        int? TimeLimitTicks,
        double WallSpeed,
        int TargetPercent,
        int ParSeconds,
        LevelChange Change);

    /// <summary>End-of-level payout.</summary>
    public sealed record LevelResult(
        int Level,
        double Percent,
        long ElapsedMs,
        int LivesLeft,
        int? WallsLeft,
        long AreaBonus,
        long LivesBonus,
        long TimeBonus,
        long WallBonus,
        long TotalBonus);

    /// <summary>Notable moments of a run, used for badges and records.</summary>
    public sealed record RunStats(
        int LevelsCleared,
        int HighestLevel,
        int WallsBuilt,
        int WallsBroken,
        double? TightestTrapPct,
        double BiggestCapturePct,
        double? BestClearPct,
        int PerfectStreak,
        int BestPerfectStreak,
        double? FastestClearRatio,
        int MaxRegionsInOneWall,
        int? FewestWallsClear);

    /// <summary>The complete state of a run. Engine functions always return a new state.</summary>
    public sealed record GameState
    {
        public GameStatus Status { get; init; }
        public ModeRules Rules { get; init; }
        public FieldOrientation Field { get; init; }
        public int Level { get; init; }
        public LevelConfig Config { get; init; }
        public int Lives { get; init; }
        public long Score { get; init; }

        /// <summary>Score when the current level began — restored by "restart level".</summary>
        public long LevelStartScore { get; init; }

        /// <summary>Ticks simulated in the current level.</summary>
        public int LevelTicks { get; init; }

        /// <summary>Ticks simulated since the run started; recorded inputs refer to it.</summary>
        public int Tick { get; init; }

        public Grid Grid { get; init; }
        public ReadOnlyArray<Ball> Balls { get; init; }

        /// <summary>Orb positions when the level was built — where play starts from.</summary>
        public ReadOnlyArray<Ball> SpawnBalls { get; init; }

        /// <summary>Wall halves currently under construction (0–2).</summary>
        public ReadOnlyArray<WallHalf> Walls { get; init; }

        /// <summary>Walls left in this level, or null when unlimited.</summary>
        public int? WallsLeft { get; init; }

        public int LevelLivesLost { get; init; }
        public int LevelWallsUsed { get; init; }
        public uint RngSeed { get; init; }
        public int NextId { get; init; }
        public RunStats Stats { get; init; }
        public LevelResult LastResult { get; init; }
        public GameOverReason? GameOverReason { get; init; }
    }
}

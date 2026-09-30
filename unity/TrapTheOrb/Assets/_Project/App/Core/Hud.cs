using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Core
{
    /// <summary>The game as the UI shows it; <see cref="Loading"/> until the board has a size.</summary>
    public enum HudStatus
    {
        Loading,
        Ready,
        Playing,
        Paused,
        LevelComplete,
        GameOver,
    }

    public sealed record NextLevelPreview(int Level, ReadOnlyArray<int> OrbTiers, LevelChange Change);

    /// <summary>Everything the UI needs to know about the game, as one immutable value (GameController.ts HudSnapshot).</summary>
    public sealed record HudSnapshot
    {
        public HudStatus Status { get; init; } = HudStatus.Loading;
        public GameMode Mode { get; init; } = GameMode.Classic;

        /// <summary>The mode has fixed rules (and can reach leaderboards on the web).</summary>
        public bool RankedMode { get; init; } = true;

        /// <summary>A real run is in progress, as opposed to the ready-screen preview.</summary>
        public bool InRun { get; init; }

        public int Level { get; init; } = 1;
        public int OrbCount { get; init; } = 1;
        public ReadOnlyArray<int> OrbTiers { get; init; } = ReadOnlyArray<int>.From(new[] { 0 });

        /// <summary>Speed of the fastest orb relative to a calm orb.</summary>
        public double TopSpeedFactor { get; init; } = 1;
        public double MaxSpeedFactor { get; init; } = Constants.SpeedMultiplier(Constants.MaxSpeedTier);

        public int Lives { get; init; } = 2;
        public int MaxLives { get; init; } = 2;
        public bool InfiniteLives { get; init; }
        public long Score { get; init; }

        /// <summary>Captured area, floored to a whole percent.</summary>
        public int Percent { get; init; }
        public int TargetPercent { get; init; } = Constants.TargetPercent;

        /// <summary>Level time, rounded down to whole seconds.</summary>
        public long ElapsedMs { get; init; }

        /// <summary>Countdown left in timed modes (whole seconds), otherwise null.</summary>
        public long? TimeLeftMs { get; init; }

        public int? WallsLeft { get; init; }
        public int? WallBudget { get; init; }
        public Orientation Orientation { get; init; } = Orientation.Vertical;
        public LevelResult LastResult { get; init; }
        public NextLevelPreview NextLevel { get; init; }
        public GameOverReason? GameOverReason { get; init; }

        /// <summary>Latest message for screen readers.</summary>
        public string Announcement { get; init; } = string.Empty;

        public bool IsRunActive => InRun && Status != HudStatus.GameOver;
    }

    /// <summary>A controller event on top of the engine's: a run or a level began.</summary>
    public sealed record RunStartedEvent(GameMode Mode, int Level, long Score) : GameEvent;

    public sealed record LevelStartedEvent(int Level, long Score) : GameEvent;

    /// <summary>What the server needs to replay the current run.</summary>
    public sealed record RunRecording(
        GameMode Mode,
        CustomSettings Custom,
        FieldOrientation Field,
        uint Seed,
        ReadOnlyArray<RunInput> Inputs,
        int EndTick,
        long Score,
        int Level);
}

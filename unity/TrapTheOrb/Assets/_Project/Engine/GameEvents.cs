using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    /// <summary>Something that happened during a step; the UI turns events into sounds and effects.</summary>
    public abstract record GameEvent;

    public sealed record WallStartedEvent(Orientation Orientation, int Col, int Row, int? WallsLeft) : GameEvent;

    public sealed record WallRejectedEvent(WallRejectReason Reason) : GameEvent;

    /// <summary>A wall half finished; <see cref="CapturedRegions"/> counts the separate regions it captured.</summary>
    public sealed record WallCompletedEvent(
        WallHalf Wall,
        int WallCells,
        int CapturedCells,
        int CapturedRegions,
        double PercentGained,
        long Points,
        ReadOnlyArray<CellRun> Runs) : GameEvent;

    public sealed record WallBrokenEvent(WallHalf Wall, int BallId, int LivesLeft) : GameEvent;

    public sealed record LevelCompleteEvent(LevelResult Result) : GameEvent;

    public sealed record GameOverEvent(int Level, long Score, GameOverReason Reason) : GameEvent;

    /// <summary>The state after a step, and what happened on the way.</summary>
    public readonly struct StepResult
    {
        private static readonly IReadOnlyList<GameEvent> NoEvents = Array.Empty<GameEvent>();

        public StepResult(GameState state, IReadOnlyList<GameEvent> events)
        {
            State = state;
            Events = events ?? NoEvents;
        }

        public GameState State { get; }
        public IReadOnlyList<GameEvent> Events { get; }

        public static StepResult Quiet(GameState state) => new StepResult(state, NoEvents);
    }
}

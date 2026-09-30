using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    /// <summary>One accepted wall placement: tick, column, row, orientation. Kept short for small payloads.</summary>
    public readonly struct RunInput : IEquatable<RunInput>
    {
        public RunInput(int tick, int col, int row, Orientation orientation)
        {
            Tick = tick;
            Col = col;
            Row = row;
            Orientation = orientation;
        }

        public int Tick { get; }
        public int Col { get; }
        public int Row { get; }
        public Orientation Orientation { get; }

        public bool Equals(RunInput other) => Tick == other.Tick && Col == other.Col && Row == other.Row && Orientation == other.Orientation;

        public override bool Equals(object obj) => obj is RunInput other && Equals(other);

        public override int GetHashCode() => HashCode.Combine(Tick, Col, Row, Orientation);
    }

    /// <summary>A recorded run; <c>EndTick</c> is the tick at which the player stopped (game over or leaving the run).</summary>
    public sealed record ReplayRequest(
        GameMode Mode,
        uint Seed,
        FieldOrientation Field,
        CustomSettings Custom,
        ReadOnlyArray<RunInput> Inputs,
        int EndTick);

    public sealed record ReplayResult(
        GameStatus Status,
        GameOverReason? GameOverReason,
        long Score,
        int Level,
        int LevelsCleared,
        RunStats Stats,
        int Tick,
        int AcceptedInputs);

    public enum ReplayErrorCode
    {
        Order,
        Range,
        TooLong,
    }

    public sealed class ReplayException : Exception
    {
        public ReplayException(ReplayErrorCode code, string message) : base(message)
        {
            Code = code;
        }

        public ReplayErrorCode Code { get; }
    }

    public static class Replay
    {
        /// <summary>Longest run the server will replay: three hours of play.</summary>
        public const int MaxRunTicks = 3 * 60 * 60 * Constants.TicksPerSecond;

        private static void Validate(ReplayRequest request)
        {
            if (request.EndTick < 0) throw new ReplayException(ReplayErrorCode.Range, "endTick must be a non-negative whole number");
            if (request.EndTick > MaxRunTicks) throw new ReplayException(ReplayErrorCode.TooLong, "The run is longer than the replay limit");

            GridDims dims = Field.Dims(request.Field);
            int previousTick = 0;
            for (int index = 0; index < request.Inputs.Count; index++)
            {
                RunInput input = request.Inputs[index];
                string where = $"input {index}";
                if (input.Tick < 0 || input.Tick > request.EndTick) throw new ReplayException(ReplayErrorCode.Range, $"{where}: tick outside the run");
                if (input.Tick < previousTick) throw new ReplayException(ReplayErrorCode.Order, $"{where}: inputs must be in tick order");
                bool inField = input.Col >= 0 && input.Row >= 0 && input.Col < dims.Cols && input.Row < dims.Rows;
                if (!inField) throw new ReplayException(ReplayErrorCode.Range, $"{where}: cell outside the field");
                previousTick = input.Tick;
            }
        }

        /// <summary>
        /// Re-plays a recorded run from its seed and inputs — the same way it was played — and returns the
        /// authoritative result. Throws <see cref="ReplayException"/> for malformed recordings.
        /// </summary>
        public static ReplayResult Run(ReplayRequest request)
        {
            Validate(request);
            GameState state = Game.StartGame(Game.CreateRun(new CreateRunOptions(request.Mode, request.Seed)
            {
                Field = request.Field,
                Custom = request.Custom,
            }));
            int next = 0;
            int acceptedInputs = 0;

            while (state.Status != GameStatus.GameOver)
            {
                if (state.Status == GameStatus.LevelComplete)
                {
                    // The player moved on (or left) here; we only continue if they played on.
                    if (state.Tick >= request.EndTick) break;
                    state = Game.AdvanceToNextLevel(state);
                    continue;
                }

                while (next < request.Inputs.Count && request.Inputs[next].Tick == state.Tick)
                {
                    RunInput input = request.Inputs[next];
                    StepResult placed = Game.PlaceWall(state, input.Col, input.Row, input.Orientation);
                    if (Started(placed.Events)) acceptedInputs++;
                    state = placed.State;
                    next++;
                }

                if (state.Tick >= request.EndTick) break;
                state = Game.Tick(state).State;
            }

            return new ReplayResult(state.Status, state.GameOverReason, state.Score, state.Level, state.Stats.LevelsCleared,
                state.Stats, state.Tick, acceptedInputs);
        }

        private static bool Started(IReadOnlyList<GameEvent> events)
        {
            for (int index = 0; index < events.Count; index++)
            {
                if (events[index] is WallStartedEvent) return true;
            }
            return false;
        }
    }
}

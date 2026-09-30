using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    public sealed record CreateRunOptions(GameMode Mode, uint Seed)
    {
        public FieldOrientation Field { get; init; } = FieldOrientation.Landscape;
        public CustomSettings Custom { get; init; }

        /// <summary>Start at a later level — only used to continue an unranked run.</summary>
        public int Level { get; init; } = 1;

        public double Score { get; init; }
    }

    /// <summary>
    /// The rules of Trap The Orb as pure functions over immutable states, mirroring the web engine's game.ts.
    /// </summary>
    public static class Game
    {
        private sealed record LevelSetup(
            ModeRules Rules,
            FieldOrientation Field,
            int Level,
            long Score,
            int? CarriedLives,
            uint Seed,
            int NextId,
            int Tick,
            RunStats Stats,
            GameStatus Status);

        private static GameState BuildLevel(LevelSetup setup)
        {
            LevelConfig config = Levels.ConfigFor(setup.Level, setup.Rules);
            GridDims dims = Engine.Field.Dims(setup.Field);
            Grid grid = Grid.Create(dims);
            bool portrait = setup.Field == FieldOrientation.Portrait;
            // Orbs always spawn on the landscape field; portrait turns that exact layout on its side.
            Grid spawnGrid = portrait ? Grid.Create(dims.Rows, dims.Cols) : grid;
            SpawnResult spawned = Balls.Spawn(new SpawnOptions(spawnGrid, config.OrbSpeeds, config.OrbTiers, Constants.BallRadius, setup.Seed, setup.NextId));
            ReadOnlyArray<Ball> balls = portrait ? TransposeAll(spawned.Balls) : spawned.Balls;
            int lives = setup.Rules.LivesPolicy == LivesPolicy.PerRun && setup.CarriedLives is int carried ? carried : config.Lives;

            return new GameState
            {
                Status = setup.Status,
                Rules = setup.Rules,
                Field = setup.Field,
                Level = config.Level,
                Config = config,
                Lives = lives,
                Score = setup.Score,
                LevelStartScore = setup.Score,
                LevelTicks = 0,
                Tick = setup.Tick,
                Grid = grid,
                Balls = balls,
                SpawnBalls = balls,
                Walls = ReadOnlyArray<WallHalf>.Empty,
                WallsLeft = config.WallBudget,
                LevelLivesLost = 0,
                LevelWallsUsed = 0,
                RngSeed = spawned.Seed,
                NextId = setup.NextId + config.OrbCount,
                Stats = Stats.AfterLevelStart(setup.Stats, config.Level),
                LastResult = null,
                GameOverReason = null,
            };
        }

        private static ReadOnlyArray<Ball> TransposeAll(ReadOnlyArray<Ball> balls)
        {
            var transposed = new Ball[balls.Count];
            for (int index = 0; index < transposed.Length; index++) transposed[index] = Balls.Transpose(balls[index]);
            return ReadOnlyArray<Ball>.Wrap(transposed);
        }

        /// <summary>A new run waiting in the "ready" state; orbs roam until the player starts.</summary>
        public static GameState CreateRun(CreateRunOptions options)
        {
            long safeScore = JsMath.IsFinite(options.Score) ? (long)Math.Max(0, Math.Floor(options.Score)) : 0;
            return BuildLevel(new LevelSetup(
                Modes.RulesFor(options.Mode, options.Custom),
                options.Field,
                options.Level,
                safeScore,
                null,
                options.Seed,
                1,
                0,
                Engine.Stats.Empty,
                GameStatus.Ready));
        }

        /// <summary>Starts play from the spawn positions — the preview motion of the ready screen never counts.</summary>
        public static GameState StartGame(GameState state) =>
            state.Status != GameStatus.Ready
                ? state
                : state with { Status = GameStatus.Playing, Balls = state.SpawnBalls, Tick = 0, LevelTicks = 0 };

        public static GameState PauseGame(GameState state) =>
            state.Status == GameStatus.Playing ? state with { Status = GameStatus.Paused } : state;

        public static GameState ResumeGame(GameState state) =>
            state.Status == GameStatus.Paused ? state with { Status = GameStatus.Playing } : state;

        /// <summary>Builds the following level once the current one is cleared.</summary>
        public static GameState AdvanceToNextLevel(GameState state) =>
            state.Status != GameStatus.LevelComplete
                ? state
                : BuildLevel(new LevelSetup(state.Rules, state.Field, state.Level + 1, state.Score, state.Lives, state.RngSeed,
                    state.NextId, state.Tick, state.Stats, GameStatus.Playing));

        /// <summary>Replays the current level from scratch with the score it started with (unranked play only).</summary>
        public static GameState RestartLevel(GameState state) =>
            BuildLevel(new LevelSetup(state.Rules, state.Field, state.Level, state.LevelStartScore, null, state.RngSeed,
                state.NextId, state.Tick, state.Stats, GameStatus.Playing));

        private static StepResult Rejected(GameState state, WallRejectReason reason) =>
            new StepResult(state, new GameEvent[] { new WallRejectedEvent(reason) });

        /// <summary>Starts building a wall through the given cell. Only one wall may grow at a time.</summary>
        public static StepResult PlaceWall(GameState state, int col, int row, Orientation orientation)
        {
            if (state.Status != GameStatus.Playing) return Rejected(state, WallRejectReason.NotPlaying);
            if (state.Walls.Count > 0) return Rejected(state, WallRejectReason.Busy);
            if (state.WallsLeft == 0) return Rejected(state, WallRejectReason.NoWalls);
            if (state.Grid.IsSolid(col, row)) return Rejected(state, WallRejectReason.Solid);

            int? wallsLeft = state.WallsLeft - 1;
            (WallHalf backward, WallHalf forward) = Engine.Walls.CreatePair(orientation, col, row, state.NextId);
            GameState next = state with
            {
                Walls = ReadOnlyArray<WallHalf>.Wrap(new[] { backward, forward }),
                NextId = state.NextId + 2,
                WallsLeft = wallsLeft,
                LevelWallsUsed = state.LevelWallsUsed + 1,
                Stats = Engine.Stats.AfterWallStarted(state.Stats),
            };
            return new StepResult(next, new GameEvent[] { new WallStartedEvent(orientation, col, row, wallsLeft) });
        }

        /// <summary>
        /// Advances the simulation by exactly one fixed tick. The app runs as many ticks as real time allows; the
        /// server replays the same ticks to verify runs.
        /// </summary>
        public static StepResult Tick(GameState state)
        {
            if (state.Status == GameStatus.Ready) return StepResult.Quiet(MoveAllBalls(state, Constants.TickSeconds));
            if (state.Status != GameStatus.Playing) return StepResult.Quiet(state);

            var events = new EventSink();
            GameState simulated = Simulation.Simulate(state, events);
            GameState settled = Settle(simulated, events);
            return new StepResult(settled, events.ToList());
        }

        internal static GameState MoveAllBalls(GameState state, double dt)
        {
            var moved = new Ball[state.Balls.Count];
            for (int index = 0; index < moved.Length; index++) moved[index] = Engine.Balls.Move(state.Balls[index], state.Grid, dt);
            return state with { Balls = Engine.Balls.ResolvePairs(ReadOnlyArray<Ball>.Wrap(moved)) };
        }

        private static GameOverReason? GameOverReasonFor(GameState state)
        {
            if (state.Rules.LivesPolicy != LivesPolicy.Infinite && state.Lives <= 0) return Engine.GameOverReason.Lives;
            if (state.Config.TimeLimitTicks is int limit && state.LevelTicks >= limit) return Engine.GameOverReason.Time;
            if (state.WallsLeft == 0 && state.Walls.Count == 0) return Engine.GameOverReason.Walls;
            return null;
        }

        /// <summary>Ends the level or the run when a condition is met. Clearing the level always wins.</summary>
        private static GameState Settle(GameState state, EventSink events)
        {
            double percent = state.Grid.CapturedPercent;
            if (percent >= state.Config.TargetPercent)
            {
                LevelResult result = Scoring.ComputeLevelResult(new LevelOutcome(
                    state.Config, state.Rules, percent, state.LevelTicks, state.Lives, state.WallsLeft));
                events.Add(new LevelCompleteEvent(result));
                return state with
                {
                    Status = GameStatus.LevelComplete,
                    Walls = ReadOnlyArray<WallHalf>.Empty,
                    Score = state.Score + result.TotalBonus,
                    LastResult = result,
                    Stats = Engine.Stats.AfterLevelClear(state.Stats, new LevelClear(
                        percent, result.ElapsedMs, state.Config.ParSeconds, state.LevelLivesLost, state.LevelWallsUsed, state.Config.OrbCount)),
                };
            }

            if (!(GameOverReasonFor(state) is GameOverReason reason)) return state;
            events.Add(new GameOverEvent(state.Level, state.Score, reason));
            return state with { Status = GameStatus.GameOver, Walls = ReadOnlyArray<WallHalf>.Empty, GameOverReason = reason };
        }

        /// <summary>Collects the events of one step; allocates only when something happens.</summary>
        internal sealed class EventSink
        {
            private List<GameEvent> events;

            public void Add(GameEvent gameEvent) => (events ??= new List<GameEvent>(2)).Add(gameEvent);

            public IReadOnlyList<GameEvent> ToList() => events ?? (IReadOnlyList<GameEvent>)Array.Empty<GameEvent>();
        }
    }
}

using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Core
{
    /// <summary>
    /// Imperative shell around the pure engine (GameController.ts): owns the fixed-tick loop, input mapping and
    /// recording, sounds and short-lived effects, and exposes an immutable HUD snapshot for the UI.
    /// It knows nothing about Unity, so it runs in plain tests.
    /// </summary>
    public sealed partial class GameController
    {
        /// <summary>Longest stretch of time simulated after a hitch (e.g. the app in the background); the rest is dropped.</summary>
        private const double MaxBacklogSeconds = 0.25;

        /// <summary>Keyboard aiming moves the cursor by this share of the short side per press.</summary>
        private const double KeyboardStepRatio = 0.025;

        private readonly IFeedback feedback;
        private readonly uint previewSeed;
        private readonly Func<double> random;
        private readonly List<RunInput> inputs = new List<RunInput>();
        private readonly List<Effect> effects = new List<Effect>();
        private GameMode mode;
        private CustomSettings custom;
        private GameState state;
        private bool inRun;
        private uint runSeed;
        private Orientation orientation = Orientation.Vertical;
        private CellPoint? aim;
        private NextLevelPreview nextLevelCache;
        private string announcement = string.Empty;
        private float width;
        private float height;
        private double? lastFrameMs;
        private double backlog;

        public GameController(IFeedback feedback, uint previewSeed, Func<double> random = null)
        {
            this.feedback = feedback ?? new SilentFeedback();
            this.previewSeed = previewSeed;
            this.random = random ?? new Random().NextDouble;
            Hud = new HudSnapshot();
        }

        /// <summary>The HUD changed (compared by value).</summary>
        public event Action HudChanged;

        /// <summary>Engine events, plus <see cref="RunStartedEvent"/> and <see cref="LevelStartedEvent"/>.</summary>
        public event Action<IReadOnlyList<GameEvent>, GameState> GameEvents;

        public HudSnapshot Hud { get; private set; }

        /// <summary>Current engine state, or null until the board has a size.</summary>
        public GameState State => state;

        public GameMode Mode => mode;
        public CustomSettings Custom => custom;
        public Orientation Orientation => orientation;
        public IReadOnlyList<Effect> Effects => effects;

        /// <summary>The aim is only drawn during a run.</summary>
        public CellPoint? Aim => inRun ? aim : null;

        /// <summary>A run is in progress and not over yet.</summary>
        public bool IsRunActive => inRun && state != null && state.Status != GameStatus.GameOver;

        /// <summary>The field shape that fits the board right now — what a new run would use.</summary>
        public FieldOrientation FieldOrientation => Field.OrientationForAspect(width / height);

        /// <summary>Where the field sits on the board, or null before the first resize.</summary>
        public FieldLayout? Layout =>
            state == null || width < 1 || height < 1 ? (FieldLayout?)null : FieldLayout.Fit(width, height, new GridDims(state.Grid.Cols, state.Grid.Rows));

        /// <summary>Sizes the board; shows the ready-screen preview once there is a size.</summary>
        public void Resize(float boardWidth, float boardHeight)
        {
            static bool IsUsable(float value) => !float.IsNaN(value) && !float.IsInfinity(value) && value >= 1;
            if (!IsUsable(boardWidth) || !IsUsable(boardHeight)) return;
            width = boardWidth;
            height = boardHeight;
            if (state == null || (!inRun && state.Field != FieldOrientation)) ShowPreview();
            Publish();
        }

        // ------------------------------------------------------------------ commands

        /// <summary>Chooses the mode for the next run. Ignored while a run is in progress.</summary>
        public void SetMode(GameMode nextMode, CustomSettings nextCustom = null)
        {
            if (IsRunActive) return;
            CustomSettings settings = nextMode == GameMode.Custom ? nextCustom : null;
            // Re-selecting the mode shown on the ready screen keeps its preview running.
            if (state != null && !inRun && nextMode == mode && Equals(settings, custom)) return;
            mode = nextMode;
            custom = settings;
            if (state != null) ShowPreview();
            Publish();
        }

        /// <summary>Starts a run of the chosen mode.</summary>
        public void StartRun(uint seed, FieldOrientation? field = null, int level = 1, long score = 0)
        {
            if (state == null) return;
            runSeed = seed;
            inputs.Clear();
            inRun = true;
            GameState fresh = Game.CreateRun(new CreateRunOptions(mode, seed)
            {
                Field = field ?? FieldOrientation,
                Custom = custom,
                Level = level,
                Score = score,
            });
            BeginLevel(Game.StartGame(fresh), startsRun: true);
        }

        /// <summary>Ends the run where it stands — the player gave up. The final field and the recording stay.</summary>
        public void EndRun()
        {
            if (!IsRunActive) return;
            state = state with { Status = GameStatus.GameOver };
            backlog = 0;
            Publish();
        }

        /// <summary>Leaves the current run and returns to the ready screen.</summary>
        public void AbandonRun()
        {
            inRun = false;
            inputs.Clear();
            ShowPreview();
            Publish();
        }

        public void TogglePause()
        {
            if (state?.Status == GameStatus.Playing) Pause();
            else if (state?.Status == GameStatus.Paused) Resume();
        }

        public void Pause()
        {
            if (state?.Status != GameStatus.Playing) return;
            state = Game.PauseGame(state);
            Publish();
        }

        public void Resume()
        {
            if (state?.Status != GameStatus.Paused) return;
            state = Game.ResumeGame(state);
            lastFrameMs = null;
            Publish();
        }

        /// <summary>Replays the current level — only offered in the casual modes.</summary>
        public void RestartLevel()
        {
            if (state == null || !inRun || state.Status == GameStatus.GameOver || state.Status == GameStatus.LevelComplete) return;
            BeginLevel(Game.RestartLevel(state), startsRun: false);
        }

        public void NextLevel()
        {
            if (state?.Status != GameStatus.LevelComplete) return;
            BeginLevel(Game.AdvanceToNextLevel(state), startsRun: false);
        }

        /// <summary>The recording of the current run, or null outside a run.</summary>
        public RunRecording GetRecording() =>
            state == null || !inRun
                ? null
                : new RunRecording(mode, custom, state.Field, runSeed, ReadOnlyArray<RunInput>.From(inputs), state.Tick, state.Score, state.Level);

        public void ToggleOrientation() =>
            SetOrientation(orientation == Orientation.Vertical ? Orientation.Horizontal : Orientation.Vertical);

        public void SetOrientation(Orientation next)
        {
            if (next == orientation) return;
            orientation = next;
            Publish();
        }

        /// <summary>Forgets the frame clock, so time spent in the background is never simulated.</summary>
        public void ResetClock()
        {
            lastFrameMs = null;
            backlog = 0;
        }

        // --------------------------------------------------------------------- input

        /// <summary>Grid cell under a point in board units.</summary>
        public CellPoint? CellAt(float x, float y) =>
            Layout is FieldLayout layout ? layout.CellAt(new GridDims(state.Grid.Cols, state.Grid.Rows), x, y) : null;

        public void AimAtPoint(float x, float y) => aim = CellAt(x, y);

        public void ClearAim() => aim = null;

        /// <summary>Moves the aim cursor, starting from the centre of the field (keyboard and tests).</summary>
        public void MoveAim(int dx, int dy)
        {
            if (state == null) return;
            int cols = state.Grid.Cols;
            int rows = state.Grid.Rows;
            int stride = Math.Max(1, (int)JsMath.Round(Math.Min(cols, rows) * KeyboardStepRatio));
            CellPoint current = aim ?? new CellPoint(cols / 2, rows / 2);
            aim = new CellPoint(
                Math.Min(cols - 2, Math.Max(1, current.Col + Math.Sign(dx) * stride)),
                Math.Min(rows - 2, Math.Max(1, current.Row + Math.Sign(dy) * stride)));
        }

        public bool BuildAtPoint(float x, float y, Orientation? wallOrientation = null) =>
            CellAt(x, y) is CellPoint cell && BuildAt(cell, wallOrientation);

        public bool BuildAtAim() => aim is CellPoint cell && BuildAt(cell, orientation);

        public bool BuildAt(CellPoint cell, Orientation? wallOrientation = null, double? nowMs = null)
        {
            if (state == null || !inRun) return false;
            Orientation chosen = wallOrientation ?? orientation;
            StepResult result = Game.PlaceWall(state, cell.Col, cell.Row, chosen);
            bool started = false;
            foreach (GameEvent gameEvent in result.Events)
            {
                if (!(gameEvent is WallStartedEvent wall)) continue;
                // Recorded at the current tick so a server can replay the exact same move.
                inputs.Add(new RunInput(state.Tick, wall.Col, wall.Row, chosen));
                started = true;
            }
            state = result.State;
            HandleEvents(result.Events, nowMs ?? lastFrameMs ?? 0);
            Publish();
            return started;
        }
    }
}

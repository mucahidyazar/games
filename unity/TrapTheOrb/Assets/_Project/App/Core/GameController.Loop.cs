using System;
using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Core
{
    public sealed partial class GameController
    {
        /// <summary>
        /// One frame: runs the fixed ticks that fit into the time since the last frame, expires effects and
        /// publishes the HUD. <paramref name="nowMs"/> is a monotonic clock in milliseconds.
        /// </summary>
        public void Advance(double nowMs)
        {
            if (state == null) return;

            double dt = lastFrameMs is double last ? (nowMs - last) / 1000 : 0;
            lastFrameMs = nowMs;
            bool running = state.Status == GameStatus.Playing || state.Status == GameStatus.Ready;
            backlog = running ? Math.Min(backlog + dt, MaxBacklogSeconds) : 0;

            GameState current = state;
            List<GameEvent> events = null;
            int ticks = 0;
            while (backlog >= Constants.TickSeconds)
            {
                StepResult result = Game.Tick(current);
                current = result.State;
                ticks++;
                if (result.Events.Count > 0) (events ??= new List<GameEvent>()).AddRange(result.Events);
                backlog -= Constants.TickSeconds;
                if (current.Status != GameStatus.Playing && current.Status != GameStatus.Ready)
                {
                    backlog = 0;
                    break;
                }
            }

            state = current;
            if (events != null) HandleEvents(events, nowMs);
            for (int i = effects.Count - 1; i >= 0; i--)
            {
                if (effects[i].IsOver(nowMs)) effects.RemoveAt(i);
            }
            // The HUD only depends on the engine state; an idle frame has nothing new to show.
            if (ticks > 0 || events != null) Publish();
        }

        /// <summary>The animated field behind the ready screen: the next run's mode, never the real run seed.</summary>
        private void ShowPreview()
        {
            inRun = false;
            nextLevelCache = null;
            state = Game.CreateRun(new CreateRunOptions(mode, previewSeed) { Field = FieldOrientation, Custom = custom });
            effects.Clear();
        }

        /// <summary>Switches to a freshly started level and tells listeners about it.</summary>
        private void BeginLevel(GameState level, bool startsRun)
        {
            state = level;
            effects.Clear();
            nextLevelCache = null;
            backlog = 0;
            feedback.Play(SoundName.Start);
            Publish();
            GameEvent started = startsRun
                ? new RunStartedEvent(mode, level.Level, level.LevelStartScore)
                : (GameEvent)new LevelStartedEvent(level.Level, level.LevelStartScore);
            GameEvents?.Invoke(new[] { started }, level);
        }

        private void HandleEvents(IReadOnlyList<GameEvent> events, double nowMs)
        {
            // Both halves can break in the same instant; that is one mistake, so give feedback once.
            bool hasReportedBreak = false;

            foreach (GameEvent gameEvent in events)
            {
                switch (gameEvent)
                {
                    case WallStartedEvent _:
                        feedback.Play(SoundName.Build);
                        break;
                    case WallRejectedEvent rejected:
                        if (rejected.Reason == WallRejectReason.Busy || rejected.Reason == WallRejectReason.NoWalls) feedback.Play(SoundName.Blocked);
                        if (rejected.Reason == WallRejectReason.NoWalls) announcement = "No walls left in this level.";
                        break;
                    case WallCompletedEvent completed:
                        OnWallCompleted(completed, nowMs);
                        break;
                    case WallBrokenEvent broken:
                        effects.Add(new BrokenWall(Walls.CoveredRect(broken.Wall), nowMs));
                        if (hasReportedBreak) break;
                        hasReportedBreak = true;
                        feedback.Play(SoundName.Break);
                        announcement = state.Rules.LivesPolicy == LivesPolicy.Infinite
                            ? "Wall broken."
                            : $"Wall broken — {broken.LivesLeft} {(broken.LivesLeft == 1 ? "life" : "lives")} left.";
                        break;
                    case LevelCompleteEvent complete:
                        feedback.Play(SoundName.Level);
                        announcement = $"Level {complete.Result.Level} cleared with {(int)Math.Floor(complete.Result.Percent)}% captured.";
                        break;
                    case GameOverEvent over:
                        feedback.Play(SoundName.GameOver);
                        announcement = $"Game over. Final score {Format.Number(over.Score)}.";
                        break;
                }
            }

            GameEvents?.Invoke(events, state);
        }

        private void OnWallCompleted(WallCompletedEvent completed, double nowMs)
        {
            if (completed.CapturedCells == 0)
            {
                feedback.Play(SoundName.Wall);
                return;
            }
            effects.Add(new CaptureFlash(completed.Runs, nowMs));
            effects.Add(new ParticleBurst(Particles.ForCapture(completed.Runs, random), nowMs));
            if (Runs.Centroid(completed.Runs) is { } centre && completed.Points > 0)
            {
                effects.Add(new PointsPopup(centre.X, centre.Y, completed.Points, nowMs));
            }
            feedback.Play(SoundName.Capture);
        }

        private void Publish()
        {
            HudSnapshot next = ComputeHud();
            if (next == Hud) return;
            Hud = next;
            HudChanged?.Invoke();
        }

        /// <summary>Preview of the next level for the "level cleared" card, computed once per level.</summary>
        private NextLevelPreview NextLevelFor(GameState current)
        {
            if (current.Status != GameStatus.LevelComplete) return null;
            if (nextLevelCache?.Level != current.Level + 1)
            {
                LevelConfig config = Levels.ConfigFor(current.Level + 1, current.Rules);
                nextLevelCache = new NextLevelPreview(config.Level, config.OrbTiers, config.Change);
            }
            return nextLevelCache;
        }

        private static HudStatus ToHudStatus(GameStatus status) => status switch
        {
            GameStatus.Ready => HudStatus.Ready,
            GameStatus.Playing => HudStatus.Playing,
            GameStatus.Paused => HudStatus.Paused,
            GameStatus.LevelComplete => HudStatus.LevelComplete,
            _ => HudStatus.GameOver,
        };

        private HudSnapshot ComputeHud()
        {
            if (state == null)
            {
                return new HudSnapshot { Mode = mode, RankedMode = Modes.IsRanked(mode), Orientation = orientation };
            }

            LevelConfig config = state.Config;
            ModeRules rules = state.Rules;
            int topTier = 0;
            foreach (int tier in config.OrbTiers) topTier = Math.Max(topTier, tier);
            double topSpeedFactor = rules.Custom?.Speed ?? Constants.SpeedMultiplier(topTier);

            return new HudSnapshot
            {
                Status = ToHudStatus(state.Status),
                Mode = mode,
                RankedMode = rules.Ranked,
                InRun = inRun,
                Level = state.Level,
                OrbCount = config.OrbCount,
                OrbTiers = config.OrbTiers,
                TopSpeedFactor = topSpeedFactor,
                MaxSpeedFactor = Math.Max(Constants.SpeedMultiplier(Constants.MaxSpeedTier), topSpeedFactor),
                Lives = state.Lives,
                MaxLives = rules.LivesPolicy == LivesPolicy.PerRun ? rules.RunLives : config.Lives,
                InfiniteLives = rules.LivesPolicy == LivesPolicy.Infinite,
                Score = state.Score,
                Percent = (int)Math.Floor(state.Grid.CapturedPercent),
                TargetPercent = config.TargetPercent,
                ElapsedMs = state.LevelTicks / Constants.TicksPerSecond * 1000L,
                TimeLeftMs = config.TimeLimitTicks is int limit
                    ? (long)Math.Ceiling(Math.Max(0, limit - state.LevelTicks) / (double)Constants.TicksPerSecond) * 1000
                    : (long?)null,
                WallsLeft = state.WallsLeft,
                WallBudget = config.WallBudget,
                Orientation = orientation,
                LastResult = state.LastResult,
                NextLevel = NextLevelFor(state),
                GameOverReason = state.GameOverReason,
                Announcement = announcement,
            };
        }
    }
}

using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Storage;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Run
{
    /// <summary>A run that just ended, until the player moves on.</summary>
    public sealed record RunResult(int Id, GameMode Mode, long Score, int Level, bool EndedEarly);

    /// <summary>
    /// Starts and finishes runs (run/useRunFlow.ts without the server: every run is played on the device).
    /// Everyone gets the same Daily layout, as on the web.
    /// </summary>
    public sealed class RunFlow : IDisposable
    {
        private readonly GameController controller;
        private readonly Func<DateTime> utcNow;
        private int resultId;

        public RunFlow(GameController controller, Func<DateTime> utcNow)
        {
            this.controller = controller ?? throw new ArgumentNullException(nameof(controller));
            this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
            controller.GameEvents += OnGameEvents;
        }

        public event Action Changed;

        public RunResult Result { get; private set; }

        public void Start() => Begin(controller.Mode, 1, 0);

        public void ContinueSaved(SavedRun saved)
        {
            if (saved == null) return;
            controller.SetMode(saved.Mode, saved.Custom);
            Begin(saved.Mode, saved.Level, saved.Score);
        }

        /// <summary>Ends the run in progress now; its score so far still counts.</summary>
        public void EndRun()
        {
            if (!controller.IsRunActive) return;
            Finish(endedEarly: true);
            controller.EndRun();
        }

        /// <summary>Clears the result, e.g. when the mode changes.</summary>
        public void Reset()
        {
            if (Result == null) return;
            Result = null;
            Changed?.Invoke();
        }

        public void Dispose() => controller.GameEvents -= OnGameEvents;

        private void Begin(GameMode mode, int level, long score)
        {
            uint seed = mode == GameMode.Daily ? Rng.DailySeed(Rng.UtcDateKey(utcNow())) : Rng.RandomSeed();
            Result = null;
            controller.StartRun(seed, level: level, score: score);
            Changed?.Invoke();
        }

        private void OnGameEvents(IReadOnlyList<GameEvent> events, GameState state)
        {
            foreach (GameEvent gameEvent in events)
            {
                if (!(gameEvent is GameOverEvent)) continue;
                Finish(endedEarly: false);
                return;
            }
        }

        private void Finish(bool endedEarly)
        {
            RunRecording recording = controller.GetRecording();
            if (recording == null) return;
            resultId++;
            Result = new RunResult(resultId, recording.Mode, recording.Score, recording.Level, endedEarly);
            Changed?.Invoke();
        }
    }

    /// <summary>The one main thing the player can do next, shown on the header button (run/primaryAction.ts).</summary>
    public enum PrimaryAction
    {
        Play,
        Continue,
        Pause,
        Resume,
        Next,
        PlayAgain,
    }

    public static class PrimaryActions
    {
        public static PrimaryAction For(HudSnapshot hud, bool hasResult, bool canContinue)
        {
            if (hasResult && !hud.IsRunActive) return PrimaryAction.PlayAgain;
            switch (hud.Status)
            {
                case HudStatus.Playing:
                    return PrimaryAction.Pause;
                case HudStatus.Paused:
                    return PrimaryAction.Resume;
                case HudStatus.LevelComplete:
                    return PrimaryAction.Next;
                case HudStatus.GameOver:
                    return PrimaryAction.PlayAgain;
                default:
                    return canContinue ? PrimaryAction.Continue : PrimaryAction.Play;
            }
        }

        public static string Label(PrimaryAction action) => action switch
        {
            PrimaryAction.Continue => "Continue",
            PrimaryAction.Pause => "Pause",
            PrimaryAction.Resume => "Resume",
            PrimaryAction.Next => "Next",
            PrimaryAction.PlayAgain => "Again",
            _ => "Play",
        };
    }
}

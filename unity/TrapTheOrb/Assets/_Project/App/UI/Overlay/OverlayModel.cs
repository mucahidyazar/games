using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>Everything the panels over the board show, as one value.</summary>
    public sealed record OverlayModel(
        HudSnapshot Hud,
        RunResult Result,
        SavedRun SavedRun,
        Settings Settings,
        IReadOnlyList<HighScore> HighScores,
        CustomSettings Custom,
        bool IsNarrow);

    /// <summary>What the panels can ask for.</summary>
    public sealed class OverlayActions
    {
        public Action Start { get; init; }
        public Action<SavedRun> ContinueSaved { get; init; }
        public Action EndRun { get; init; }
        public Action Resume { get; init; }
        public Action RestartLevel { get; init; }
        public Action NextLevel { get; init; }

        /// <summary>From a finished run's result back to the start screen.</summary>
        public Action BackToReady { get; init; }

        /// <summary>Leaves a practice run for the start screen; its save lets it be continued later.</summary>
        public Action LeaveRun { get; init; }

        public Action OpenHowToPlay { get; init; }
        public Action<GameMode> SelectMode { get; init; }
        public Action<CustomSettings> ChangeCustom { get; init; }

        /// <summary>Saves a result on this device's high scores; returns its rank, or null.</summary>
        public Func<string, RunResult, int?> SaveHighScore { get; init; }

        public Action<RunResult> Share { get; init; }
    }

    public enum OverlayKind
    {
        None,
        Ready,
        Paused,
        LevelComplete,
        Result,
    }

    public static class OverlayKinds
    {
        /// <summary>Which card covers the board (BoardOverlay.tsx).</summary>
        public static OverlayKind For(HudSnapshot hud, bool hasResult)
        {
            if (hasResult && !hud.IsRunActive) return OverlayKind.Result;
            return hud.Status switch
            {
                HudStatus.Ready => OverlayKind.Ready,
                HudStatus.Paused => OverlayKind.Paused,
                HudStatus.LevelComplete => hud.LastResult != null ? OverlayKind.LevelComplete : OverlayKind.None,
                _ => OverlayKind.None,
            };
        }
    }
}

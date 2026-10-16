using System;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>Everything the screens and sheets show, as one value.</summary>
    public sealed record OverlayModel(HudSnapshot Hud, RunResult Result, PlayerSnapshot Player, CustomSettings Custom, Theme Theme)
    {
        public Settings Settings => Player.Settings;

        /// <summary>The system asks for reduced motion, so the in-game setting cannot turn motion back on.</summary>
        public bool IsSystemMotionReduced { get; init; }

        /// <summary>The resumable run of the mode on screen, if there is one.</summary>
        public SavedRun MatchingSave => Player.SavedRun?.Mode == Hud.Mode ? Player.SavedRun : null;
    }

    /// <summary>What the screens and sheets can ask for.</summary>
    public sealed class OverlayActions
    {
        public Action Start { get; init; }
        public Action<SavedRun> ContinueSaved { get; init; }
        public Action EndRun { get; init; }
        public Action Resume { get; init; }
        public Action RestartLevel { get; init; }
        public Action NextLevel { get; init; }

        /// <summary>From a finished run back to the home screen.</summary>
        public Action GoHome { get; init; }

        /// <summary>Leaves a practice run for the home screen; its save lets it be continued later.</summary>
        public Action LeaveRun { get; init; }

        public Action<GameMode> SelectMode { get; init; }
        public Action<CustomSettings> ChangeCustom { get; init; }

        /// <summary>Saves a result on this device's high scores; returns its rank, or null.</summary>
        public Func<string, RunResult, int?> SaveHighScore { get; init; }

        public Action<RunResult> Share { get; init; }

        public Action<SheetKind> OpenSheet { get; init; }
        public Action CloseSheet { get; init; }

        public Action<bool> SetSound { get; init; }
        public Action<bool> SetHaptics { get; init; }
        public Action<bool> SetReducedMotion { get; init; }
        public Action<Theme> SetTheme { get; init; }
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
        /// <summary>What covers the field (BoardOverlay.tsx): the start screen, a pause, a cleared level or a result.</summary>
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

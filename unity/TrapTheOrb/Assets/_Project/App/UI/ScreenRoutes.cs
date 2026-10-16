using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Overlay;

namespace TrapTheOrb.App.UI
{
    /// <summary>The full-screen views of the app.</summary>
    public enum ScreenKind
    {
        /// <summary>Title, mode and the play button, over the field's live preview.</summary>
        Home,

        /// <summary>The HUD, the field and the wall direction control.</summary>
        Play,

        /// <summary>The final score of a run that just ended.</summary>
        RunOver,
    }

    /// <summary>Sheets that slide up from the bottom of the screen.</summary>
    public enum SheetKind
    {
        None,
        Pause,
        LevelCleared,
        Modes,
        CustomSetup,
        Settings,
        HowToPlay,
        HighScores,
    }

    /// <summary>What the system back gesture (Android's back button) does.</summary>
    public enum BackAction
    {
        /// <summary>Nothing to go back from: a cleared level waits for "Next level".</summary>
        None,
        CloseSheet,
        Pause,
        Resume,
        GoHome,

        /// <summary>The home screen with nothing open: back hands over to the system, as in any other app.</summary>
        LeaveApp,
    }

    /// <summary>Which screen and sheet the game's state calls for.</summary>
    public static class ScreenRoutes
    {
        public static BackAction BackFor(HudSnapshot hud, bool hasResult, SheetKind opened)
        {
            if (opened != SheetKind.None) return BackAction.CloseSheet;
            switch (ScreenFor(hud, hasResult))
            {
                case ScreenKind.RunOver:
                    return BackAction.GoHome;
                case ScreenKind.Play when hud.Status == HudStatus.Playing:
                    return BackAction.Pause;
                case ScreenKind.Play when hud.Status == HudStatus.Paused:
                    return BackAction.Resume;
                case ScreenKind.Home:
                    return BackAction.LeaveApp;
                default:
                    return BackAction.None;
            }
        }

        public static ScreenKind ScreenFor(HudSnapshot hud, bool hasResult)
        {
            if (OverlayKinds.For(hud, hasResult) == OverlayKind.Result) return ScreenKind.RunOver;
            return hud.InRun ? ScreenKind.Play : ScreenKind.Home;
        }

        /// <summary>The sheet that follows the game: the pause menu or a cleared level's summary.</summary>
        public static SheetKind StateSheetFor(HudSnapshot hud, bool hasResult) => OverlayKinds.For(hud, hasResult) switch
        {
            OverlayKind.Paused => SheetKind.Pause,
            OverlayKind.LevelComplete => SheetKind.LevelCleared,
            _ => SheetKind.None,
        };

        /// <summary>A sheet the player opened covers the state's sheet until it is closed.</summary>
        public static SheetKind Visible(SheetKind opened, SheetKind fromState) => opened != SheetKind.None ? opened : fromState;

        /// <summary>Sheets the player opens over a running level pause it first.</summary>
        public static bool PausesTheGame(SheetKind sheet) =>
            sheet == SheetKind.HowToPlay || sheet == SheetKind.HighScores || sheet == SheetKind.Settings;
    }
}

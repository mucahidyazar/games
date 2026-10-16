using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.UI
{
    public sealed partial class GameScreen
    {
        private const string GameTitle = "Trap The Orb";
        private const string ShareUrl = "https://traptheorb.com";

        private OverlayActions CreateActions() => new OverlayActions
        {
            Start = () => flow.Start(),
            ContinueSaved = saved => flow.ContinueSaved(saved),
            EndRun = () => flow.EndRun(),
            Resume = () => controller.Resume(),
            RestartLevel = () => controller.RestartLevel(),
            NextLevel = () => controller.NextLevel(),
            GoHome = GoHome,
            LeaveRun = LeaveRun,
            SelectMode = SelectMode,
            ChangeCustom = custom => store.SetCustomSettings(custom),
            SaveHighScore = (name, result) => store.SubmitHighScore(name, result.Mode, result.Score, result.Level),
            Share = ShareResult,
            OpenSheet = OpenSheet,
            CloseSheet = CloseSheet,
            SetSound = on => store.SetSoundEnabled(on),
            SetHaptics = on => store.SetHapticsEnabled(on),
            SetReducedMotion = on => store.SetReducedMotion(on),
            SetTheme = SetTheme,
        };

        private CustomSettings CustomFor(GameMode mode) => mode == GameMode.Custom ? store.Snapshot.Settings.Custom : null;

        /// <summary>Picking another mode ends the run in progress.</summary>
        private void SelectMode(GameMode mode)
        {
            if (controller.IsRunActive) flow.EndRun();
            controller.SetMode(mode, CustomFor(mode));
            store.SetLastMode(mode);
            flow.Reset();
            Refresh();
        }

        /// <summary>From a finished run back to the home screen.</summary>
        private void GoHome()
        {
            if (controller.IsRunActive) return;
            if (controller.Hud.InRun) controller.AbandonRun();
            ShowHomePreview();
            flow.Reset();
            Refresh();
        }

        /// <summary>Leaves a practice run for the home screen; its save lets it be continued later.</summary>
        private void LeaveRun()
        {
            if (Modes.IsRanked(controller.Mode)) return;
            controller.AbandonRun();
            ShowHomePreview();
            flow.Reset();
            Refresh();
        }

        /// <summary>
        /// The home screen previews the mode as the player set it up. A continued Custom run may have used an older
        /// setup than the one saved since; the next run should not.
        /// </summary>
        private void ShowHomePreview() => controller.SetMode(controller.Mode, CustomFor(controller.Mode));

        /// <summary>Keeps unranked runs resumable: saved at every level start, forgotten at game over.</summary>
        private void SaveCasualRuns(IReadOnlyList<GameEvent> events, GameState state)
        {
            GameMode mode = controller.Mode;
            if (Modes.IsRanked(mode)) return;
            CustomSettings custom = controller.Custom;
            foreach (GameEvent gameEvent in events)
            {
                switch (gameEvent)
                {
                    case RunStartedEvent started:
                        store.SaveRun(mode, custom, started.Level, started.Score);
                        break;
                    case LevelStartedEvent started:
                        store.SaveRun(mode, custom, started.Level, started.Score);
                        break;
                    case LevelCompleteEvent complete:
                        // Leaving on the "level cleared" sheet should continue with the next level.
                        store.SaveRun(mode, custom, complete.Result.Level + 1, state.Score);
                        break;
                    case GameOverEvent _:
                        store.ClearRun();
                        break;
                }
            }
        }

        private void ShareResult(RunResult result)
        {
            string game = $"{GameTitle} ({ModeContent.Info(result.Mode).Name})";
            services.Share?.Invoke($"I reached level {result.Level} with {Format.Number(result.Score)} points in {game}. Can you beat it? {ShareUrl}");
        }
    }
}

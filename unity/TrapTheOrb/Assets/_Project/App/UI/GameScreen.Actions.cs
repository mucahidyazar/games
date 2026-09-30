using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.App.UI.Sheets;
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
            BackToReady = BackToReady,
            LeaveRun = LeaveRun,
            OpenHowToPlay = OpenHowToPlay,
            SelectMode = SelectMode,
            ChangeCustom = custom => store.SetCustomSettings(custom),
            SaveHighScore = (name, result) => store.SubmitHighScore(name, result.Mode, result.Score, result.Level),
            Share = ShareResult,
        };

        private CustomSettings CustomFor(GameMode mode) => mode == GameMode.Custom ? store.Snapshot.Settings.Custom : null;

        /// <summary>The header's main button: play, continue, pause, resume or next.</summary>
        private void RunPrimaryAction()
        {
            SavedRun saved = store.Snapshot.SavedRun;
            SavedRun matchingSave = saved?.Mode == controller.Mode ? saved : null;
            switch (PrimaryActions.For(controller.Hud, flow.Result != null, matchingSave != null))
            {
                case PrimaryAction.Pause:
                    controller.Pause();
                    break;
                case PrimaryAction.Resume:
                    controller.Resume();
                    break;
                case PrimaryAction.Next:
                    controller.NextLevel();
                    break;
                case PrimaryAction.Continue:
                    flow.ContinueSaved(matchingSave);
                    break;
                default:
                    flow.Start();
                    break;
            }
        }

        /// <summary>The flag button asks first: it pauses, and the pause card offers "End run".</summary>
        private void EndRunFromHeader()
        {
            if (controller.Hud.Status == HudStatus.Playing) controller.Pause();
            else flow.EndRun();
        }

        /// <summary>Picking another mode ends the run in progress.</summary>
        private void SelectMode(GameMode mode)
        {
            if (controller.IsRunActive) flow.EndRun();
            controller.SetMode(mode, CustomFor(mode));
            store.SetLastMode(mode);
            flow.Reset();
            Refresh();
        }

        /// <summary>From a finished run's result back to the start screen.</summary>
        private void BackToReady()
        {
            if (controller.IsRunActive) return;
            if (controller.Hud.InRun) controller.AbandonRun();
            flow.Reset();
            Refresh();
        }

        /// <summary>Leaves a practice run for the start screen; its save lets it be continued later.</summary>
        private void LeaveRun()
        {
            if (Modes.IsRanked(controller.Mode)) return;
            controller.AbandonRun();
            flow.Reset();
            Refresh();
        }

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
                        // Leaving on the "level cleared" card should continue with the next level.
                        store.SaveRun(mode, custom, complete.Result.Level + 1, state.Score);
                        break;
                    case GameOverEvent _:
                        store.ClearRun();
                        break;
                }
            }
        }

        private void ToggleSound() => store.SetSoundEnabled(!store.Snapshot.Settings.SoundEnabled);

        private void ToggleTheme()
        {
            Theme next = services.Themes.Current == Theme.Navy ? Theme.Light : Theme.Navy;
            services.Themes.Save(next);
            ApplyTheme(next);
            Refresh();
        }

        private void OpenHowToPlay() => OpenDialog("How to play", new HowToPlayView());

        private void OpenHighScores() => OpenDialog("High scores", new HighScoresView(store, services.Now, controller.Mode));

        /// <summary>Dialogs pause a running level, like the web's hash dialogs.</summary>
        private void OpenDialog(string title, UnityEngine.UIElements.VisualElement content)
        {
            menu.SetOpen(false);
            controller.Pause();
            dialog.Open(title, content);
        }

        private void ShareResult(RunResult result)
        {
            string game = $"{GameTitle} ({ModeContent.Info(result.Mode).Name})";
            services.Share?.Invoke($"I reached level {result.Level} with {Format.Number(result.Score)} points in {game}. Can you beat it? {ShareUrl}");
        }
    }
}

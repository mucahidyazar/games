using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// The end of a run: why it ended, the score, a place on this device's high scores, and what to do next —
    /// play again in the thumb zone, home and share beside it.
    /// </summary>
    public sealed class RunOverView : VisualElement
    {
        private readonly OverlayActions actions;
        private readonly VisualElement content;
        private readonly Label reason;
        private readonly Label score;
        private readonly VisualElement pill;
        private readonly VisualElement pillIcon;
        private readonly Label pillText;
        private readonly Label stats;
        private readonly VisualElement save;
        private readonly TextField nameField;
        private readonly Label note;
        private readonly Button share;
        private RunResult result;
        private string headline;
        private int? savedRank;
        private bool isNewBest;

        public RunOverView(OverlayActions actions)
        {
            this.actions = actions;
            AddToClassList("layer");
            AddToClassList("run-over");

            reason = Ui.Text(string.Empty, "run-over__reason");
            score = Ui.Text(string.Empty, "run-over__score");
            pillIcon = Ui.Icon("star", "pill__icon");
            pillText = Ui.Text(string.Empty, "pill__label");
            pill = Ui.Div("pill").Children(pillIcon, pillText);
            stats = Ui.Text(string.Empty, "run-over__stats");
            VisualElement summary = Ui.Div("run-over__summary").Children(reason, score, pill, stats);

            nameField = new TextField { maxLength = SettingsStorage.MaxNicknameLength };
            nameField.AddToClassList("text-input");
            nameField.textEdition.placeholder = "Your name";
            save = Ui.Div("run-over__save").Children(
                Ui.Text("Save to high scores", "run-over__save-title"),
                Ui.Div("run-over__save-row").Children(nameField, Controls.Secondary("Save", SaveScore).WithClass("run-over__save-button")));
            note = Ui.Text(string.Empty, "run-over__note");

            share = Controls.Secondary("Share", () =>
            {
                if (result != null) actions.Share?.Invoke(result);
            }, "share");
            VisualElement dock = Ui.Div("run-over__dock").Children(
                Controls.Primary("Play again", () => actions.Start?.Invoke(), "restart"),
                Ui.Div("btn-row").Children(Controls.Secondary("Home", () => actions.GoHome?.Invoke(), "home"), share)).Spaced(12);

            content = Ui.Div("run-over__content").Children(summary, save, note, Ui.Div("run-over__spacer"), dock);
            Add(Ui.Div("layer", "run-over__veil"));
            Add(content);
        }

        public void SetInsets(float left, float top, float right, float bottom)
        {
            content.style.paddingLeft = left + 16;
            content.style.paddingRight = right + 16;
            content.style.paddingTop = top + 24;
            content.style.paddingBottom = bottom + 16;
        }

        public void Show(OverlayModel model)
        {
            RunResult next = model.Result;
            if (next == null) return;
            bool isPractice = !Modes.IsRanked(next.Mode);
            if (result?.Id != next.Id)
            {
                savedRank = null;
                // Read once: the HUD state is replaced by the home preview when the player leaves.
                headline = $"{Headline(next, model.Hud.GameOverReason)} · {ModeContent.Info(next.Mode).Name}";
                // Through the value (and its change event), so the field drops its placeholder style.
                nameField.value = model.Settings.Nickname ?? string.Empty;
                IReadOnlyList<HighScore> previous = HighScores.For(model.Player.HighScores, next.Mode);
                isNewBest = !isPractice && next.Score > 0 && (previous.Count == 0 || next.Score > previous[0].Score);
            }
            result = next;

            reason.SetText(headline);
            score.SetText(Format.Number(next.Score));
            stats.SetText($"Reached level {next.Level}");

            bool qualifies = !isPractice && HighScores.Qualifies(model.Player.HighScores, next.Mode, next.Score);
            bool canSave = savedRank == null && qualifies;
            save.SetVisible(canSave);
            ShowPill();
            // The note explains the name field, or why a practice run has none; centred under the summary alone.
            note.SetText(isPractice ? "Practice runs are not saved to high scores." : "High scores stay on this device.");
            note.SetVisible(canSave || isPractice);
            note.EnableInClassList("run-over__note--center", !canSave);
            share.SetVisible(next.Score > 0);
        }

        private void ShowPill()
        {
            bool isSaved = savedRank != null;
            pill.SetVisible(isSaved || isNewBest);
            pill.EnableInClassList("pill--teal", isSaved);
            pillIcon.SetIcon(isSaved ? "check" : "star");
            pillText.SetText(isSaved ? $"Saved · #{savedRank} on this device" : "New best");
        }

        private void SaveScore()
        {
            if (result == null || savedRank != null) return;
            savedRank = actions.SaveHighScore?.Invoke(nameField.value, result);
            save.SetVisible(false);
            note.SetVisible(false);
            ShowPill();
        }

        private static string Headline(RunResult result, GameOverReason? reason)
        {
            if (result.EndedEarly) return "Run ended";
            return reason switch
            {
                GameOverReason.Lives => "Out of lives",
                GameOverReason.Time => "Time’s up",
                GameOverReason.Walls => "Out of walls",
                _ => "Game over",
            };
        }
    }
}

using System;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>The end of a run: the score, a place on this device's high scores and what to do next (ResultPanel.tsx).</summary>
    public sealed class ResultPanel : Panel
    {
        private readonly OverlayActions actions;
        private readonly Action openHighScores;
        private readonly Label eyebrow;
        private readonly Label score;
        private readonly Label summary;
        private readonly VisualElement scoreForm;
        private readonly TextField nameField;
        private readonly VisualElement savedBadge;
        private readonly Label savedText;
        private readonly Label note;
        private readonly Button changeMode;
        private readonly Label changeModeLabel;
        private readonly Button highScoresLink;
        private RunResult result;
        private int? savedRank;

        public ResultPanel(OverlayActions actions, Action openHighScores)
        {
            this.actions = actions;
            this.openHighScores = openHighScores;
            eyebrow = Controls.Eyebrow(string.Empty);
            score = Ui.Text(string.Empty, "result__score");
            summary = Ui.Text(string.Empty, "panel__subtitle", "panel__subtitle--spaced");
            Add(eyebrow);
            Add(score);
            Add(summary);

            nameField = new TextField { maxLength = SettingsStorage.MaxNicknameLength };
            nameField.AddToClassList("text-input");
            nameField.textEdition.placeholder = "Your name";
            scoreForm = Ui.Div("score-form").Children(nameField,
                Controls.Action("Save", SaveScore, isPrimary: false));
            savedText = Ui.Text(string.Empty, "saved-badge__text");
            savedBadge = Ui.Div("saved-badge").Children(Ui.Icon("check", "saved-badge__icon"), savedText);
            note = Controls.Note(string.Empty);
            Add(scoreForm);
            Add(savedBadge);
            Add(note);

            changeMode = Controls.Action("Change mode", () => actions.BackToReady?.Invoke(), isPrimary: false);
            changeModeLabel = changeMode.Q<Label>(className: "action-button__label");
            Add(Ui.Div("panel__actions").Children(
                Controls.Action("Play again", () => actions.Start?.Invoke(), "play"), changeMode));

            highScoresLink = Controls.TextButton("High scores", () => openHighScores?.Invoke());
            Add(Ui.Div("result__links").Children(
                Ui.Button(() =>
                {
                    if (result != null) actions.Share?.Invoke(result);
                }, "text-button", "share-button").Children(Ui.Icon("share", "share-button__icon"), Ui.Text("Share", "text-button__label")),
                highScoresLink));
        }

        public override OverlayKind Kind => OverlayKind.Result;

        public override void Show(OverlayModel model)
        {
            RunResult next = model.Result;
            if (next == null) return;
            if (result?.Id != next.Id)
            {
                savedRank = null;
                nameField.SetValueWithoutNotify(model.Settings.Nickname);
            }
            result = next;
            ModeInfo mode = ModeContent.Info(next.Mode);
            bool isPractice = !Modes.IsRanked(next.Mode);

            eyebrow.SetText($"{Headline(next, model.Hud.GameOverReason)} · {mode.Name}".ToUpperInvariant());
            score.SetText(Format.Number(next.Score));
            summary.SetText($"{Format.Plural(next.Score, "point", "points")} · level {next.Level}");

            bool qualifies = !isPractice && HighScores.Qualifies(model.HighScores, next.Mode, next.Score);
            scoreForm.SetVisible(savedRank == null && qualifies);
            savedBadge.SetVisible(savedRank != null);
            if (savedRank != null) savedText.SetText($"Saved — #{savedRank} on this device");
            note.SetText(isPractice ? "Practice mode — not ranked." : "High scores are kept on this device.");

            changeModeLabel.SetText(next.Mode == GameMode.Custom ? "Change setup" : "Change mode");
            highScoresLink.SetVisible(!isPractice);
        }

        private void SaveScore()
        {
            if (result == null || savedRank != null) return;
            savedRank = actions.SaveHighScore?.Invoke(nameField.value, result);
            scoreForm.SetVisible(false);
            savedBadge.SetVisible(savedRank != null);
            if (savedRank != null) savedText.SetText($"Saved — #{savedRank} on this device");
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

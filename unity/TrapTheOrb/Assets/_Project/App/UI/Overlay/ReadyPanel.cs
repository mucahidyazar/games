using TrapTheOrb.App.Content;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>
    /// The start screen (ReadyPanel.tsx): the mode menu next to the chosen mode's details, or Custom's setup.
    /// The body scrolls and the footer with Play stays in view.
    /// </summary>
    public sealed class ReadyPanel : Panel
    {
        private readonly OverlayActions actions;
        private readonly ModeList modeList;
        private readonly Label title;
        private readonly Label badge;
        private readonly Label continueText;
        private readonly Button changeSetup;
        private readonly VisualElement continueBlock;
        private readonly CustomSettingsForm customForm;
        private readonly Label description;
        private readonly VisualElement chips;
        private readonly VisualElement details;
        private readonly Label rankingNote;
        private readonly VisualElement buttons;
        private readonly VisualElement layout;
        private string shownButtons;
        private bool isEditingSetup;
        private GameMode? shownMode;

        public ReadyPanel(OverlayActions actions) : base(isMenu: true)
        {
            this.actions = actions;
            modeList = new ModeList(mode => actions.SelectMode?.Invoke(mode));

            title = Ui.Text(string.Empty, "ready__title");
            badge = Ui.Text(string.Empty, "ready__badge");
            VisualElement heading = Ui.Div("ready__heading").Children(
                title, badge, Ui.Div("ready__how").Children(Controls.TextButton("How to play", () => actions.OpenHowToPlay?.Invoke())));

            continueText = Ui.Text(string.Empty, "ready__text");
            changeSetup = Controls.TextButton("Change setup", () =>
            {
                isEditingSetup = true;
                Refresh();
            });
            continueBlock = Ui.Div("ready__continue").Children(continueText, changeSetup);
            customForm = new CustomSettingsForm(custom => actions.ChangeCustom?.Invoke(custom));
            description = Ui.Text(string.Empty, "ready__text", "ready__description");
            chips = Ui.Div("chips");
            details = Ui.Div("ready__details").Children(description, chips);

            var body = new ScrollView(ScrollViewMode.Vertical) { horizontalScrollerVisibility = ScrollerVisibility.Hidden };
            body.AddToClassList("ready__body");
            body.contentContainer.AddToClassList("ready__body-content");
            body.Add(heading);
            body.Add(continueBlock);
            body.Add(customForm);
            body.Add(details);

            rankingNote = Ui.Text(string.Empty, "ready__note");
            buttons = Ui.Div("ready__buttons");
            VisualElement footer = Ui.Div("ready__footer").Children(
                Ui.Div("ready__note-block").Children(rankingNote, Ui.Text("Tap to build · Swipe to turn", "ready__controls")),
                buttons);

            layout = Ui.Div("ready").Children(modeList, Ui.Div("ready__main").Children(body, footer));
            Add(layout);
        }

        public override OverlayKind Kind => OverlayKind.Ready;

        public override bool IsTopAligned(OverlayModel model) => model.IsNarrow;

        private OverlayModel model;

        public override void Show(OverlayModel next)
        {
            if (shownMode != next.Hud.Mode) isEditingSetup = false;
            shownMode = next.Hud.Mode;
            model = next;
            Refresh();
        }

        private void Refresh()
        {
            if (model == null) return;
            GameMode mode = model.Hud.Mode;
            ModeInfo info = ModeContent.Info(mode);
            bool isCustom = mode == GameMode.Custom;
            SavedRun savedRun = model.SavedRun?.Mode == mode ? model.SavedRun : null;
            bool isSetup = isCustom && (savedRun == null || isEditingSetup);
            SavedRun continuing = isSetup ? null : savedRun;

            layout.EnableInClassList("ready--narrow", model.IsNarrow);
            modeList.Show(mode);
            title.SetText(continuing != null ? $"Continue from level {continuing.Level}" : isSetup ? "Set up your game" : info.Tagline);
            badge.SetText(model.Hud.RankedMode ? "RANKED" : "PRACTICE");
            badge.EnableInClassList("ready__badge--ranked", model.Hud.RankedMode);

            continueBlock.SetVisible(continuing != null);
            if (continuing != null)
            {
                continueText.SetText($"{info.Name} · {Format.Number(continuing.Score)} points so far. Pick up where you left off, or start a fresh run.");
                changeSetup.SetVisible(isCustom);
            }

            customForm.SetVisible(isSetup);
            if (isSetup) customForm.Show(model.Settings.Custom);

            details.SetVisible(continuing == null && !isSetup);
            if (continuing == null && !isSetup)
            {
                description.SetText(info.Description);
                ShowChips(ModeContent.RuleChips(mode, model.Custom));
            }

            rankingNote.SetText(model.Hud.RankedMode ? "Your best runs are saved on this device." : "Practice mode — never ranked.");
            ShowButtons(info, continuing);
        }

        private void ShowChips(System.Collections.Generic.IReadOnlyList<string> texts)
        {
            string key = string.Join("|", texts);
            if (key == shownChips) return;
            shownChips = key;
            chips.Clear();
            foreach (string text in texts) chips.Add(Controls.Chip(text));
        }

        private string shownChips;

        private void ShowButtons(ModeInfo info, SavedRun continuing)
        {
            string key = continuing != null ? $"continue:{continuing.Level}:{continuing.Score}" : $"play:{info.Id}";
            if (key == shownButtons) return;
            shownButtons = key;
            buttons.Clear();
            if (continuing != null)
            {
                buttons.Add(Controls.Action("New game", () => actions.Start?.Invoke(), isPrimary: false));
                buttons.Add(Controls.Action("Continue", () => actions.ContinueSaved?.Invoke(continuing), "play"));
            }
            else
            {
                buttons.Add(Controls.Action($"Play {info.Short}", () => actions.Start?.Invoke(), "play"));
            }
        }
    }
}

using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>Every mode as a large row: ranked challenges first, then practice. Custom opens its setup.</summary>
    public sealed class ModeSheet : SheetContent
    {
        private readonly OverlayActions actions;
        private readonly List<ModeRow> rows = new List<ModeRow>();

        public ModeSheet(OverlayActions actions)
        {
            this.actions = actions;
            AddToClassList("mode-sheet");

            VisualElement ranked = Ui.Div("mode-list");
            VisualElement practice = Ui.Div("mode-list");
            foreach (ModeInfo info in ModeContent.Modes)
            {
                var row = new ModeRow(info, () => Pick(info.Id));
                rows.Add(row);
                (Modes.IsRanked(info.Id) ? ranked : practice).Add(row.Root);
            }
            Add(Ui.Text("Challenges", "group-label", "group-label--first"));
            Add(ranked);
            Add(Ui.Text("Practice", "group-label"));
            Add(practice);
        }

        public override string Title => "Choose a mode";

        public override void Show(OverlayModel model)
        {
            foreach (ModeRow row in rows) row.Show(model.Hud.Mode, model.Player.HighScores);
        }

        private void Pick(GameMode mode)
        {
            actions.SelectMode?.Invoke(mode);
            if (mode == GameMode.Custom) actions.OpenSheet?.Invoke(SheetKind.CustomSetup);
            else actions.CloseSheet?.Invoke();
        }

        private sealed class ModeRow
        {
            private readonly ModeInfo info;
            private readonly Label trail;
            private readonly VisualElement tick;

            public ModeRow(ModeInfo info, System.Action onPick)
            {
                this.info = info;
                trail = Ui.Text(string.Empty, "row__trail");
                tick = Ui.Icon("check", "mode-row__tick");
                Root = Ui.Button(onPick, "row", "mode-row").Children(
                    Ui.Div("tile", "tile--" + info.Id.Id()).Children(Ui.Icon(ModeContent.IconName(info.Id))),
                    Ui.Div("row__text").Children(Ui.Text(info.Name, "row__title"), Ui.Text(info.Tagline, "row__subtitle")),
                    trail,
                    tick);
            }

            public Button Root { get; }

            public void Show(GameMode current, IReadOnlyList<HighScore> scores)
            {
                bool isCurrent = info.Id == current;
                Root.EnableInClassList("mode-row--current", isCurrent);
                tick.SetVisible(isCurrent);
                trail.SetVisible(!isCurrent);
                if (isCurrent) return;
                if (info.Id == GameMode.Custom)
                {
                    trail.SetText("Set up");
                    return;
                }
                IReadOnlyList<HighScore> best = Modes.IsRanked(info.Id) ? HighScores.For(scores, info.Id) : new HighScore[0];
                trail.SetText(best.Count > 0 ? Format.Compact(best[0].Score) : string.Empty);
            }
        }
    }

    /// <summary>The Custom mode's rules: a preset to start from, then a slider for each rule.</summary>
    public sealed class CustomSheet : SheetContent
    {
        private readonly Overlay.CustomSettingsForm form;

        public CustomSheet(OverlayActions actions)
        {
            AddToClassList("custom-sheet");
            form = new Overlay.CustomSettingsForm(custom => actions.ChangeCustom?.Invoke(custom));
            Add(Ui.Scroll("info-sheet__scroll").Children(form));
            Add(Ui.Div("custom-sheet__footer").Children(Controls.Primary("Done", () => actions.CloseSheet?.Invoke(), "check")));
        }

        public override string Title => "Custom game";

        public override void Show(OverlayModel model) => form.Show(model.Settings.Custom);
    }
}

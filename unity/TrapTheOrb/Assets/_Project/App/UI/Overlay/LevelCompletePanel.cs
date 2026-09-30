using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>"Level 3 cleared!" with the bonuses and a look at the next level (LevelCompletePanel.tsx).</summary>
    public sealed class LevelCompletePanel : Panel
    {
        private readonly Label title;
        private readonly Label summary;
        private readonly BonusRow territory;
        private readonly BonusRow livesBonus;
        private readonly BonusRow timeBonus;
        private readonly BonusRow wallBonus;
        private readonly Label score;
        private readonly VisualElement next;
        private readonly Label nextLabel;
        private readonly Label nextText;
        private readonly OrbLineup nextOrbs = new OrbLineup();

        public LevelCompletePanel(OverlayActions actions)
        {
            Add(Ui.Div("panel__badge").Children(Ui.Icon("check", "panel__badge-icon")));
            title = Ui.Text(string.Empty, "panel__title", "panel__title--spaced");
            summary = Ui.Text(string.Empty, "panel__subtitle", "panel__subtitle--spaced");
            Add(title);
            Add(summary);

            territory = new BonusRow("Territory bonus");
            livesBonus = new BonusRow("Lives bonus");
            timeBonus = new BonusRow("Speed bonus");
            wallBonus = new BonusRow("Unused walls bonus");
            score = Ui.Text(string.Empty, "bonus__total-value");
            Add(Ui.Div("bonus").Children(territory.Root, livesBonus.Root, timeBonus.Root, wallBonus.Root,
                Ui.Div("bonus__row", "bonus__row--total").Children(Ui.Text("Score", "bonus__total-label"), score)));

            nextLabel = Ui.Text(string.Empty, "next-level__label");
            nextText = Ui.Text(string.Empty, "next-level__text");
            next = Ui.Div("next-level").Children(Ui.Div("next-level__info").Children(nextLabel, nextText), nextOrbs);
            Add(next);

            Add(Ui.Div("panel__actions").Children(
                Controls.Action("Next level", () => actions.NextLevel?.Invoke(), "arrow-right", iconAfter: true)));
        }

        public override OverlayKind Kind => OverlayKind.LevelComplete;

        public override void Show(OverlayModel model)
        {
            HudSnapshot hud = model.Hud;
            LevelResult result = hud.LastResult;
            if (result == null) return;

            string lives = hud.InfiniteLives
                ? "unlimited lives"
                : $"{result.LivesLeft} {Format.Plural(result.LivesLeft, "life", "lives")} left";
            title.SetText($"Level {result.Level} cleared!");
            summary.SetText($"{(int)System.Math.Floor(result.Percent)}% captured · {Format.Clock(result.ElapsedMs)} · {lives}");

            territory.Show(result.AreaBonus);
            livesBonus.Root.SetVisible(!hud.InfiniteLives);
            livesBonus.Show(result.LivesBonus);
            timeBonus.SetLabel(hud.TimeLeftMs == null ? "Speed bonus" : "Time left bonus");
            timeBonus.Show(result.TimeBonus);
            wallBonus.Root.SetVisible(hud.WallBudget != null);
            wallBonus.Show(result.WallBonus);
            score.SetText(Format.Number(hud.Score));

            NextLevelPreview preview = hud.NextLevel;
            next.SetVisible(preview != null);
            if (preview == null) return;
            nextLabel.SetText($"NEXT · LEVEL {preview.Level}");
            nextText.SetText(ModeContent.DescribeLevelChange(hud.OrbTiers, new NextLevelLine(preview.OrbTiers, preview.Change)));
            nextOrbs.Show(preview.OrbTiers);
        }

        private sealed class BonusRow
        {
            private readonly Label label;
            private readonly Label value;

            public BonusRow(string name)
            {
                label = Ui.Text(name, "bonus__label");
                value = Ui.Text(string.Empty, "bonus__value");
                Root = Ui.Div("bonus__row").Children(label, value);
            }

            public VisualElement Root { get; }

            public void SetLabel(string text) => label.SetText(text);

            public void Show(long points)
            {
                value.SetText("+" + Format.Number(points));
                value.EnableInClassList("bonus__value--positive", points > 0);
            }
        }
    }
}

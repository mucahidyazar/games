using System.Collections.Generic;
using System.Linq;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>A cleared level: the points it earned, what the next level brings, and the button to go on.</summary>
    public sealed class LevelSheet : SheetContent
    {
        private readonly Label title;
        private readonly Label summary;
        private readonly BonusRow territory = new BonusRow("Territory bonus");
        private readonly BonusRow livesBonus = new BonusRow("Lives bonus");
        private readonly BonusRow timeBonus = new BonusRow("Speed bonus");
        private readonly BonusRow wallBonus = new BonusRow("Unused walls bonus");
        private readonly Label total;
        private readonly VisualElement next;
        private readonly Label nextTitle;
        private readonly Label nextText;
        private readonly OrbLineup nextOrbs = new OrbLineup();

        public LevelSheet(OverlayActions actions)
        {
            AddToClassList("level-sheet");
            title = Ui.Text(string.Empty, "sheet-heading", "sheet-heading--center");
            summary = Ui.Text(string.Empty, "sheet-subheading", "sheet-subheading--center");
            total = Ui.Text(string.Empty, "tally__total-value");
            nextTitle = Ui.Text(string.Empty, "next-level__title");
            nextText = Ui.Text(string.Empty, "next-level__text");
            next = Ui.Div("next-level").Children(Ui.Div("next-level__text-block").Children(nextTitle, nextText), nextOrbs);

            Add(Ui.Div("medal").Children(Ui.Icon("check", "medal__icon")));
            Add(title);
            Add(summary);
            Add(Ui.Div("tally").Children(territory.Root, livesBonus.Root, timeBonus.Root, wallBonus.Root,
                Ui.Div("tally__row", "tally__row--total").Children(Ui.Text("Score", "tally__total-label"), total)));
            Add(next);
            Add(Controls.Primary("Next level", () => actions.NextLevel?.Invoke(), "arrow-right", iconAfter: true));
        }

        public override bool IsDismissible => false;

        public override void Show(OverlayModel model)
        {
            HudSnapshot hud = model.Hud;
            LevelResult result = hud.LastResult;
            if (result == null) return;

            string lives = hud.InfiniteLives
                ? "unlimited lives"
                : $"{result.LivesLeft} {Format.Plural(result.LivesLeft, "life", "lives")} left";
            title.SetText($"Level {result.Level} cleared");
            summary.SetText($"{(int)System.Math.Floor(result.Percent)}% captured · {Format.ShortClock(result.ElapsedMs)} · {lives}");

            territory.Show(result.AreaBonus);
            livesBonus.Root.SetVisible(!hud.InfiniteLives);
            livesBonus.Show(result.LivesBonus);
            timeBonus.SetLabel(hud.TimeLeftMs == null ? "Speed bonus" : "Time left bonus");
            timeBonus.Show(result.TimeBonus);
            wallBonus.Root.SetVisible(hud.WallBudget != null);
            wallBonus.Show(result.WallBonus);
            total.SetText(Format.Number(hud.Score));

            NextLevelPreview preview = hud.NextLevel;
            next.SetVisible(preview != null);
            if (preview == null) return;
            nextTitle.SetText($"Next: level {preview.Level}");
            string change = ModeContent.DescribeLevelChange(hud.OrbTiers, new NextLevelLine(preview.OrbTiers, preview.Change));
            nextText.SetText($"{change} {SpeedSummary(preview.OrbTiers)}");
            nextOrbs.Show(preview.OrbTiers);
        }

        /// <summary>The orbs' speeds in words, so they never rely on colour alone: "2 calm, 1 quick."</summary>
        public static string SpeedSummary(ReadOnlyArray<int> tiers)
        {
            var counts = new SortedDictionary<int, int>();
            foreach (int tier in tiers) counts[tier] = counts.TryGetValue(tier, out int count) ? count + 1 : 1;
            IEnumerable<string> parts = counts.Select(entry => $"{entry.Value} {ModeContent.TierName(entry.Key).ToLowerInvariant()}");
            string text = string.Join(", ", parts);
            return text.Length == 0 ? string.Empty : char.ToUpperInvariant(text[0]) + text.Substring(1) + ".";
        }

        private sealed class BonusRow
        {
            private readonly Label label;
            private readonly Label value;

            public BonusRow(string name)
            {
                label = Ui.Text(name, "tally__label");
                value = Ui.Text(string.Empty, "tally__value");
                Root = Ui.Div("tally__row").Children(label, value);
            }

            public VisualElement Root { get; }

            public void SetLabel(string text) => label.SetText(text);

            public void Show(long points)
            {
                value.SetText("+" + Format.Number(points));
                value.EnableInClassList("tally__value--zero", points <= 0);
            }
        }
    }
}

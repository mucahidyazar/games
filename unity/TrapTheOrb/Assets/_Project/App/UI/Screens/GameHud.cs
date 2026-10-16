using System;
using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// The HUD over the field: pause, progress toward the level's target, lives, and the level with the score in
    /// one row. Modes with a countdown or a wall budget get a slim second row for them, so the first row fits the
    /// narrowest phones.
    /// </summary>
    public sealed class GameHud : VisualElement
    {
        /// <summary>More lives than this are shown as one heart and a count.</summary>
        private const int MaxHearts = 3;

        /// <summary>The countdown turns red in its last seconds.</summary>
        private const long WarnBelowMs = 10_000;

        private readonly AreaRing ring = new AreaRing();
        private readonly Label percent;
        private readonly Label target;
        private readonly VisualElement status;
        private readonly VisualElement timeChip;
        private readonly Label timeText;
        private readonly VisualElement wallsChip;
        private readonly Label wallsText;
        private readonly VisualElement hearts;
        private readonly Label livesCount;
        private readonly Label level;
        private readonly Label score;
        private readonly List<VisualElement> heartIcons = new List<VisualElement>();

        public GameHud(Action onPause)
        {
            AddToClassList("hud");

            percent = Ui.Text(string.Empty, "hud__percent");
            target = Ui.Text(string.Empty, "hud__target");
            VisualElement area = Ui.Div("hud__area").Children(ring, Ui.Div("hud__area-text").Children(percent, target));

            hearts = Ui.Div("hud__hearts");
            livesCount = Ui.Text(string.Empty, "hud__lives-count");
            level = Ui.Text(string.Empty, "hud__level");
            score = Ui.Text(string.Empty, "hud__score");

            Add(Ui.Div("hud__main").Children(
                Controls.IconButton("pause", onPause).WithClass("hud__pause"),
                area,
                Ui.Div("hud__spacer"),
                Ui.Div("hud__lives").Children(hearts, livesCount),
                Ui.Div("hud__score-block").Children(level, score)));

            timeText = Ui.Text(string.Empty, "hud__chip-text");
            timeChip = Ui.Div("hud__chip").Children(Ui.Icon("clock", "hud__chip-icon"), timeText);
            wallsText = Ui.Text(string.Empty, "hud__chip-text");
            wallsChip = Ui.Div("hud__chip").Children(Ui.Icon("walls", "hud__chip-icon"), wallsText);
            status = Ui.Div("hud__status").Children(timeChip, wallsChip);
            Add(status);
        }

        public void Show(HudSnapshot hud)
        {
            ring.Show(hud.Percent, hud.TargetPercent);
            percent.SetText(hud.Percent + "%");
            target.SetText($"of {hud.TargetPercent}%");

            timeChip.SetVisible(hud.TimeLeftMs != null);
            if (hud.TimeLeftMs is long timeLeft)
            {
                timeText.SetText(Format.ShortClock(timeLeft));
                timeChip.EnableInClassList("hud__chip--warn", timeLeft <= WarnBelowMs);
            }

            wallsChip.SetVisible(hud.WallsLeft != null);
            if (hud.WallsLeft is int walls)
            {
                wallsText.SetText($"{walls} {Format.Plural(walls, "wall", "walls")} left");
                wallsChip.EnableInClassList("hud__chip--warn", walls <= 1);
            }
            status.SetVisible(hud.TimeLeftMs != null || hud.WallsLeft != null);

            ShowLives(hud);
            level.SetText($"Level {hud.Level}");
            score.SetText(hud.Score >= 100_000 ? Format.Compact(hud.Score) : Format.Number(hud.Score));
        }

        private void ShowLives(HudSnapshot hud)
        {
            bool isCounted = hud.InfiniteLives || hud.MaxLives > MaxHearts;
            int shown = isCounted ? 1 : Math.Max(1, hud.MaxLives);
            while (heartIcons.Count < shown)
            {
                VisualElement heart = Ui.Icon("heart", "hud__heart");
                heartIcons.Add(heart);
                hearts.Add(heart);
            }
            while (heartIcons.Count > shown)
            {
                heartIcons[heartIcons.Count - 1].RemoveFromHierarchy();
                heartIcons.RemoveAt(heartIcons.Count - 1);
            }
            for (int i = 0; i < heartIcons.Count; i++)
            {
                heartIcons[i].EnableInClassList("hud__heart--lost", isCounted ? hud.Lives <= 0 && !hud.InfiniteLives : i >= hud.Lives);
            }

            livesCount.SetVisible(isCounted);
            if (isCounted) livesCount.SetText(hud.InfiniteLives ? "∞" : "×" + hud.Lives);
        }
    }
}

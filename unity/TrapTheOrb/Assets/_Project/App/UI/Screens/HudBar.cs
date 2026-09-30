using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>One compact bar with every live statistic of the current level (HudBar.tsx).</summary>
    public sealed class HudBar : VisualElement
    {
        /// <summary>Time left at which the countdown turns red.</summary>
        private const long LowTimeMs = 10_000;
        private const int LowWalls = 2;

        private readonly Stat area;
        private readonly Stat lives;
        private readonly Stat speed;
        private readonly Stat walls;
        private readonly Stat time;
        private readonly Stat score;
        private readonly AreaRing areaRing = new AreaRing();
        private readonly SpeedGauge speedGauge = new SpeedGauge();

        public HudBar()
        {
            AddToClassList("hud");
            area = new Stat("Area", areaRing);
            lives = new Stat("Lives", Ui.Icon("heart", "hud-stat__glyph", "hud-stat__glyph--heart"));
            speed = new Stat("Speed", speedGauge);
            walls = new Stat("Walls", Ui.Icon("walls", "hud-stat__glyph", "hud-stat__glyph--walls"));
            time = new Stat("Time", Ui.Icon("clock", "hud-stat__glyph", "hud-stat__glyph--clock"));
            score = new Stat("Score", Ui.Icon("star", "hud-stat__glyph", "hud-stat__glyph--star"));
            area.Root.AddToClassList("hud-stat--first");
            Add(Controls.Card("hud__card").Children(area.Root, lives.Root, speed.Root, walls.Root, time.Root, score.Root));
        }

        /// <summary><paramref name="isWide"/>: tablet widths show icons and exact numbers, like the web's sm: layout.</summary>
        public void Show(HudSnapshot hud, bool isWide)
        {
            EnableInClassList("hud--wide", isWide);
            bool isPlaying = hud.Status == HudStatus.Playing;
            bool hasWalls = hud.WallsLeft != null && hud.WallBudget != null;
            bool isTimed = hud.TimeLeftMs != null;

            area.Show(Format.Percent(hud.Percent));
            areaRing.Show(hud.Percent, hud.TargetPercent);

            lives.Show(hud.InfiniteLives ? "∞" : hud.Lives.ToString(), isPlaying && !hud.InfiniteLives && hud.Lives == 1);
            speed.Show(Format.Speed(hud.TopSpeedFactor));
            speedGauge.Show(hud.TopSpeedFactor, hud.MaxSpeedFactor);

            walls.Root.SetVisible(hasWalls);
            if (hasWalls) walls.Show(hud.WallsLeft.ToString(), isPlaying && hud.WallsLeft <= LowWalls);

            time.SetLabel(isTimed ? "Left" : "Time");
            time.Glyph.EnableInClassList("hud-stat__glyph--timed", isTimed);
            time.Show(Format.Clock(hud.TimeLeftMs ?? hud.ElapsedMs), isPlaying && isTimed && hud.TimeLeftMs <= LowTimeMs);

            score.Show(isWide ? Format.Number(hud.Score) : Format.Compact(hud.Score));
        }

        /// <summary>One labelled value with an optional icon.</summary>
        private sealed class Stat
        {
            private readonly Label label;
            private readonly Label value;

            public Stat(string name, VisualElement glyph)
            {
                Glyph = glyph;
                label = Ui.Text(name.ToUpperInvariant(), "hud-stat__label");
                value = Ui.Text(string.Empty, "hud-stat__value");
                Root = Ui.Div("hud-stat").Children(
                    Ui.Div("hud-stat__icon").Children(glyph),
                    Ui.Div("hud-stat__text").Children(label, value));
            }

            public VisualElement Root { get; }
            public VisualElement Glyph { get; }

            public void SetLabel(string text) => label.SetText(text.ToUpperInvariant());

            public void Show(string text, bool isAlert = false)
            {
                value.SetText(text);
                value.EnableInClassList("hud-stat__value--alert", isAlert);
            }
        }
    }
}

using System;
using System.Linq;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>Custom mode setup: a preset to start from, then every rule on its own slider (CustomSettingsForm.tsx).</summary>
    public sealed class CustomSettingsForm : VisualElement
    {
        /// <summary>More orbs than this are shown as a number only; the dots would crowd the label.</summary>
        private const int MaxDots = 6;
        private const int DefaultLives = 3;
        private const int DefaultWalls = 16;
        private const int DefaultTimeLimit = 120;

        private readonly Action<CustomSettings> onChange;
        private readonly (CustomPreset Preset, Button Button)[] presets;
        private readonly Setting orbs;
        private readonly Setting speed;
        private readonly Setting target;
        private readonly Setting lives;
        private readonly Setting walls;
        private readonly Setting timer;
        private readonly OrbLineup orbDots = new OrbLineup(isSmall: true);
        private readonly OrbLineup speedDot = new OrbLineup(isSmall: true);
        private CustomSettings value;

        public CustomSettingsForm(Action<CustomSettings> onChange)
        {
            this.onChange = onChange;
            AddToClassList("custom-form");

            presets = ModeContent.PresetLabels.Keys
                .Select(preset => (preset, Ui.Button(() => Change(Modes.Preset(preset)), "preset").Children(
                    Ui.Text(ModeContent.PresetLabels[preset], "preset__label"))))
                .ToArray();
            VisualElement presetBar = Ui.Div("preset-bar");
            foreach ((CustomPreset _, Button button) in presets) presetBar.Add(button);
            Add(presetBar);

            orbs = new Setting("Orbs", Modes.OrbCountLimits, 1, v => Change(value with { OrbCount = (int)v }), orbDots);
            speed = new Setting("Speed", Modes.SpeedLimits, 0.1, v => Change(value with { Speed = Math.Round(v * 10) / 10 }), speedDot);
            target = new Setting("Clear at", Modes.TargetPercentLimits, 1, v => Change(value with { TargetPercent = (int)v }));
            lives = new Setting("Lives", Modes.LivesLimits, 1, v => Change(value with { Lives = (int)v }),
                limit: () => Change(value with { Lives = value.Lives == null ? DefaultLives : (int?)null }));
            walls = new Setting("Walls", Modes.WallsLimits, 1, v => Change(value with { Walls = (int)v }),
                limit: () => Change(value with { Walls = value.Walls == null ? DefaultWalls : (int?)null }));
            timer = new Setting("Timer", Modes.TimeLimitSecondsLimits, 10, v => Change(value with { TimeLimitSeconds = (int)v }),
                limit: () => Change(value with { TimeLimitSeconds = value.TimeLimitSeconds == null ? DefaultTimeLimit : (int?)null }));

            VisualElement grid = Ui.Div("custom-form__grid").Children(orbs.Root, speed.Root, target.Root, lives.Root, walls.Root, timer.Root);
            // Two columns when there is room, three on wide panels (the web's container queries).
            grid.RegisterCallback<GeometryChangedEvent>(evt =>
            {
                float width = evt.newRect.width;
                grid.EnableInClassList("custom-form__grid--two", width >= TwoColumnWidth && width < ThreeColumnWidth);
                grid.EnableInClassList("custom-form__grid--three", width >= ThreeColumnWidth);
            });
            Add(grid);
            Add(Ui.Text("∞ removes a limit. Lives, walls and the timer reset every level.", "custom-form__hint"));
        }

        private const float TwoColumnWidth = 260;
        private const float ThreeColumnWidth = 380;

        public void Show(CustomSettings settings)
        {
            value = settings;
            CustomPreset? preset = ModeContent.MatchingPreset(settings);
            foreach ((CustomPreset id, Button button) in presets) button.EnableInClassList("preset--current", preset == id);

            int orbTier = Levels.TierForSpeed(settings.Speed);
            orbs.Show(settings.OrbCount.ToString(), settings.OrbCount);
            orbDots.Show(Enumerable.Repeat(orbTier, Math.Min(settings.OrbCount, MaxDots)).ToList());
            speed.Show(Format.OneDecimal(settings.Speed) + "×", settings.Speed);
            speedDot.Show(new[] { orbTier });
            target.Show(settings.TargetPercent + "%", settings.TargetPercent);
            lives.Show(settings.Lives?.ToString() ?? "∞", settings.Lives ?? DefaultLives, settings.Lives == null);
            walls.Show(settings.Walls?.ToString() ?? "∞", settings.Walls ?? DefaultWalls, settings.Walls == null);
            timer.Show(settings.TimeLimitSeconds == null ? "∞" : settings.TimeLimitSeconds + " s",
                settings.TimeLimitSeconds ?? DefaultTimeLimit, settings.TimeLimitSeconds == null);
        }

        private void Change(CustomSettings next)
        {
            CustomSettings clean = Modes.SanitizeCustomSettings(next);
            Show(clean);
            onChange?.Invoke(clean);
        }

        /// <summary>A label, its value and a slider; limits also get an "∞" switch.</summary>
        private sealed class Setting
        {
            private readonly Label valueLabel;
            private readonly RangeSlider slider;
            private readonly Button limitButton;

            public Setting(string label, SettingRange range, double step, Action<double> onSlide, VisualElement extra = null, Action limit = null)
            {
                valueLabel = Ui.Text(string.Empty, "setting__value");
                slider = new RangeSlider(range.Min, range.Max, step, onSlide);
                VisualElement head = Ui.Div("setting__head").Children(Ui.Text(label, "setting__label"),
                    Ui.Div("setting__value-row").Children(valueLabel, extra));
                if (limit != null)
                {
                    limitButton = Ui.Button(limit, "limit-toggle").Children(Ui.Text("∞", "limit-toggle__label"));
                    head.Add(limitButton);
                }
                Root = Ui.Div("setting").Children(head, Ui.Div("setting__slider").Children(slider));
            }

            public VisualElement Root { get; }

            public void Show(string text, double sliderValue, bool isUnlimited = false)
            {
                valueLabel.SetText(text);
                slider.Value = sliderValue;
                slider.IsDisabled = isUnlimited;
                limitButton?.EnableInClassList("limit-toggle--on", isUnlimited);
            }
        }
    }
}

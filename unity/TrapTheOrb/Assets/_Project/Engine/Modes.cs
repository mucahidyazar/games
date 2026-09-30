using System;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    public enum CustomPreset
    {
        Easy,
        Normal,
        Hard,
        Expert,
    }

    /// <summary>An allowed range for one Custom setting.</summary>
    public readonly struct SettingRange
    {
        public SettingRange(double min, double max)
        {
            Min = min;
            Max = max;
        }

        public double Min { get; }
        public double Max { get; }

        public double Clamp(double value) => Math.Min(Max, Math.Max(Min, value));
    }

    /// <summary>
    /// A Custom setting as it arrives from storage: missing, explicitly unlimited (null) or a number that may be
    /// out of range. <see cref="Modes.SanitizeCustomSettings(RawCustomSettings)"/> turns it into valid rules.
    /// </summary>
    public readonly struct RawSetting
    {
        private RawSetting(bool isPresent, double? number)
        {
            IsPresent = isPresent;
            Number = number;
        }

        public bool IsPresent { get; }

        /// <summary>The number, or null when the stored value was an explicit "unlimited".</summary>
        public double? Number { get; }

        public static RawSetting Missing => default;
        public static RawSetting Unlimited => new RawSetting(true, null);

        public static RawSetting Of(double value) => new RawSetting(true, value);

        /// <summary>A stored limit: a number, or null for "unlimited".</summary>
        public static RawSetting OfLimit(int? value) => value.HasValue ? Of(value.Value) : Unlimited;
    }

    public sealed record RawCustomSettings(
        RawSetting OrbCount,
        RawSetting Speed,
        RawSetting Lives,
        RawSetting Walls,
        RawSetting TimeLimitSeconds,
        RawSetting TargetPercent)
    {
        public static RawCustomSettings From(CustomSettings settings) => new RawCustomSettings(
            RawSetting.Of(settings.OrbCount),
            RawSetting.Of(settings.Speed),
            RawSetting.OfLimit(settings.Lives),
            RawSetting.OfLimit(settings.Walls),
            RawSetting.OfLimit(settings.TimeLimitSeconds),
            RawSetting.Of(settings.TargetPercent));
    }

    public static class Modes
    {
        private const double SpeedStepsPerUnit = 10;

        public static readonly ReadOnlyArray<GameMode> All = ReadOnlyArray<GameMode>.From(new[]
        {
            GameMode.Classic, GameMode.Daily, GameMode.TimeAttack, GameMode.LimitedWalls, GameMode.Hardcore, GameMode.Zen,
            GameMode.Custom,
        });

        /// <summary>Modes with fixed rules. Only these reach leaderboards and earn badges.</summary>
        public static readonly ReadOnlyArray<GameMode> Ranked = ReadOnlyArray<GameMode>.From(new[]
        {
            GameMode.Classic, GameMode.Daily, GameMode.TimeAttack, GameMode.LimitedWalls, GameMode.Hardcore,
        });

        public static readonly SettingRange OrbCountLimits = new SettingRange(1, 12);
        public static readonly SettingRange SpeedLimits = new SettingRange(0.6, 2);
        public static readonly SettingRange LivesLimits = new SettingRange(1, 9);
        public static readonly SettingRange WallsLimits = new SettingRange(3, 40);
        public static readonly SettingRange TimeLimitSecondsLimits = new SettingRange(30, 300);
        public static readonly SettingRange TargetPercentLimits = new SettingRange(50, 95);

        private static readonly Dictionary<CustomPreset, CustomSettings> PresetTable = new Dictionary<CustomPreset, CustomSettings>
        {
            [CustomPreset.Easy] = new CustomSettings(2, 0.8, null, null, null, 70),
            [CustomPreset.Normal] = new CustomSettings(3, 1, 4, null, null, 75),
            [CustomPreset.Hard] = new CustomSettings(5, 1.3, 3, 16, 120, 80),
            [CustomPreset.Expert] = new CustomSettings(8, 1.6, 2, 18, 90, 85),
        };

        /// <summary>Starting points for Custom; the player can fine-tune every value.</summary>
        public static CustomSettings Preset(CustomPreset preset) => PresetTable[preset];

        public static bool IsRanked(GameMode mode) => mode != GameMode.Zen && mode != GameMode.Custom;

        /// <summary>Clamps untrusted Custom settings into the allowed ranges; missing values fall back to Normal.</summary>
        public static CustomSettings SanitizeCustomSettings(RawCustomSettings raw)
        {
            CustomSettings fallback = Preset(CustomPreset.Normal);
            if (raw == null) return fallback;

            double speed = raw.Speed.Number is double rawSpeed && JsMath.IsFinite(rawSpeed)
                ? JsMath.Round(SpeedLimits.Clamp(rawSpeed) * SpeedStepsPerUnit) / SpeedStepsPerUnit
                : fallback.Speed;

            return new CustomSettings(
                WholeNumber(raw.OrbCount, OrbCountLimits, fallback.OrbCount),
                speed,
                OptionalWholeNumber(raw.Lives, LivesLimits, fallback.Lives),
                OptionalWholeNumber(raw.Walls, WallsLimits, fallback.Walls),
                OptionalWholeNumber(raw.TimeLimitSeconds, TimeLimitSecondsLimits, fallback.TimeLimitSeconds),
                WholeNumber(raw.TargetPercent, TargetPercentLimits, fallback.TargetPercent));
        }

        public static CustomSettings SanitizeCustomSettings(CustomSettings settings) =>
            SanitizeCustomSettings(settings == null ? null : RawCustomSettings.From(settings));

        private static int WholeNumber(RawSetting value, SettingRange range, int fallback) =>
            value.Number is double number && JsMath.IsFinite(number) ? (int)range.Clamp(JsMath.Round(number)) : fallback;

        /// <summary>Like <see cref="WholeNumber"/>, but an explicit null ("unlimited") is a valid choice.</summary>
        private static int? OptionalWholeNumber(RawSetting value, SettingRange range, int? fallback)
        {
            if (value.IsPresent && value.Number == null) return null;
            return value.Number is double number && JsMath.IsFinite(number) ? (int)range.Clamp(JsMath.Round(number)) : fallback;
        }

        /// <summary>The rules a mode plays by. Custom settings are sanitised before use.</summary>
        public static ModeRules RulesFor(GameMode mode, CustomSettings custom = null)
        {
            var rules = new ModeRules(mode, IsRanked(mode), LivesPolicy.PerLevel, 0, false, false, null);

            switch (mode)
            {
                case GameMode.TimeAttack:
                    return rules with { Timed = true };
                case GameMode.LimitedWalls:
                    return rules with { LimitedWalls = true };
                case GameMode.Hardcore:
                    return rules with { LivesPolicy = LivesPolicy.PerRun, RunLives = Constants.HardcoreLives };
                case GameMode.Zen:
                    return rules with { LivesPolicy = LivesPolicy.Infinite };
                case GameMode.Custom:
                    CustomSettings settings = SanitizeCustomSettings(custom);
                    return rules with
                    {
                        LivesPolicy = settings.Lives == null ? LivesPolicy.Infinite : LivesPolicy.PerLevel,
                        Timed = settings.TimeLimitSeconds != null,
                        LimitedWalls = settings.Walls != null,
                        Custom = settings,
                    };
                default:
                    return rules;
            }
        }
    }
}

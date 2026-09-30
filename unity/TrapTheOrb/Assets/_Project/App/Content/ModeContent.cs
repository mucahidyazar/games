using System.Collections.Generic;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Content
{
    public sealed record ModeInfo(GameMode Id, string Name, string Short, string Icon, string Tagline, string Description);

    /// <summary>Copy about the modes, speed tiers and levels (modes/modeContent.ts).</summary>
    public static class ModeContent
    {
        /// <summary>Ranked modes first: fixed rules. Then the practice ones.</summary>
        public static readonly IReadOnlyList<ModeInfo> Modes = new[]
        {
            new ModeInfo(GameMode.Classic, "Classic", "Classic", "◆", "The original challenge",
                "Orbs join and speed up level by level. Lives reset every level."),
            new ModeInfo(GameMode.Daily, "Daily Challenge", "Daily", "☀", "Same levels for everyone today",
                "Classic rules on today’s shared layout. Everyone gets the same levels each day."),
            new ModeInfo(GameMode.TimeAttack, "Time Attack", "Time Attack", "⏱", "Beat the countdown",
                "Every level has a timer. When it hits zero, the run is over."),
            new ModeInfo(GameMode.LimitedWalls, "Limited Walls", "Limited Walls", "▦", "Make every wall count",
                "A small wall budget per level. Unused walls are worth bonus points."),
            new ModeInfo(GameMode.Hardcore, "Hardcore", "Hardcore", "♥", "One life. That’s it.",
                $"{Constants.HardcoreLives} life for the whole run. One broken wall and it’s over."),
            new ModeInfo(GameMode.Zen, "Zen", "Zen", "∞", "Unlimited lives, no pressure",
                "Practise at your own pace. Broken walls cost nothing. Not ranked."),
            new ModeInfo(GameMode.Custom, "Custom", "Custom", "⚙", "Set up your game",
                "Pick the orbs, speed, lives, walls and timer. Great for learning. Not ranked."),
        };

        public static ModeInfo Info(GameMode mode)
        {
            foreach (ModeInfo info in Modes)
            {
                if (info.Id == mode) return info;
            }
            return Modes[0];
        }

        /// <summary>
        /// The vector icon standing in for the mode's symbol (◆ ☀ ⏱ ▦ ♥ ∞ ⚙): most of them are missing from the
        /// game's font, and browsers only show them through system fallback fonts.
        /// </summary>
        public static string IconName(GameMode mode) => mode switch
        {
            GameMode.Daily => "mode-daily",
            GameMode.TimeAttack => "mode-time",
            GameMode.LimitedWalls => "mode-walls",
            GameMode.Hardcore => "mode-hardcore",
            GameMode.Zen => "mode-zen",
            GameMode.Custom => "mode-custom",
            _ => "mode-classic",
        };

        public static readonly IReadOnlyList<string> SpeedTierNames = new[] { "Calm", "Quick", "Fast", "Blazing" };

        public static string TierName(int tier) => SpeedTierNames[System.Math.Max(0, System.Math.Min(SpeedTierNames.Count - 1, tier))];

        public static readonly IReadOnlyDictionary<CustomPreset, string> PresetLabels = new Dictionary<CustomPreset, string>
        {
            [CustomPreset.Easy] = "Easy",
            [CustomPreset.Normal] = "Normal",
            [CustomPreset.Hard] = "Hard",
            [CustomPreset.Expert] = "Expert",
        };

        /// <summary>The preset matching the settings exactly, if any.</summary>
        public static CustomPreset? MatchingPreset(CustomSettings settings)
        {
            foreach (CustomPreset preset in PresetLabels.Keys)
            {
                if (Engine.Modes.Preset(preset) == settings) return preset;
            }
            return null;
        }

        /// <summary>Short rule reminders shown next to a mode, derived from the actual engine rules.</summary>
        public static IReadOnlyList<string> RuleChips(GameMode mode, CustomSettings custom)
        {
            ModeRules rules = Engine.Modes.RulesFor(mode, custom);
            LevelConfig first = Levels.ConfigFor(1, rules);
            var chips = new List<string>();

            if (rules.Custom != null) chips.AddRange(new[] { $"{rules.Custom.OrbCount} orbs", $"{Format.OneDecimal(rules.Custom.Speed)}× speed" });
            if (rules.LivesPolicy == LivesPolicy.Infinite) chips.Add("∞ lives");
            else if (rules.LivesPolicy == LivesPolicy.PerRun) chips.Add($"{rules.RunLives} life per run");
            else chips.Add(rules.Custom != null ? $"{first.Lives} lives" : "Lives reset each level");

            if (first.TimeLimitTicks is int ticks) chips.Add(rules.Custom != null ? $"{ticks / Constants.TicksPerSecond}s timer" : "Timer per level");
            if (first.WallBudget is int walls) chips.Add(rules.Custom != null ? $"{walls} walls" : "Wall budget");
            chips.Add($"Clear at {first.TargetPercent}%");
            if (!rules.Ranked) chips.Add("Not ranked");
            return chips;
        }

        /// <summary>One line about what the next level changes, e.g. "Two orbs get faster."</summary>
        public static string DescribeLevelChange(ReadOnlyArray<int> previousTiers, NextLevelLine next)
        {
            switch (next.Change)
            {
                case LevelChange.First:
                    return "One calm orb to warm up.";
                case LevelChange.NewOrb:
                    return "A new orb joins the field.";
                case LevelChange.Breather:
                    return "A new orb joins — the others ease off for a moment.";
                case LevelChange.Repeat:
                    return "Same rules, fresh layout.";
                default:
                    int faster = 0;
                    for (int index = 0; index < next.OrbTiers.Count; index++)
                    {
                        int before = index < previousTiers.Count ? previousTiers[index] : next.OrbTiers[index];
                        if (next.OrbTiers[index] > before) faster++;
                    }
                    return faster == 1 ? "One orb gets faster." : $"{(faster == 0 ? "The" : faster.ToString())} orbs get faster.";
            }
        }
    }

    /// <summary>The next level's orbs and what changed, as the "level cleared" card shows it.</summary>
    public readonly struct NextLevelLine
    {
        public NextLevelLine(ReadOnlyArray<int> orbTiers, LevelChange change)
        {
            OrbTiers = orbTiers;
            Change = change;
        }

        public ReadOnlyArray<int> OrbTiers { get; }
        public LevelChange Change { get; }
    }

    /// <summary>One tip per level, cycling (content/tips.ts), rewritten for touch screens.</summary>
    public static class Tips
    {
        private static readonly string[] All =
        {
            "Trap the orbs by dividing the space. The more area you capture, the higher your score!",
            "Swipe to build a wall in the direction of your swipe, or tap the ↕ button to switch.",
            "An orb that touches a wall while it is being built breaks it — and costs you a life.",
            "Orb colours show speed: blue is calm, orange quick, red fast and violet blazing.",
            "Each half of a wall grows on its own. One half can still finish if the other breaks.",
            "Every percent you capture above the target adds a territory bonus.",
            "Clear a level before its par time to add a speed bonus to your score.",
            "Build right behind an orb that is moving away from the line — it cannot turn around in time.",
            "Box an orb into a tiny pocket: the less room it has, the more of the field you can claim.",
        };

        public static string ForLevel(int level) => All[(System.Math.Max(1, level) - 1) % All.Length];
    }
}

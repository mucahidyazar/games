using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class LevelsTests
    {
        private static int[] Tiers(int level) => Levels.Plan(level).OrbTiers.ToArray();

        private static double SumOfSpeeds(int level) => Tiers(level).Sum(Constants.SpeedMultiplier);

        private static void AssertPlan(int level, int[] tiers, LevelChange change)
        {
            Assert.That(Tiers(level), Is.EqualTo(tiers), $"level {level} tiers");
            Assert.That(Levels.Plan(level).Change, Is.EqualTo(change), $"level {level} change");
        }

        [Test]
        public void Plan_OpensGentlyThenSpeedsOrbsUpOneAtATime()
        {
            AssertPlan(1, new[] { 0 }, LevelChange.First);
            AssertPlan(2, new[] { 0, 0 }, LevelChange.NewOrb);
            AssertPlan(3, new[] { 1, 0 }, LevelChange.SpeedUp);
            AssertPlan(4, new[] { 1, 1 }, LevelChange.SpeedUp);
        }

        [Test]
        public void Plan_LetsEveryoneCatchTheirBreathWhenANewOrbJoins()
        {
            AssertPlan(5, new[] { 0, 0, 0 }, LevelChange.Breather);
            Assert.That(Tiers(8), Is.EqualTo(new[] { 1, 1, 1 }));
            AssertPlan(9, new[] { 1, 1, 1, 1 }, LevelChange.NewOrb);
            Assert.That(Tiers(13), Is.EqualTo(new[] { 2, 2, 2, 2 }));
        }

        [Test]
        public void Plan_SpeedsUpTwoOrbsPerLevelOnceThereAreFive()
        {
            AssertPlan(14, new[] { 1, 1, 1, 1, 1 }, LevelChange.Breather);
            Assert.That(Tiers(15), Is.EqualTo(new[] { 2, 2, 1, 1, 1 }));
            Assert.That(Tiers(17), Is.EqualTo(new[] { 2, 2, 2, 2, 2 }));
        }

        [Test]
        public void Plan_NeverLowersTheOrbCountAndNeverExceedsTheTopSpeedTier()
        {
            int previousCount = 0;
            for (int level = 1; level <= 300; level++)
            {
                LevelPlan plan = Levels.Plan(level);
                Assert.That(plan.OrbTiers.Count, Is.GreaterThanOrEqualTo(previousCount));
                Assert.That(plan.OrbTiers.Max(), Is.LessThanOrEqualTo(Constants.MaxSpeedTier));
                if (plan.Change == LevelChange.SpeedUp) Assert.That(plan.OrbTiers.Count, Is.EqualTo(previousCount));
                previousCount = plan.OrbTiers.Count;
            }
        }

        [Test]
        public void Plan_AlwaysGetsHarderWithinAStageAndEveryStageStartsHarderThanTheLast()
        {
            double stageStart = 0;
            for (int level = 2; level <= 120; level++)
            {
                if (Levels.Plan(level).Change == LevelChange.SpeedUp)
                {
                    Assert.That(SumOfSpeeds(level), Is.GreaterThan(SumOfSpeeds(level - 1)), $"level {level}");
                }
                else
                {
                    Assert.That(SumOfSpeeds(level), Is.GreaterThan(stageStart), $"level {level}");
                    stageStart = SumOfSpeeds(level);
                }
            }
        }

        [Test]
        public void Plan_NormalisesInvalidLevelNumbers()
        {
            Assert.That(Tiers(0), Is.EqualTo(Tiers(1)));
            Assert.That(Tiers(-4), Is.EqualTo(Tiers(1)));
            Assert.That(Tiers(int.MaxValue), Is.EqualTo(Tiers(Levels.MaxLevel)));
        }

        [Test]
        public void ConfigFor_TurnsThePlanIntoClassicRules()
        {
            LevelConfig config = Levels.ConfigFor(3, Modes.RulesFor(GameMode.Classic));

            Assert.That(config.Level, Is.EqualTo(3));
            Assert.That(config.OrbCount, Is.EqualTo(2));
            Assert.That(config.OrbTiers.ToArray(), Is.EqualTo(new[] { 1, 0 }));
            Assert.That(config.OrbSpeeds.ToArray(), Is.EqualTo(new[] { Constants.BaseBallSpeed * 1.2, Constants.BaseBallSpeed }));
            Assert.That(config.Lives, Is.EqualTo(3));
            Assert.That(config.WallBudget, Is.Null);
            Assert.That(config.TimeLimitTicks, Is.Null);
            Assert.That(config.TargetPercent, Is.EqualTo(75));
            Assert.That(config.ParSeconds, Is.EqualTo(40));
            Assert.That(config.Change, Is.EqualTo(LevelChange.SpeedUp));
        }

        [Test]
        public void ConfigFor_AddsACountdownInTimeAttackAndAWallBudgetInLimitedWalls()
        {
            Assert.That(Levels.ConfigFor(5, Modes.RulesFor(GameMode.TimeAttack)).TimeLimitTicks, Is.EqualTo((30 + 15 * 3) * Constants.TicksPerSecond));
            Assert.That(Levels.ConfigFor(5, Modes.RulesFor(GameMode.LimitedWalls)).WallBudget, Is.EqualTo(4 + 2 * 3));
        }

        [Test]
        public void ConfigFor_RepeatsThePlayerSettingsEveryRoundInCustom()
        {
            CustomSettings hard = Modes.Preset(CustomPreset.Hard) with { Speed = 1.3 };
            ModeRules rules = Modes.RulesFor(GameMode.Custom, hard);

            LevelConfig first = Levels.ConfigFor(1, rules);
            LevelConfig later = Levels.ConfigFor(4, rules);

            Assert.That(first.OrbCount, Is.EqualTo(hard.OrbCount));
            Assert.That(first.OrbSpeeds.ToArray(), Is.EqualTo(Enumerable.Repeat(Constants.BaseBallSpeed * 1.3, hard.OrbCount)));
            Assert.That(first.TargetPercent, Is.EqualTo(hard.TargetPercent));
            Assert.That(first.WallBudget, Is.EqualTo(hard.Walls));
            Assert.That(first.TimeLimitTicks, Is.EqualTo(hard.TimeLimitSeconds * Constants.TicksPerSecond));
            Assert.That(first.Change, Is.EqualTo(LevelChange.First));
            Assert.That((later.Level, later.OrbCount, later.Change), Is.EqualTo((4, first.OrbCount, LevelChange.Repeat)));
        }

        [Test]
        public void TierForSpeed_MapsAnySpeedToTheClosestBelowColourTier()
        {
            Assert.That(Levels.TierForSpeed(0.6), Is.EqualTo(0));
            Assert.That(Levels.TierForSpeed(1.19), Is.EqualTo(0));
            Assert.That(Levels.TierForSpeed(1.2), Is.EqualTo(1));
            Assert.That(Levels.TierForSpeed(1.5), Is.EqualTo(2));
            Assert.That(Levels.TierForSpeed(2), Is.EqualTo(3));
        }
    }

    public sealed class ModesTests
    {
        [Test]
        public void RanksTheFiveFixedRuleModesAndKeepsZenAndCustomCasual()
        {
            Assert.That(Modes.Ranked.ToArray(), Is.EqualTo(new[] { GameMode.Classic, GameMode.Daily, GameMode.TimeAttack, GameMode.LimitedWalls, GameMode.Hardcore }));
            Assert.That(Modes.All.Where(mode => !Modes.IsRanked(mode)), Is.EqualTo(new[] { GameMode.Zen, GameMode.Custom }));
        }

        [Test]
        public void RecognisesValidModeIds()
        {
            Assert.That(GameModeIds.TryParse("timeAttack", out GameMode mode), Is.True);
            Assert.That(mode, Is.EqualTo(GameMode.TimeAttack));
            Assert.That(GameModeIds.TryParse("easy", out _), Is.False);
            Assert.That(GameMode.LimitedWalls.Id(), Is.EqualTo("limitedWalls"));
        }

        [Test]
        public void RulesFor_GivesClassicAndDailyPerLevelLivesWithoutTimersOrWallLimits()
        {
            foreach (GameMode mode in new[] { GameMode.Classic, GameMode.Daily })
            {
                Assert.That(Modes.RulesFor(mode), Is.EqualTo(new ModeRules(mode, true, LivesPolicy.PerLevel, 0, false, false, null)));
            }
        }

        [Test]
        public void RulesFor_AddsTheTwistOfEachChallengeMode()
        {
            Assert.That(Modes.RulesFor(GameMode.TimeAttack), Is.EqualTo(new ModeRules(GameMode.TimeAttack, true, LivesPolicy.PerLevel, 0, true, false, null)));
            Assert.That(Modes.RulesFor(GameMode.LimitedWalls), Is.EqualTo(new ModeRules(GameMode.LimitedWalls, true, LivesPolicy.PerLevel, 0, false, true, null)));
            Assert.That(Modes.RulesFor(GameMode.Hardcore), Is.EqualTo(new ModeRules(GameMode.Hardcore, true, LivesPolicy.PerRun, 1, false, false, null)));
            Assert.That(Modes.RulesFor(GameMode.Zen), Is.EqualTo(new ModeRules(GameMode.Zen, false, LivesPolicy.Infinite, 0, false, false, null)));
        }

        [Test]
        public void RulesFor_BuildsCustomRulesFromThePlayerSettings()
        {
            CustomSettings unlimitedLives = Modes.Preset(CustomPreset.Hard) with { Lives = null };

            ModeRules rules = Modes.RulesFor(GameMode.Custom, unlimitedLives);

            Assert.That((rules.Ranked, rules.LivesPolicy, rules.Timed, rules.LimitedWalls), Is.EqualTo((false, LivesPolicy.Infinite, true, true)));
            Assert.That(rules.Custom, Is.EqualTo(unlimitedLives));
            ModeRules normal = Modes.RulesFor(GameMode.Custom, Modes.Preset(CustomPreset.Normal));
            Assert.That((normal.LivesPolicy, normal.Timed), Is.EqualTo((LivesPolicy.PerLevel, false)));
        }

        [Test]
        public void RulesFor_UsesTheNormalPresetWhenCustomHasNoSettings()
        {
            Assert.That(Modes.RulesFor(GameMode.Custom).Custom, Is.EqualTo(Modes.Preset(CustomPreset.Normal)));
        }

        [Test]
        public void Sanitize_KeepsEveryPresetUnchanged()
        {
            foreach (CustomPreset preset in new[] { CustomPreset.Easy, CustomPreset.Normal, CustomPreset.Hard, CustomPreset.Expert })
            {
                Assert.That(Modes.SanitizeCustomSettings(Modes.Preset(preset)), Is.EqualTo(Modes.Preset(preset)));
            }
        }

        [Test]
        public void Sanitize_ClampsAndRoundsValuesIntoTheAllowedRanges()
        {
            var raw = new RawCustomSettings(RawSetting.Of(99.6), RawSetting.Of(0.123), RawSetting.Of(0), RawSetting.Of(1000), RawSetting.Of(5), RawSetting.Of(100));

            Assert.That(Modes.SanitizeCustomSettings(raw), Is.EqualTo(new CustomSettings(12, 0.6, 1, 40, 30, 95)));
        }

        [Test]
        public void Sanitize_RoundsSpeedsToOneDecimalAndKeepsUnlimitedOptions()
        {
            CustomSettings settings = Modes.SanitizeCustomSettings(Modes.Preset(CustomPreset.Normal) with { Speed = 1.26, Lives = null, Walls = null });

            Assert.That((settings.Speed, settings.Lives, settings.Walls), Is.EqualTo((1.3, (int?)null, (int?)null)));
        }

        [Test]
        public void Sanitize_FallsBackToNormalForMissingInput()
        {
            Assert.That(Modes.SanitizeCustomSettings((RawCustomSettings)null), Is.EqualTo(Modes.Preset(CustomPreset.Normal)));
            var missing = new RawCustomSettings(RawSetting.Missing, RawSetting.Missing, RawSetting.Missing, RawSetting.Missing, RawSetting.Missing, RawSetting.Missing);
            Assert.That(Modes.SanitizeCustomSettings(missing), Is.EqualTo(Modes.Preset(CustomPreset.Normal)));
        }
    }
}

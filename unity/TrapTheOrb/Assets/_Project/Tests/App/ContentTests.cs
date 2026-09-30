using System.Linq;
using NUnit.Framework;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.UI.Sheets;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Tests
{
    public sealed class FormatTests
    {
        [Test]
        public void FormatsMillisecondsAsAClock()
        {
            Assert.That(Format.Clock(0), Is.EqualTo("00:00"));
            Assert.That(Format.Clock(138_400), Is.EqualTo("02:18"));
            Assert.That(Format.Clock(59_999), Is.EqualTo("00:59"));
            Assert.That(Format.Clock(-5), Is.EqualTo("00:00"));
            Assert.That(Format.Clock(double.NaN), Is.EqualTo("00:00"));
            Assert.That(Format.Clock(200 * 60_000), Is.EqualTo("99:59"));
        }

        [Test]
        public void GroupsThousands()
        {
            Assert.That(Format.Number(1_234_567), Is.EqualTo("1,234,567"));
            Assert.That(Format.Number(0), Is.EqualTo("0"));
        }

        [Test]
        public void FloorsPercentagesSoANearMissNeverReadsAsTheTarget()
        {
            Assert.That(Format.Percent(74.9), Is.EqualTo("74%"));
            Assert.That(Format.Percent(62), Is.EqualTo("62%"));
            Assert.That(Format.Percent(-3), Is.EqualTo("0%"));
            Assert.That(Format.Percent(120), Is.EqualTo("100%"));
        }

        [Test]
        public void ShortensLargeNumbersLikeIntlCompact()
        {
            Assert.That(Format.Compact(9_876), Is.EqualTo("9,876"));
            Assert.That(Format.Compact(10_000), Is.EqualTo("10K"));
            Assert.That(Format.Compact(12_450), Is.EqualTo("12.5K"));
            Assert.That(Format.Compact(999_999), Is.EqualTo("1M"));
            Assert.That(Format.Compact(1_234_567), Is.EqualTo("1.2M"));
            Assert.That(Format.Compact(3_000_000_000), Is.EqualTo("3B"));
        }

        [Test]
        public void ShowsSpeedWithTwoDecimals()
        {
            Assert.That(Format.Speed(1), Is.EqualTo("1.00×"));
            Assert.That(Format.Speed(1.08), Is.EqualTo("1.08×"));
            Assert.That(Format.Speed(1.7), Is.EqualTo("1.70×"));
        }
    }

    public sealed class ModeContentTests
    {
        [Test]
        public void DescribesEveryModeInOrder()
        {
            Assert.That(ModeContent.Modes.Select(mode => mode.Id), Is.EqualTo(Modes.All.ToArray()));
            Assert.That(ModeContent.Info(GameMode.Hardcore).Name, Is.EqualTo("Hardcore"));
            Assert.That(ModeContent.Modes.Select(mode => ModeContent.IconName(mode.Id)).Distinct().Count(), Is.EqualTo(7));
        }

        [Test]
        public void SummarisesTheFixedRulesOfTheRankedModes()
        {
            Assert.That(ModeContent.RuleChips(GameMode.Classic, null), Is.EqualTo(new[] { "Lives reset each level", "Clear at 75%" }));
            Assert.That(ModeContent.RuleChips(GameMode.TimeAttack, null), Is.EqualTo(new[] { "Lives reset each level", "Timer per level", "Clear at 75%" }));
            Assert.That(ModeContent.RuleChips(GameMode.LimitedWalls, null), Is.EqualTo(new[] { "Lives reset each level", "Wall budget", "Clear at 75%" }));
            Assert.That(ModeContent.RuleChips(GameMode.Hardcore, null), Is.EqualTo(new[] { "1 life per run", "Clear at 75%" }));
            Assert.That(ModeContent.RuleChips(GameMode.Zen, null), Is.EqualTo(new[] { "∞ lives", "Clear at 75%", "Not ranked" }));
        }

        [Test]
        public void SpellsOutACustomSetup()
        {
            Assert.That(ModeContent.RuleChips(GameMode.Custom, Modes.Preset(CustomPreset.Hard)),
                Is.EqualTo(new[] { "5 orbs", "1.3× speed", "3 lives", "120s timer", "16 walls", "Clear at 80%", "Not ranked" }));
            Assert.That(ModeContent.RuleChips(GameMode.Custom, Modes.Preset(CustomPreset.Easy)), Has.Member("∞ lives"));
        }

        [Test]
        public void RecognisesThePresetsAndNothingElse()
        {
            Assert.That(ModeContent.MatchingPreset(Modes.Preset(CustomPreset.Expert)), Is.EqualTo(CustomPreset.Expert));
            Assert.That(ModeContent.MatchingPreset(Modes.Preset(CustomPreset.Expert) with { OrbCount = 7 }), Is.Null);
        }

        [Test]
        public void SaysWhatTheNextLevelBrings()
        {
            Assert.That(Describe(new int[0], new[] { 0 }, LevelChange.First), Does.Contain("warm up"));
            Assert.That(Describe(new[] { 0 }, new[] { 0, 0 }, LevelChange.NewOrb), Is.EqualTo("A new orb joins the field."));
            Assert.That(Describe(new[] { 1, 1 }, new[] { 0, 0, 0 }, LevelChange.Breather), Does.Contain("ease off"));
            Assert.That(Describe(new[] { 0 }, new[] { 0 }, LevelChange.Repeat), Does.Contain("fresh layout"));
        }

        [Test]
        public void CountsTheOrbsThatSpeedUp()
        {
            Assert.That(Describe(new[] { 0, 0 }, new[] { 1, 0 }, LevelChange.SpeedUp), Is.EqualTo("One orb gets faster."));
            Assert.That(Describe(new[] { 1, 1, 1, 1, 1 }, new[] { 2, 2, 1, 1, 1 }, LevelChange.SpeedUp), Is.EqualTo("2 orbs get faster."));
            Assert.That(Describe(new int[0], new[] { 1, 1 }, LevelChange.SpeedUp), Is.EqualTo("The orbs get faster."));
        }

        [Test]
        public void CyclesThroughTheTips()
        {
            Assert.That(Tips.ForLevel(1), Is.EqualTo(Tips.ForLevel(10)));
            Assert.That(Tips.ForLevel(0), Is.EqualTo(Tips.ForLevel(1)));
            Assert.That(Tips.ForLevel(2), Is.Not.EqualTo(Tips.ForLevel(1)));
        }

        [Test]
        public void SaysHowLongAgoAScoreWasSet()
        {
            const double now = 1_700_000_000_000;
            Assert.That(TimeAgo.Format(now - 5_000, now), Is.EqualTo("just now"));
            Assert.That(TimeAgo.Format(now - 5 * 60_000, now), Is.EqualTo("5 minutes ago"));
            Assert.That(TimeAgo.Format(now - 60 * 60_000, now), Is.EqualTo("1 hour ago"));
            Assert.That(TimeAgo.Format(now - 24 * 60 * 60_000, now), Is.EqualTo("yesterday"));
            Assert.That(TimeAgo.Format(now - 3 * 24 * 60 * 60_000, now), Is.EqualTo("3 days ago"));
            Assert.That(TimeAgo.Format(now - 30.0 * 24 * 60 * 60_000, now), Does.Match(@"^[A-Z][a-z]{2} \d{1,2}, \d{4}$"));
        }

        private static string Describe(int[] previous, int[] next, LevelChange change) =>
            ModeContent.DescribeLevelChange(ReadOnlyArray<int>.From(previous), new NextLevelLine(ReadOnlyArray<int>.From(next), change));
    }
}

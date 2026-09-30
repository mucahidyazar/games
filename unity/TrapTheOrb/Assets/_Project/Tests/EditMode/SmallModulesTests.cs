using System;
using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class RngTests
    {
        [Test]
        public void Next_ReturnsValuesInZeroToOneAndANewSeedDeterministically()
        {
            (double a, uint seedA) = Rng.Next(1);
            (double b, uint seedB) = Rng.Next(1);

            Assert.That((a, seedA), Is.EqualTo((b, seedB)));
            Assert.That(a, Is.InRange(0, 0.9999999999));
            Assert.That(seedA, Is.Not.EqualTo(1u));
        }

        [Test]
        public void DailySeed_GivesEveryoneTheSameSeedOnAGivenDayAndANewOneTheNextDay()
        {
            Assert.That(Rng.DailySeed("2026-09-24"), Is.EqualTo(Rng.DailySeed("2026-09-24")));
            Assert.That(Rng.DailySeed("2026-09-25"), Is.Not.EqualTo(Rng.DailySeed("2026-09-24")));
        }

        [Test]
        public void UtcDateKey_FormatsTheUtcDate()
        {
            Assert.That(Rng.UtcDateKey(new DateTime(2026, 9, 27, 23, 30, 0, DateTimeKind.Utc)), Is.EqualTo("2026-09-27"));
        }

        [Test]
        public void RandomSeed_ProducesDifferentSeeds()
        {
            uint[] seeds = Enumerable.Range(0, 8).Select(_ => Rng.RandomSeed()).ToArray();

            Assert.That(seeds.Distinct().Count(), Is.GreaterThan(1));
        }
    }

    public sealed class JsMathTests
    {
        [TestCase(2.5, 3)]
        [TestCase(-2.5, -2)]
        [TestCase(-2.6, -3)]
        [TestCase(0.49999999999999994, 0)]
        [TestCase(1.4999999999999998, 1)]
        [TestCase(4.5, 5)]
        public void Round_RoundsHalvesTowardsPositiveInfinityLikeJavaScript(double value, double expected)
        {
            Assert.That(JsMath.Round(value), Is.EqualTo(expected));
        }

        [Test]
        public void IsFinite_RejectsNaNAndInfinities()
        {
            Assert.That(JsMath.IsFinite(double.NaN), Is.False);
            Assert.That(JsMath.IsFinite(double.PositiveInfinity), Is.False);
            Assert.That(JsMath.IsFinite(1.5), Is.True);
            Assert.That(JsMath.Round(double.NaN), Is.NaN);
        }
    }

    public sealed class FieldTests
    {
        [Test]
        public void Dims_UsesATwoToOneFieldInLandscapeAndTheSameFieldTurnedOnItsSideInPortrait()
        {
            Assert.That(Field.Dims(FieldOrientation.Landscape), Is.EqualTo(new GridDims(300, 150)));
            Assert.That(Field.Dims(FieldOrientation.Portrait), Is.EqualTo(new GridDims(150, 300)));
        }

        [Test]
        public void OrientationForAspect_PicksTheOrientationThatFitsTheScreen()
        {
            Assert.That(Field.OrientationForAspect(2), Is.EqualTo(FieldOrientation.Landscape));
            Assert.That(Field.OrientationForAspect(1), Is.EqualTo(FieldOrientation.Landscape));
            Assert.That(Field.OrientationForAspect(0.6), Is.EqualTo(FieldOrientation.Portrait));
            Assert.That(Field.OrientationForAspect(double.NaN), Is.EqualTo(FieldOrientation.Landscape));
            Assert.That(Field.OrientationForAspect(-1), Is.EqualTo(FieldOrientation.Landscape));
        }
    }

    public sealed class StatsTests
    {
        private static LevelClear Clear(double percent = 80, long elapsedMs = 30_000, int livesLost = 0, int wallsUsed = 5, int orbCount = 3) =>
            new LevelClear(percent, elapsedMs, 40, livesLost, wallsUsed, orbCount);

        [Test]
        public void StartsEmptyOnLevelOne()
        {
            Assert.That((Stats.Empty.LevelsCleared, Stats.Empty.HighestLevel, Stats.Empty.TightestTrapPct), Is.EqualTo((0, 1, (double?)null)));
        }

        [Test]
        public void TracksTheHighestLevelReached()
        {
            Assert.That(Stats.AfterLevelStart(Stats.AfterLevelStart(Stats.Empty, 4), 2).HighestLevel, Is.EqualTo(4));
        }

        [Test]
        public void CountsWallsBuiltAndBroken()
        {
            RunStats stats = Stats.AfterWallsBroken(Stats.AfterWallStarted(Stats.AfterWallStarted(Stats.Empty)), 2);

            Assert.That((stats.WallsBuilt, stats.WallsBroken), Is.EqualTo((2, 2)));
        }

        [Test]
        public void KeepsTheBiggestCaptureTheTightestTrapAndTheMostRegionsInOneWall()
        {
            RunStats stats = Stats.AfterCapture(Stats.Empty, new CaptureMoment(22, 1, 40));
            stats = Stats.AfterCapture(stats, new CaptureMoment(9, 3, 2.5));
            stats = Stats.AfterCapture(stats, new CaptureMoment(12, 0, null));

            Assert.That((stats.BiggestCapturePct, stats.TightestTrapPct, stats.MaxRegionsInOneWall), Is.EqualTo((22.0, (double?)2.5, 3)));
        }

        [Test]
        public void RecordsLevelClears()
        {
            RunStats stats = Stats.AfterLevelClear(Stats.Empty, Clear(percent: 91.5, elapsedMs: 20_000));
            stats = Stats.AfterLevelClear(stats, Clear(percent: 78, wallsUsed: 4));
            stats = Stats.AfterLevelClear(stats, Clear(livesLost: 1, wallsUsed: 2, orbCount: 2));
            stats = Stats.AfterLevelClear(stats, Clear());

            Assert.That(stats.LevelsCleared, Is.EqualTo(4));
            Assert.That(stats.BestClearPct, Is.EqualTo(91.5));
            Assert.That(stats.FastestClearRatio, Is.EqualTo(0.5));
            Assert.That(stats.FewestWallsClear, Is.EqualTo(4));
            Assert.That((stats.PerfectStreak, stats.BestPerfectStreak), Is.EqualTo((1, 2)));
        }

        [Test]
        public void NeverMutatesThePreviousStats()
        {
            RunStats before = Stats.Empty;

            Stats.AfterLevelClear(before, Clear());

            Assert.That(before.LevelsCleared, Is.Zero);
        }
    }

    public sealed class BadgesTests
    {
        private static RunStats With(Func<RunStats, RunStats> change) => change(Stats.Empty);

        [Test]
        public void HasThreeStrictlyOrderedThresholdsPerBadgeAndUniqueIds()
        {
            foreach (BadgeDefinition badge in Badges.All)
            {
                double[] t = badge.Thresholds.ToArray();
                if (badge.Direction == BadgeDirection.AtLeast) Assert.That(t[0] < t[1] && t[1] < t[2], Is.True, badge.Id.ToString());
                else Assert.That(t[0] > t[1] && t[1] > t[2], Is.True, badge.Id.ToString());
            }
            Assert.That(Badges.All.Select(badge => badge.Id).Distinct().Count(), Is.EqualTo(Badges.All.Count));
        }

        [Test]
        public void TierFor_HandlesBothDirectionsAtTheExactThresholds()
        {
            BadgeDefinition climber = Badges.ById(BadgeId.Climber);
            BadgeDefinition squeeze = Badges.ById(BadgeId.Squeeze);

            Assert.That(new[] { 4, 5, 10, 99 }.Select(v => Badges.TierFor(climber, v)), Is.EqualTo(new[] { 0, 1, 2, 3 }));
            Assert.That(Badges.TierFor(squeeze, 3.1), Is.EqualTo(0));
            Assert.That(Badges.TierFor(squeeze, 3), Is.EqualTo(1));
            Assert.That(Badges.TierFor(squeeze, 0.5), Is.EqualTo(3));
            Assert.That(Badges.TierFor(squeeze, null), Is.EqualTo(0));
        }

        [Test]
        public void EvaluateRun_AwardsEveryBadgeARankedRunQualifiesFor()
        {
            RunStats run = With(s => s with { HighestLevel = 11, TightestTrapPct = 1.2, BiggestCapturePct = 26, BestPerfectStreak = 5 });

            Assert.That(Badges.EvaluateRun(run, GameMode.Classic), Is.EqualTo(new[]
            {
                new EarnedBadge(BadgeId.Climber, 2), new EarnedBadge(BadgeId.Squeeze, 2), new EarnedBadge(BadgeId.LandGrab, 1),
                new EarnedBadge(BadgeId.Flawless, 3),
            }));
        }

        [Test]
        public void EvaluateRun_KeepsModeBadgesForTheirOwnMode()
        {
            RunStats run = With(s => s with { HighestLevel = 7 });

            Assert.That(Badges.EvaluateRun(run, GameMode.Hardcore), Has.Member(new EarnedBadge(BadgeId.Survivor, 2)));
            Assert.That(Badges.EvaluateRun(run, GameMode.Classic).Select(b => b.Id), Has.No.Member(BadgeId.Survivor));
            Assert.That(Badges.EvaluateRun(run, GameMode.TimeAttack), Has.Member(new EarnedBadge(BadgeId.BeatTheClock, 1)));
            Assert.That(Badges.EvaluateRun(run, GameMode.LimitedWalls), Has.Member(new EarnedBadge(BadgeId.Frugal, 1)));
        }

        [Test]
        public void EvaluateRun_AwardsNothingInTheUnrankedModesAndLeavesAccountBadgesToTheServer()
        {
            RunStats run = With(s => s with { HighestLevel = 30, TightestTrapPct = 0.1 });

            Assert.That(Badges.EvaluateRun(run, GameMode.Zen), Is.Empty);
            Assert.That(Badges.EvaluateRun(run, GameMode.Custom), Is.Empty);
            Assert.That(Badges.EvaluateRun(run, GameMode.Daily).Select(b => b.Id), Has.No.Member(BadgeId.Devotee));
            Assert.Throws<ArgumentOutOfRangeException>(() => Badges.ById((BadgeId)99));
        }
    }

    public sealed class ScoringTests
    {
        [Test]
        public void CapturePoints_PaysTenPerPercentTimesTheLevel()
        {
            Assert.That(Scoring.CapturePoints(12.34, 3), Is.EqualTo(123 * 3));
            Assert.That(Scoring.CapturePoints(0.05, 1), Is.EqualTo(1));
        }

        [Test]
        public void TicksToMs_RoundsToWholeMilliseconds()
        {
            Assert.That(Scoring.TicksToMs(1), Is.EqualTo(8));
            Assert.That(Scoring.TicksToMs(120), Is.EqualTo(1000));
        }

        [Test]
        public void ComputeLevelResult_PaysAreaLivesTimeAndWallBonuses()
        {
            ModeRules rules = Modes.RulesFor(GameMode.LimitedWalls);
            LevelConfig config = Levels.ConfigFor(2, rules);

            LevelResult result = Scoring.ComputeLevelResult(new LevelOutcome(config, rules, 81.7, 20 * Constants.TicksPerSecond, 2, 3));

            Assert.That(result.AreaBonus, Is.EqualTo(6 * 50 * 2));
            Assert.That(result.LivesBonus, Is.EqualTo(2 * 100 * 2));
            Assert.That(result.TimeBonus, Is.EqualTo((40 - 20) * 5 * 2));
            Assert.That(result.WallBonus, Is.EqualTo(3 * 50 * 2));
            Assert.That(result.TotalBonus, Is.EqualTo(result.AreaBonus + result.LivesBonus + result.TimeBonus + result.WallBonus));
        }

        [Test]
        public void ComputeLevelResult_PaysNothingForLivesInZenOrForAnExpiredClock()
        {
            ModeRules zen = Modes.RulesFor(GameMode.Zen);
            LevelResult zenResult = Scoring.ComputeLevelResult(new LevelOutcome(Levels.ConfigFor(1, zen), zen, 75, 10_000, 2, null));
            ModeRules timed = Modes.RulesFor(GameMode.TimeAttack);
            LevelConfig config = Levels.ConfigFor(1, timed);
            LevelResult late = Scoring.ComputeLevelResult(new LevelOutcome(config, timed, 76, config.TimeLimitTicks.Value + 60, 1, null));

            Assert.That((zenResult.LivesBonus, zenResult.TimeBonus), Is.EqualTo((0L, 0L)));
            Assert.That(late.TimeBonus, Is.Zero);
        }
    }
}

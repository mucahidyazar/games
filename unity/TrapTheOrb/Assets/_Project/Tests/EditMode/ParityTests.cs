using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    /// <summary>
    /// The C# engine must reproduce the TypeScript engine bit for bit: the same seeds, levels, sanitised settings
    /// and — most importantly — the same runs, tick by tick. Regenerate the fixtures after changing the web engine.
    /// </summary>
    public sealed class ParityTests
    {
        [Test]
        public void RandomSequencesMatchTheWebEngine()
        {
            JToken fixture = Fixtures.Load("random.json");

            foreach (JToken sequence in fixture["sequences"])
            {
                uint seed = (uint)sequence["seed"];
                foreach (JToken draw in sequence["draws"])
                {
                    (double value, uint next) = Rng.Next(seed);
                    Assert.That(Fixtures.Hex(value), Is.EqualTo((string)draw["value"]), $"value after seed {seed}");
                    Assert.That(next, Is.EqualTo((uint)draw["next"]), $"next seed after {seed}");
                    seed = next;
                }
            }
        }

        [Test]
        public void DailySeedsMatchTheWebEngine()
        {
            foreach (JToken day in Fixtures.Load("random.json")["daily"])
            {
                Assert.That(Rng.DailySeed((string)day["date"]), Is.EqualTo((uint)day["seed"]), (string)day["date"]);
            }
        }

        [Test]
        public void LevelConfigsMatchTheWebEngine()
        {
            foreach (JToken setup in Fixtures.Load("levels.json"))
            {
                ModeRules rules = Modes.RulesFor(Fixtures.Mode(setup["mode"]), Fixtures.Custom(setup["custom"]));
                string name = (string)setup["name"];
                Assert.That(rules.Ranked, Is.EqualTo((bool)setup["rules"]["ranked"]), name);
                Assert.That(rules.RunLives, Is.EqualTo((int)setup["rules"]["runLives"]), name);
                Assert.That(rules.Timed, Is.EqualTo((bool)setup["rules"]["timed"]), name);
                Assert.That(rules.LimitedWalls, Is.EqualTo((bool)setup["rules"]["limitedWalls"]), name);

                foreach (JToken expected in setup["levels"]) AssertLevel(name, Levels.ConfigFor((int)expected["input"], rules), expected);
            }
        }

        private static void AssertLevel(string setup, LevelConfig config, JToken expected)
        {
            string where = $"{setup} level {expected["input"]}";
            Assert.That(config.Level, Is.EqualTo((int)expected["level"]), where);
            Assert.That(config.OrbCount, Is.EqualTo((int)expected["orbCount"]), where);
            Assert.That(config.OrbTiers.ToArray(), Is.EqualTo(expected["orbTiers"].Select(t => (int)t).ToArray()), where);
            Assert.That(config.OrbSpeeds.ToArray().Select(Fixtures.Hex), Is.EqualTo(expected["orbSpeeds"].Select(t => (string)t)), where);
            Assert.That(config.Lives, Is.EqualTo((int)expected["lives"]), where);
            Assert.That(config.WallBudget, Is.EqualTo(Fixtures.OptionalInt(expected["wallBudget"])), where);
            Assert.That(config.TimeLimitTicks, Is.EqualTo(Fixtures.OptionalInt(expected["timeLimitTicks"])), where);
            Assert.That(Fixtures.Hex(config.WallSpeed), Is.EqualTo((string)expected["wallSpeed"]), where);
            Assert.That(config.TargetPercent, Is.EqualTo((int)expected["targetPercent"]), where);
            Assert.That(config.ParSeconds, Is.EqualTo((int)expected["parSeconds"]), where);
            Assert.That(ChangeId(config.Change), Is.EqualTo((string)expected["change"]), where);
        }

        private static string ChangeId(LevelChange change) => change switch
        {
            LevelChange.First => "first",
            LevelChange.NewOrb => "newOrb",
            LevelChange.SpeedUp => "speedUp",
            LevelChange.Breather => "breather",
            _ => "repeat",
        };

        [Test]
        public void CustomSettingsAreSanitisedLikeTheWebEngine()
        {
            foreach (JToken sample in Fixtures.Load("custom-settings.json"))
            {
                var input = sample["input"] as JObject;
                RawCustomSettings raw = input == null ? null : new RawCustomSettings(
                    Fixtures.Raw(input, "orbCount"),
                    Fixtures.Raw(input, "speed"),
                    Fixtures.Raw(input, "lives"),
                    Fixtures.Raw(input, "walls"),
                    Fixtures.Raw(input, "timeLimitSeconds"),
                    Fixtures.Raw(input, "targetPercent"));

                Assert.That(Modes.SanitizeCustomSettings(raw), Is.EqualTo(Fixtures.Custom(sample["output"])), sample["input"].ToString());
            }
        }

        [Test]
        public void BadgeThresholdsMatchTheWebEngine()
        {
            JToken[] expected = Fixtures.Load("badges.json").ToArray();

            Assert.That(Badges.All.Count, Is.EqualTo(expected.Length));
            for (int index = 0; index < expected.Length; index++)
            {
                BadgeDefinition badge = Badges.All[index];
                Assert.That(badge.Id.Id(), Is.EqualTo((string)expected[index]["id"]));
                Assert.That(badge.Direction == BadgeDirection.AtLeast ? "atLeast" : "atMost", Is.EqualTo((string)expected[index]["direction"]));
                Assert.That(badge.Thresholds.ToArray().Select(Fixtures.Hex), Is.EqualTo(expected[index]["thresholds"].Select(t => (string)t)));
                Assert.That(badge.Source == BadgeSource.Run ? "run" : "account", Is.EqualTo((string)expected[index]["source"]));
            }
        }

        private static IEnumerable<TestCaseData> ReplaySessions() =>
            Fixtures.Load("replays.json").Select(session => new TestCaseData(session).SetName($"ReplayMatchesTheWebEngine({session["name"]})"));

        [TestCaseSource(nameof(ReplaySessions))]
        public void ReplayMatchesTheWebEngine(JToken session)
        {
            RecordedSession recorded = RecordedSession.From(session);

            ReplayResult result = Replay.Run(recorded.Request);

            ReplayRecorder.AssertMatches(recorded, session);
            JToken expected = session["result"];
            Assert.That(result.Status.ToString(), Is.EqualTo(Pascal((string)expected["status"])), "status");
            Assert.That(result.GameOverReason?.ToString(), Is.EqualTo(PascalOrNull(expected["gameOverReason"])), "gameOverReason");
            Assert.That(result.Score, Is.EqualTo((long)expected["score"]), "score");
            Assert.That(result.Level, Is.EqualTo((int)expected["level"]), "level");
            Assert.That(result.LevelsCleared, Is.EqualTo((int)expected["levelsCleared"]), "levelsCleared");
            Assert.That(result.Tick, Is.EqualTo((int)expected["tick"]), "tick");
            Assert.That(result.AcceptedInputs, Is.EqualTo((int)expected["acceptedInputs"]), "acceptedInputs");
            SnapshotAssert.Stats(result.Stats, expected["stats"], "final stats");
            Assert.That(
                Badges.EvaluateRun(result.Stats, recorded.Request.Mode).Select(b => $"{b.Id.Id()}:{b.Tier}"),
                Is.EqualTo(expected["badges"].Select(b => $"{b["id"]}:{b["tier"]}")),
                "badges");
        }

        internal static string Pascal(string id) => char.ToUpperInvariant(id[0]) + id.Substring(1);

        private static string PascalOrNull(JToken token) => token.Type == JTokenType.Null ? null : Pascal((string)token);
    }
}

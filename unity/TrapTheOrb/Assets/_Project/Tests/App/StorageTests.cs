using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Storage;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.TestTools;

namespace TrapTheOrb.App.Tests
{
    /// <summary>A store whose writes fail, like a full or blocked browser storage.</summary>
    public sealed class FailingStore : IKeyValueStore
    {
        public string GetItem(string key) => null;

        public void SetItem(string key, string value) => throw new InvalidOperationException("quota exceeded");

        public void RemoveItem(string key)
        {
        }
    }

    public sealed class SettingsStorageTests
    {
        [Test]
        public void SanitizesNicknames()
        {
            Assert.That(SettingsStorage.SanitizeNickname("   Grid   Master  "), Is.EqualTo("Grid Master"));
            Assert.That(SettingsStorage.SanitizeNickname(new string('A', 40)).Length, Is.EqualTo(16));
            Assert.That(SettingsStorage.SanitizeNickname("Ne\u0000o<script>"), Is.EqualTo("Neoscript"));
            Assert.That(SettingsStorage.SanitizeNickname(null), Is.Empty);
        }

        [Test]
        public void ReturnsDefaultsWhenNothingIsStored()
        {
            Assert.That(SettingsStorage.Load(new MemoryStore()), Is.EqualTo(Settings.Default));
            Assert.That(SettingsStorage.Load(null), Is.EqualTo(Settings.Default));
        }

        [Test]
        public void RoundTripsValidSettings()
        {
            var store = new MemoryStore();
            var settings = new Settings("Luna", false, GameMode.TimeAttack, Modes.Preset(CustomPreset.Hard));

            Assert.That(SettingsStorage.Save(store, settings), Is.True);
            Assert.That(SettingsStorage.Load(store), Is.EqualTo(settings));
        }

        [Test]
        public void ReadsTheWebGamesFormat()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.Settings,
                "{\"nickname\":\"Luna\",\"soundEnabled\":false,\"lastMode\":\"limitedWalls\"," +
                "\"custom\":{\"orbCount\":5,\"speed\":1.3,\"lives\":3,\"walls\":16,\"timeLimitSeconds\":120,\"targetPercent\":80}}");

            Assert.That(SettingsStorage.Load(store), Is.EqualTo(new Settings("Luna", false, GameMode.LimitedWalls, Modes.Preset(CustomPreset.Hard))));
        }

        [Test]
        public void RepairsPartiallyInvalidDataFieldByField()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.Settings, "{\"nickname\":12,\"soundEnabled\":false,\"lastMode\":\"turbo\",\"custom\":{\"orbCount\":50}}");

            Settings loaded = SettingsStorage.Load(store);

            Assert.That(loaded, Is.EqualTo(new Settings(string.Empty, false, GameMode.Classic,
                Modes.Preset(CustomPreset.Normal) with { OrbCount = 12 })));
        }

        [Test]
        public void KeepsExplicitlyUnlimitedCustomLimits()
        {
            JObject custom = SettingsStorage.CustomToJson(Modes.Preset(CustomPreset.Easy));

            Assert.That(custom["lives"].Type, Is.EqualTo(JTokenType.Null));
            Assert.That(SettingsStorage.ParseCustom(custom), Is.EqualTo(Modes.Preset(CustomPreset.Easy)));
        }

        [Test]
        public void IgnoresUnreadableJson()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.Settings, "{not json");

            LogAssert.Expect(LogType.Warning, new System.Text.RegularExpressions.Regex("unreadable"));
            Assert.That(SettingsStorage.Load(store), Is.EqualTo(Settings.Default));
        }
    }

    public sealed class HighScoreTests
    {
        private static HighScore Entry(long score, GameMode mode = GameMode.Classic, double createdAt = 1_700_000_000_000) =>
            new HighScore($"id-{score}-{mode.Id()}", "Ada", mode, score, 3, createdAt);

        private static List<HighScore> FullTable() =>
            Enumerable.Range(0, HighScores.MaxPerMode).Select(i => Entry(1000 - i * 10)).ToList();

        [Test]
        public void InsertsInDescendingOrderAndReportsTheRank()
        {
            AddHighScoreResult result = HighScores.Add(new[] { Entry(900), Entry(300) }, Entry(500));

            Assert.That(result.Scores.Select(score => score.Score), Is.EqualTo(new long[] { 900, 500, 300 }));
            Assert.That(result.Rank, Is.EqualTo(2));
        }

        [Test]
        public void KeepsOnlyTheBestEntries()
        {
            List<HighScore> full = FullTable();

            AddHighScoreResult low = HighScores.Add(full, Entry(1));
            AddHighScoreResult high = HighScores.Add(full, Entry(5000));

            Assert.That(low.Rank, Is.Null);
            Assert.That(low.Scores, Is.SameAs(full));
            Assert.That(high.Rank, Is.EqualTo(1));
            Assert.That(high.Scores.Count, Is.EqualTo(HighScores.MaxPerMode));
            Assert.That(high.Scores[high.Scores.Count - 1].Score, Is.EqualTo(920));
        }

        [Test]
        public void KeepsASeparateTablePerMode()
        {
            AddHighScoreResult result = HighScores.Add(FullTable(), Entry(5, GameMode.Hardcore));

            Assert.That(result.Rank, Is.EqualTo(1));
            Assert.That(HighScores.For(result.Scores, GameMode.Classic).Count, Is.EqualTo(HighScores.MaxPerMode));
            Assert.That(HighScores.For(result.Scores, GameMode.Hardcore).Select(score => score.Score), Is.EqualTo(new long[] { 5 }));
        }

        [Test]
        public void KnowsWhetherAScoreQualifies()
        {
            List<HighScore> full = FullTable();

            Assert.That(HighScores.Qualifies(new HighScore[0], GameMode.Classic, 0), Is.False);
            Assert.That(HighScores.Qualifies(new HighScore[0], GameMode.Classic, 10), Is.True);
            Assert.That(HighScores.Qualifies(full, GameMode.Classic, 905), Is.False);
            Assert.That(HighScores.Qualifies(full, GameMode.Classic, 915), Is.True);
            Assert.That(HighScores.Qualifies(full, GameMode.Daily, 1), Is.True);
        }

        [Test]
        public void TiesGoToTheOlderScore()
        {
            AddHighScoreResult result = HighScores.Add(new[] { Entry(500, createdAt: 1) }, new HighScore("new", "Bo", GameMode.Classic, 500, 2, 2));

            Assert.That(result.Rank, Is.EqualTo(2));
        }

        [Test]
        public void RoundTripsThroughStorageAndDropsCorruptedRows()
        {
            var store = new MemoryStore();
            HighScores.Save(store, new[] { Entry(700), Entry(900) });
            var saved = JArray.Parse(store.GetItem(StorageKeys.HighScores));
            saved.Add(new JObject { ["name"] = 42 });
            saved.Add("nope");
            JObject turbo = (JObject)saved[0].DeepClone();
            turbo["mode"] = "turbo";
            saved.Add(turbo);
            JObject negative = (JObject)saved[0].DeepClone();
            negative["score"] = -5;
            saved.Add(negative);
            store.SetItem(StorageKeys.HighScores, saved.ToString());

            Assert.That(HighScores.Load(store).Select(score => score.Score), Is.EqualTo(new long[] { 900, 700 }));
        }

        [Test]
        public void TreatsScoresSavedBeforeModesExistedAsClassic()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.HighScores, "[{\"id\":\"a\",\"name\":\"Ada\",\"score\":640,\"level\":3,\"createdAt\":5}]");

            Assert.That(HighScores.Load(store), Is.EqualTo(new[] { new HighScore("a", "Ada", GameMode.Classic, 640, 3, 5) }));
        }

        [Test]
        public void KeepsAtMostTheTableSizePerModeWhenLoading()
        {
            var store = new MemoryStore();
            HighScores.Save(store, FullTable().Concat(new[] { Entry(1), Entry(2, GameMode.Zen) }).ToList());

            IReadOnlyList<HighScore> loaded = HighScores.Load(store);

            Assert.That(HighScores.For(loaded, GameMode.Classic).Count, Is.EqualTo(HighScores.MaxPerMode));
            Assert.That(HighScores.For(loaded, GameMode.Zen).Count, Is.EqualTo(1));
        }

        [Test]
        public void ReportsFailedWritesInsteadOfThrowing()
        {
            LogAssert.Expect(LogType.Warning, new System.Text.RegularExpressions.Regex("Could not save"));
            Assert.That(HighScores.Save(new FailingStore(), new[] { Entry(10) }), Is.False);
            Assert.That(HighScores.Save(null, new[] { Entry(10) }), Is.False);
        }
    }

    public sealed class SavedRunTests
    {
        [Test]
        public void RoundTripsTheModeLevelAndScore()
        {
            var store = new MemoryStore();
            var run = new SavedRun(GameMode.Zen, null, 5, 12_340, 7);

            Assert.That(SavedRuns.Save(store, run), Is.True);
            Assert.That(SavedRuns.Load(store), Is.EqualTo(run));
        }

        [Test]
        public void KeepsAndRepairsTheSetupOfACustomRun()
        {
            var store = new MemoryStore();
            JObject custom = SettingsStorage.CustomToJson(Modes.Preset(CustomPreset.Hard));
            custom["speed"] = 7;
            store.SetItem(StorageKeys.SavedRun, new JObject { ["mode"] = "custom", ["custom"] = custom, ["level"] = 3, ["score"] = 10, ["savedAt"] = 1 }.ToString());

            Assert.That(SavedRuns.Load(store).Custom, Is.EqualTo(Modes.Preset(CustomPreset.Hard) with { Speed = 2 }));
        }

        [Test]
        public void DropsTheCustomSetupOfOtherModes()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.SavedRun, new JObject
            {
                ["mode"] = "classic", ["custom"] = SettingsStorage.CustomToJson(Modes.Preset(CustomPreset.Hard)),
                ["level"] = 3, ["score"] = 10, ["savedAt"] = 1,
            }.ToString());

            Assert.That(SavedRuns.Load(store).Custom, Is.Null);
        }

        [TestCase("{\"mode\":\"classic\",\"level\":1,\"score\":10,\"savedAt\":1}")]
        [TestCase("{\"mode\":\"classic\",\"level\":3,\"score\":-5,\"savedAt\":1}")]
        [TestCase("{\"mode\":\"turbo\",\"level\":3,\"score\":5,\"savedAt\":1}")]
        [TestCase("{\"level\":3,\"score\":5,\"savedAt\":1}")]
        [TestCase("{\"mode\":\"classic\",\"level\":501,\"score\":5,\"savedAt\":1}")]
        [TestCase("{\"level\":\"x\"}")]
        [TestCase("42")]
        public void ReturnsNullForInvalidData(string json)
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.SavedRun, json);

            Assert.That(SavedRuns.Load(store), Is.Null);
        }

        [Test]
        public void CanBeCleared()
        {
            var store = new MemoryStore();
            SavedRuns.Save(store, new SavedRun(GameMode.Classic, null, 2, 900, 1));

            SavedRuns.Clear(store);

            Assert.That(SavedRuns.Load(store), Is.Null);
            Assert.That(SavedRuns.Load(null), Is.Null);
        }
    }

    public sealed class PlayerStoreTests
    {
        private static PlayerStore Create(MemoryStore storage = null, double now = 1000) =>
            new PlayerStore(storage ?? new MemoryStore(), () => now, () => "id-" + Guid.NewGuid());

        [Test]
        public void PersistsSettingsAndNotifies()
        {
            var storage = new MemoryStore();
            PlayerStore store = Create(storage);
            int changes = 0;
            store.Changed += () => changes++;

            store.SetSoundEnabled(false);
            store.SetLastMode(GameMode.Zen);
            store.SetLastMode(GameMode.Zen);

            Assert.That(changes, Is.EqualTo(2));
            Assert.That(SettingsStorage.Load(storage).SoundEnabled, Is.False);
            Assert.That(Create(storage).Snapshot.Settings.LastMode, Is.EqualTo(GameMode.Zen));
        }

        [Test]
        public void SanitizesCustomSettings()
        {
            PlayerStore store = Create();

            store.SetCustomSettings(Modes.Preset(CustomPreset.Normal) with { OrbCount = 99 });

            Assert.That(store.Snapshot.Settings.Custom.OrbCount, Is.EqualTo(12));
        }

        [Test]
        public void SubmitsHighScoresAndRemembersTheName()
        {
            var storage = new MemoryStore();
            PlayerStore store = Create(storage);

            int? first = store.SubmitHighScore("  Ada  ", GameMode.Classic, 500, 3);
            int? second = store.SubmitHighScore("", GameMode.Classic, 900, 4);

            Assert.That(first, Is.EqualTo(1));
            Assert.That(second, Is.EqualTo(1));
            Assert.That(store.Snapshot.HighScores.Select(score => score.Name), Is.EqualTo(new[] { "Player", "Ada" }));
            Assert.That(store.Snapshot.Settings.Nickname, Is.EqualTo("Player"));
            Assert.That(HighScores.Load(storage).Count, Is.EqualTo(2));
        }

        [Test]
        public void SavesPracticeRunsFromLevelTwoOn()
        {
            PlayerStore store = Create();

            store.SaveRun(GameMode.Zen, null, 1, 0);
            Assert.That(store.Snapshot.SavedRun, Is.Null);

            store.SaveRun(GameMode.Custom, Modes.Preset(CustomPreset.Hard), 3, 1200);
            Assert.That(store.Snapshot.SavedRun, Is.EqualTo(new SavedRun(GameMode.Custom, Modes.Preset(CustomPreset.Hard), 3, 1200, 1000)));

            store.SaveRun(GameMode.Zen, null, 1, 0);
            Assert.That(store.Snapshot.SavedRun, Is.Not.Null, "a fresh start only replaces the save of its own mode");

            store.SaveRun(GameMode.Custom, Modes.Preset(CustomPreset.Hard), 1, 0);
            Assert.That(store.Snapshot.SavedRun, Is.Null);
        }

        [Test]
        public void ClearsScores()
        {
            PlayerStore store = Create();
            store.SubmitHighScore("Ada", GameMode.Classic, 500, 3);

            store.ClearScores();

            Assert.That(store.Snapshot.HighScores, Is.Empty);
        }

        [Test]
        public void StoresTheThemeLikeTheWeb()
        {
            var storage = new MemoryStore();
            var themes = new ThemeStore(storage);

            Assert.That(themes.Load(), Is.EqualTo(Theme.Navy));
            themes.Save(Theme.Light);

            Assert.That(storage.GetItem(StorageKeys.Theme), Is.EqualTo("light"));
            Assert.That(new ThemeStore(storage).Load(), Is.EqualTo(Theme.Light));
            Assert.That(ThemeStore.Parse("sepia"), Is.EqualTo(Theme.Navy));
        }
    }
}

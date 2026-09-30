using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Storage
{
    public sealed record HighScore(string Id, string Name, GameMode Mode, long Score, int Level, double CreatedAt);

    /// <summary>The result of adding a score: the new table and the entry's 1-based rank in its mode, if it made it.</summary>
    public sealed record AddHighScoreResult(IReadOnlyList<HighScore> Scores, int? Rank);

    /// <summary>Scores kept per mode on this device (storage/scores.ts).</summary>
    public static class HighScores
    {
        public const int MaxPerMode = 10;
        private const int MaxTextLength = 64;

        /// <summary>High scores of every mode, best first, at most <see cref="MaxPerMode"/> per mode.</summary>
        public static IReadOnlyList<HighScore> Load(IKeyValueStore store)
        {
            if (!(JsonStore.Read(store, StorageKeys.HighScores) is JArray raw)) return new HighScore[0];

            var counts = new Dictionary<GameMode, int>();
            var kept = new List<HighScore>();
            foreach (HighScore score in Sorted(raw.Select(Parse).Where(score => score != null)))
            {
                counts.TryGetValue(score.Mode, out int count);
                counts[score.Mode] = count + 1;
                if (count < MaxPerMode) kept.Add(score);
            }
            return kept;
        }

        public static bool Save(IKeyValueStore store, IReadOnlyList<HighScore> scores) =>
            JsonStore.Write(store, StorageKeys.HighScores, new JArray(scores.Select(score => new JObject
            {
                ["id"] = score.Id,
                ["name"] = score.Name,
                ["mode"] = score.Mode.Id(),
                ["score"] = score.Score,
                ["level"] = score.Level,
                ["createdAt"] = score.CreatedAt,
            })));

        public static IReadOnlyList<HighScore> For(IReadOnlyList<HighScore> scores, GameMode mode) =>
            scores.Where(score => score.Mode == mode).ToList();

        public static bool Qualifies(IReadOnlyList<HighScore> scores, GameMode mode, long score)
        {
            if (score <= 0) return false;
            IReadOnlyList<HighScore> table = For(scores, mode);
            if (table.Count < MaxPerMode) return true;
            return score > table[table.Count - 1].Score;
        }

        public static AddHighScoreResult Add(IReadOnlyList<HighScore> scores, HighScore entry)
        {
            if (!Qualifies(scores, entry.Mode, entry.Score)) return new AddHighScoreResult(scores, null);

            List<HighScore> table = Sorted(For(scores, entry.Mode).Append(entry)).Take(MaxPerMode).ToList();
            IEnumerable<HighScore> others = scores.Where(score => score.Mode != entry.Mode);
            int index = table.FindIndex(score => score.Id == entry.Id);
            return new AddHighScoreResult(Sorted(others.Concat(table)).ToList(), index >= 0 ? index + 1 : (int?)null);
        }

        /// <summary>Best first; ties go to the older score. Stable, like Array.prototype.sort.</summary>
        private static IEnumerable<HighScore> Sorted(IEnumerable<HighScore> scores) =>
            scores.OrderByDescending(score => score.Score).ThenBy(score => score.CreatedAt);

        private static HighScore Parse(JToken token)
        {
            if (!(token is JObject item)) return null;
            string id = JsonStore.String(item["id"]);
            string name = JsonStore.String(item["name"]);
            JToken modeToken = item["mode"];
            long? score = JsonStore.SafeInteger(item["score"]);
            long? level = JsonStore.SafeInteger(item["level"]);
            double? createdAt = JsonStore.Number(item["createdAt"]);

            if (id == null || id.Length > MaxTextLength || name == null || name.Length > MaxTextLength) return null;
            if (score is not long points || points < 0 || level is not long reached || reached < 1 || createdAt is not double created) return null;

            // Scores saved before modes existed were Classic games.
            GameMode mode = GameMode.Classic;
            if (modeToken != null && modeToken.Type != JTokenType.Undefined)
            {
                if (!GameModeIds.TryParse(JsonStore.String(modeToken), out mode)) return null;
            }
            return new HighScore(id, name, mode, points, (int)System.Math.Min(int.MaxValue, reached), created);
        }
    }
}

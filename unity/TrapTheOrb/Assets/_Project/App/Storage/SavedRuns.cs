using Newtonsoft.Json.Linq;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Storage
{
    /// <summary>Where to pick an unranked game back up: the start of a level, with the score earned so far.</summary>
    public sealed record SavedRun(GameMode Mode, CustomSettings Custom, int Level, long Score, double SavedAt);

    /// <summary>storage/savedRun.ts.</summary>
    public static class SavedRuns
    {
        /// <summary>Highest level a saved run may point at — guards against tampered storage.</summary>
        private const int MaxSavedLevel = 500;
        private const int MinSavedLevel = 2;

        public static SavedRun Load(IKeyValueStore store)
        {
            if (!(JsonStore.Read(store, StorageKeys.SavedRun) is JObject item)) return null;
            long? level = JsonStore.SafeInteger(item["level"]);
            long? score = JsonStore.SafeInteger(item["score"]);
            double? savedAt = JsonStore.Number(item["savedAt"]);
            if (!GameModeIds.TryParse(JsonStore.String(item["mode"]), out GameMode mode)) return null;
            if (level is not long reached || reached < MinSavedLevel || reached > MaxSavedLevel) return null;
            if (score is not long points || points < 0 || savedAt is not double saved) return null;

            CustomSettings custom = mode == GameMode.Custom ? SettingsStorage.ParseCustom(item["custom"]) : null;
            return new SavedRun(mode, custom, (int)reached, points, saved);
        }

        public static bool Save(IKeyValueStore store, SavedRun run) =>
            JsonStore.Write(store, StorageKeys.SavedRun, new JObject
            {
                ["mode"] = run.Mode.Id(),
                ["custom"] = run.Custom == null ? JValue.CreateNull() : SettingsStorage.CustomToJson(run.Custom),
                ["level"] = run.Level,
                ["score"] = run.Score,
                ["savedAt"] = run.SavedAt,
            });

        public static void Clear(IKeyValueStore store) => store?.RemoveItem(StorageKeys.SavedRun);
    }
}

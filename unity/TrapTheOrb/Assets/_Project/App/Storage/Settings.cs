using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Storage
{
    /// <summary>The player's preferences on this device (storage/settings.ts).</summary>
    public sealed record Settings(string Nickname, bool SoundEnabled, GameMode LastMode, CustomSettings Custom)
    {
        public static readonly Settings Default = new Settings(string.Empty, true, GameMode.Classic, Modes.Preset(CustomPreset.Normal));
    }

    public static class SettingsStorage
    {
        public const int MaxNicknameLength = 16;
        private const int MaxStoredNicknameLength = 64;
        private static readonly Regex UnsafeCharacters = new Regex("[\u0000-\u001f\u007f<>]");
        private static readonly Regex Whitespace = new Regex(@"\s+");

        /// <summary>Display-safe nickname: no control characters or brackets, single spaces, max 16 chars.</summary>
        public static string SanitizeNickname(string input)
        {
            string cleaned = Whitespace.Replace(UnsafeCharacters.Replace(input ?? string.Empty, string.Empty), " ").Trim();
            return (cleaned.Length > MaxNicknameLength ? cleaned.Substring(0, MaxNicknameLength) : cleaned).Trim();
        }

        /// <summary>Stored settings, repaired field by field so one bad value never resets everything.</summary>
        public static Settings Load(IKeyValueStore store)
        {
            if (!(JsonStore.Read(store, StorageKeys.Settings) is JObject record)) return Settings.Default;

            string nickname = JsonStore.String(record["nickname"]);
            JToken sound = record["soundEnabled"];
            JToken custom = record["custom"];
            bool hasMode = GameModeIds.TryParse(JsonStore.String(record["lastMode"]), out GameMode lastMode);

            return new Settings(
                nickname != null && nickname.Length <= MaxStoredNicknameLength ? SanitizeNickname(nickname) : Settings.Default.Nickname,
                sound != null && sound.Type == JTokenType.Boolean ? sound.Value<bool>() : Settings.Default.SoundEnabled,
                hasMode ? lastMode : Settings.Default.LastMode,
                custom == null ? Settings.Default.Custom : ParseCustom(custom));
        }

        public static bool Save(IKeyValueStore store, Settings settings) =>
            JsonStore.Write(store, StorageKeys.Settings, new JObject
            {
                ["nickname"] = SanitizeNickname(settings.Nickname),
                ["soundEnabled"] = settings.SoundEnabled,
                ["lastMode"] = settings.LastMode.Id(),
                ["custom"] = CustomToJson(Modes.SanitizeCustomSettings(settings.Custom)),
            });

        /// <summary>Untrusted stored Custom settings, clamped into the allowed ranges.</summary>
        public static CustomSettings ParseCustom(JToken token)
        {
            if (!(token is JObject custom)) return Modes.SanitizeCustomSettings((RawCustomSettings)null);
            return Modes.SanitizeCustomSettings(new RawCustomSettings(
                Raw(custom, "orbCount"),
                Raw(custom, "speed"),
                Raw(custom, "lives"),
                Raw(custom, "walls"),
                Raw(custom, "timeLimitSeconds"),
                Raw(custom, "targetPercent")));
        }

        public static JObject CustomToJson(CustomSettings custom) => new JObject
        {
            ["orbCount"] = custom.OrbCount,
            ["speed"] = custom.Speed,
            ["lives"] = custom.Lives,
            ["walls"] = custom.Walls,
            ["timeLimitSeconds"] = custom.TimeLimitSeconds,
            ["targetPercent"] = custom.TargetPercent,
        };

        private static RawSetting Raw(JObject custom, string key)
        {
            if (!custom.TryGetValue(key, out JToken token)) return RawSetting.Missing;
            if (token.Type == JTokenType.Null) return RawSetting.Unlimited;
            return JsonStore.Number(token) is double number ? RawSetting.Of(number) : RawSetting.Missing;
        }
    }
}

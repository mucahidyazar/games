using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace TrapTheOrb.App.Storage
{
    /// <summary>The subset of the Web Storage API the game relies on (storage/keyValueStore.ts).</summary>
    public interface IKeyValueStore
    {
        /// <summary>The stored text, or null when the key is missing.</summary>
        string GetItem(string key);

        void SetItem(string key, string value);

        void RemoveItem(string key);
    }

    /// <summary>The same keys as the web game, so the stored data has one shape everywhere.</summary>
    public static class StorageKeys
    {
        public const string Settings = "traptheorb.v1.settings";
        public const string HighScores = "traptheorb.v1.highScores";
        public const string SavedRun = "traptheorb.v1.savedRun";
        public const string Theme = "games.theme";
    }

    /// <summary>In-memory storage for tests.</summary>
    public sealed class MemoryStore : IKeyValueStore
    {
        private readonly Dictionary<string, string> items = new Dictionary<string, string>();

        public string GetItem(string key) => items.TryGetValue(key, out string value) ? value : null;

        public void SetItem(string key, string value) => items[key] = value;

        public void RemoveItem(string key) => items.Remove(key);
    }

    public static class JsonStore
    {
        /// <summary>Parsed JSON for <paramref name="key"/>, or null when missing or unreadable.</summary>
        public static JToken Read(IKeyValueStore store, string key)
        {
            if (store == null) return null;
            try
            {
                string raw = store.GetItem(key);
                return raw == null ? null : JToken.Parse(raw);
            }
            catch (JsonException error)
            {
                Debug.LogWarning($"Ignoring unreadable data in {key}: {error.Message}");
                return null;
            }
        }

        /// <summary>Serialises <paramref name="value"/> into <paramref name="key"/>; returns false instead of throwing.</summary>
        public static bool Write(IKeyValueStore store, string key, JToken value)
        {
            if (store == null) return false;
            try
            {
                store.SetItem(key, value.ToString(Formatting.None));
                return true;
            }
            catch (Exception error)
            {
                Debug.LogWarning($"Could not save {key}: {error.Message}");
                return false;
            }
        }

        /// <summary>A JSON number as a double, or null for anything else (JS "typeof value === 'number'").</summary>
        public static double? Number(JToken token) =>
            token != null && (token.Type == JTokenType.Integer || token.Type == JTokenType.Float) ? token.Value<double>() : (double?)null;

        /// <summary>A whole number within the JS safe-integer range, like zod's z.int().</summary>
        public static long? SafeInteger(JToken token)
        {
            const double MaxSafeInteger = 9007199254740991;
            double? number = Number(token);
            if (number is not double value || double.IsNaN(value) || Math.Floor(value) != value || Math.Abs(value) > MaxSafeInteger) return null;
            return (long)value;
        }

        public static string String(JToken token) => token != null && token.Type == JTokenType.String ? token.Value<string>() : null;
    }
}

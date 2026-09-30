using System;
using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace TrapTheOrb.Engine.Tests
{
    /// <summary>
    /// Golden data exported from the TypeScript engine by unity/tools/engine-fixtures/export-fixtures.ts.
    /// Doubles are stored as IEEE-754 bit patterns, so comparisons are exact.
    /// </summary>
    internal static class Fixtures
    {
        private const string Folder = "_Project/Tests/EditMode/Fixtures";

        public static JToken Load(string name) =>
            JToken.Parse(File.ReadAllText(Path.Combine(Application.dataPath, Folder, name)));

        public static double Bits(JToken token) => BitConverter.Int64BitsToDouble(Convert.ToInt64((string)token, 16));

        public static double? OptionalBits(JToken token) => token == null || token.Type == JTokenType.Null ? (double?)null : Bits(token);

        public static int? OptionalInt(JToken token) => token == null || token.Type == JTokenType.Null ? (int?)null : (int)token;

        /// <summary>Exact bit pattern of a double, for readable failure messages.</summary>
        public static string Hex(double value) => BitConverter.DoubleToInt64Bits(value).ToString("x16");

        /// <summary>FNV-1a over the cell states, the same fingerprint the exporter writes.</summary>
        public static uint GridHash(Grid grid)
        {
            unchecked
            {
                uint hash = 0x811C9DC5u;
                foreach (byte cell in grid.Cells)
                {
                    hash ^= cell;
                    hash *= 0x01000193u;
                }
                return hash;
            }
        }

        public static GameMode Mode(JToken token)
        {
            if (!GameModeIds.TryParse((string)token, out GameMode mode)) throw new ArgumentException($"Unknown mode {token}");
            return mode;
        }

        public static FieldOrientation FieldOf(JToken token) =>
            (string)token == "portrait" ? FieldOrientation.Portrait : FieldOrientation.Landscape;

        public static Orientation OrientationOf(JToken token) =>
            (string)token is "v" or "vertical" ? Orientation.Vertical : Orientation.Horizontal;

        public static CustomSettings Custom(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return null;
            return new CustomSettings(
                (int)token["orbCount"],
                (double)token["speed"],
                OptionalInt(token["lives"]),
                OptionalInt(token["walls"]),
                OptionalInt(token["timeLimitSeconds"]),
                (int)token["targetPercent"]);
        }

        /// <summary>Turns a JSON value into the "raw" form the sanitiser receives from storage.</summary>
        public static RawSetting Raw(JObject input, string key)
        {
            if (input == null || !input.TryGetValue(key, out JToken value)) return RawSetting.Missing;
            if (value.Type == JTokenType.Null) return RawSetting.Unlimited;
            return value.Type is JTokenType.Integer or JTokenType.Float ? RawSetting.Of((double)value) : RawSetting.Missing;
        }
    }
}

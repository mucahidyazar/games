using System;
using System.Globalization;

namespace TrapTheOrb.App.Content
{
    /// <summary>Number and time formats of the web game (lib/format.ts), always in en-US style.</summary>
    public static class Format
    {
        private const int MaxClockSeconds = 99 * 60 + 59;
        /// <summary>Below this, numbers stay exact; above it they become 12.5K / 1.2M.</summary>
        private const long CompactFrom = 10_000;
        private static readonly CultureInfo English = CultureInfo.GetCultureInfo("en-US");

        /// <summary>Milliseconds as a zero-padded mm:ss clock, capped at 99:59.</summary>
        public static string Clock(double ms)
        {
            double safe = double.IsNaN(ms) || double.IsInfinity(ms) ? 0 : ms;
            int totalSeconds = (int)Math.Min(MaxClockSeconds, Math.Max(0, Math.Floor(safe / 1000)));
            return $"{totalSeconds / 60:00}:{totalSeconds % 60:00}";
        }

        /// <summary>Like <see cref="Clock"/> without a leading zero: "0:42", "12:05".</summary>
        public static string ShortClock(double ms)
        {
            string clock = Clock(ms);
            return clock[0] == '0' ? clock.Substring(1) : clock;
        }

        public static string Number(long value) => value.ToString("N0", English);

        /// <summary>Whole percent, floored so a nearly-reached target never looks reached.</summary>
        public static string Percent(double value)
        {
            double safe = double.IsNaN(value) || double.IsInfinity(value) ? 0 : value;
            return $"{Math.Min(100, Math.Max(0, (int)Math.Floor(safe)))}%";
        }

        /// <summary>Short number for tight spaces, e.g. the score on phones: 12.5K, 1.2M.</summary>
        public static string Compact(long value)
        {
            if (value < CompactFrom) return Number(value);
            string[] suffixes = { "K", "M", "B", "T" };
            double scaled = value / 1e3;
            int unit = 0;
            while (unit < suffixes.Length - 1 && Math.Floor(scaled * 10 + 0.5) / 10 >= 1000)
            {
                scaled /= 1000;
                unit++;
            }
            double rounded = Math.Floor(scaled * 10 + 0.5) / 10;
            return rounded.ToString(rounded % 1 == 0 ? "0" : "0.0", English) + suffixes[unit];
        }

        /// <summary>Speed multiplier such as 1.08×.</summary>
        public static string Speed(double factor) => factor.ToString("0.00", English) + "×";

        /// <summary>A decimal with one digit, e.g. the Custom speed 1.3×.</summary>
        public static string OneDecimal(double value) => value.ToString("0.0", English);

        public static string Plural(long count, string one, string many) => count == 1 ? one : many;

        /// <summary>
        /// Lets an "a · b · c" line wrap only after a separator, never inside a part: "∞ lives" stays together.
        /// Spaces inside the parts become no-break spaces.
        /// </summary>
        public static string BreakAtSeparators(string text)
        {
            string[] parts = text.Split(new[] { " · " }, StringSplitOptions.None);
            for (int i = 0; i < parts.Length; i++) parts[i] = parts[i].Replace(' ', '\u00A0');
            return string.Join("\u00A0· ", parts);
        }
    }
}

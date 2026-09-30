using System;
using System.Security.Cryptography;

namespace TrapTheOrb.Engine
{
    /// <summary>Deterministic randomness, identical to the web engine's random.ts.</summary>
    public static class Rng
    {
        private const uint Mulberry32Increment = 0x6D2B79F5u;
        private const double TwoToThe32 = 4294967296.0;
        private const uint FnvOffsetBasis = 0x811C9DC5u;
        private const uint FnvPrime = 0x01000193u;
        private const string DailyPrefix = "traptheorb:daily:";

        /// <summary>
        /// Pure mulberry32: the next value in [0, 1) together with the seed for the following draw,
        /// so game state stays reproducible.
        /// </summary>
        public static (double Value, uint NextSeed) Next(uint seed)
        {
            unchecked
            {
                uint nextSeed = seed + Mulberry32Increment;
                uint t = nextSeed;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                double value = (t ^ (t >> 14)) / TwoToThe32;
                return (value, nextSeed);
            }
        }

        /// <summary>A random 32-bit seed for a fresh game.</summary>
        public static uint RandomSeed()
        {
            var bytes = new byte[sizeof(uint)];
            using (var generator = RandomNumberGenerator.Create())
            {
                generator.GetBytes(bytes);
            }
            return BitConverter.ToUInt32(bytes, 0);
        }

        /// <summary>
        /// Seed of the Daily Challenge for a UTC date (YYYY-MM-DD): the same levels for everyone that day.
        /// FNV-1a, so the app, the browser and the server agree.
        /// </summary>
        public static uint DailySeed(string isoDate)
        {
            unchecked
            {
                uint hash = FnvOffsetBasis;
                foreach (char character in DailyPrefix + isoDate)
                {
                    hash ^= character;
                    hash *= FnvPrime;
                }
                return hash;
            }
        }

        /// <summary>The UTC date key of the Daily Challenge, e.g. 2026-09-27.</summary>
        public static string UtcDateKey(DateTime utcNow) => utcNow.ToUniversalTime().ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
    }
}

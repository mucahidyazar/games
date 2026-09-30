using System;

namespace TrapTheOrb.Engine
{
    /// <summary>JavaScript number semantics the engine relies on, so results match the web engine bit for bit.</summary>
    public static class JsMath
    {
        /// <summary>
        /// <c>Math.round</c>: the nearest integer, halves towards +∞. .NET's Math.Round rounds halves to even,
        /// and <c>Math.Floor(x + 0.5)</c> is off for 0.49999999999999994, so compare the exact fraction instead.
        /// </summary>
        public static double Round(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return value;
            double floor = Math.Floor(value);
            return value - floor >= 0.5 ? floor + 1 : floor;
        }

        /// <summary><c>Number.isFinite</c>.</summary>
        public static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }
}

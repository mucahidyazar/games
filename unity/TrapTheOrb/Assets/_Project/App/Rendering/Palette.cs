using UnityEngine;

namespace TrapTheOrb.App.Rendering
{
    /// <summary>The two site themes. Navy dark is the default, as on the web.</summary>
    public enum Theme
    {
        Navy,
        Light,
    }

    /// <summary>Board colours of a theme (render/palette.ts plus the CSS tokens in index.css).</summary>
    public sealed class BoardPalette
    {
        private BoardPalette(Color32 field, Color32 captured, Color32 wall, Color32 building, Color32 anchor, Color32 pointsText)
        {
            Field = field;
            Captured = captured;
            Wall = wall;
            Building = building;
            Anchor = anchor;
            PointsText = pointsText;
        }

        public Color32 Field { get; }
        public Color32 Captured { get; }
        public Color32 Wall { get; }
        public Color32 Building { get; }
        public Color32 Anchor { get; }

        /// <summary>--color-teal-700: the "+120" capture text.</summary>
        public Color32 PointsText { get; }

        /// <summary>--color-coral-500 in both themes.</summary>
        public Color32 Broken => BrokenColor;

        private static readonly Color32 BrokenColor = Hex("#ed6461");

        public static readonly BoardPalette Navy = new BoardPalette(
            Hex("#0e1c33"), Hex("#1b4852"), Hex("#6c8ca5"), Hex("#53dac7"), Hex("#a0eee0"), Hex("#7ee1d0"));

        public static readonly BoardPalette Light = new BoardPalette(
            Hex("#ffffff"), Hex("#dcf1f0"), Hex("#a0b6c6"), Hex("#0bb5a9"), Hex("#0aa39a"), Hex("#077f85"));

        public static BoardPalette For(Theme theme) => theme == Theme.Light ? Light : Navy;

        /// <summary>One colour per speed tier (calm, quick, fast, blazing); the trail colour of each orb.</summary>
        public static readonly Color32[] TrailColors = { Hex("#2b8cff"), Hex("#ff8c1a"), Hex("#ef4f6c"), Hex("#8b5cf6") };

        /// <summary>Capture confetti: teal, mint and amber.</summary>
        public static readonly Color32[] ParticleColors = { Hex("#0bb5a9"), Hex("#7fd9d0"), Hex("#f5b83d") };

        public static Color32 Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out Color color);
            return color;
        }

        public static Color32 WithAlpha(Color32 color, float alpha) =>
            new Color32(color.r, color.g, color.b, (byte)Mathf.Clamp(Mathf.RoundToInt(alpha * 255), 0, 255));
    }
}

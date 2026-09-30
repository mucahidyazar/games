using System;
using TrapTheOrb.App.Rendering;
using UnityEngine;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>One CSS box-shadow: offset, blur radius, spread and colour, in UI units.</summary>
    public readonly struct BoxShadow
    {
        public BoxShadow(float x, float y, float blur, float spread, Color32 color)
        {
            X = x;
            Y = y;
            Blur = blur;
            Spread = spread;
            Color = color;
        }

        public float X { get; }
        public float Y { get; }
        public float Blur { get; }
        public float Spread { get; }
        public Color32 Color { get; }

        /// <summary>How far the shadow reaches past the element's edge.</summary>
        public float Reach => Math.Max(0, Spread + Blur * 1.5f) + Math.Max(Math.Abs(X), Math.Abs(Y));
    }

    /// <summary>A shadow token of the site (--shadow-card, --shadow-lift, --shadow-coral) for both themes.</summary>
    public sealed class ShadowToken
    {
        private readonly BoxShadow[] navy;
        private readonly BoxShadow[] light;

        private ShadowToken(BoxShadow[] navy, BoxShadow[] light)
        {
            this.navy = navy;
            this.light = light;
        }

        public BoxShadow[] For(Theme theme) => theme == Theme.Light ? light : navy;

        private static readonly Color32 Ink = new Color32(15, 37, 72, 255);
        private static readonly Color32 Black = new Color32(0, 0, 0, 255);

        public static readonly ShadowToken Card = new ShadowToken(
            new[] { new BoxShadow(0, 2, 12, 0, Alpha(Black, 0.12f)) },
            new[] { new BoxShadow(0, 1, 2, 0, Alpha(Ink, 0.04f)), new BoxShadow(0, 6, 18, -12, Alpha(Ink, 0.12f)) });

        public static readonly ShadowToken Lift = new ShadowToken(
            new[] { new BoxShadow(0, 16, 42, 0, Alpha(Black, 0.3f)) },
            new[] { new BoxShadow(0, 2, 4, 0, Alpha(Ink, 0.05f)), new BoxShadow(0, 16, 32, -12, Alpha(Ink, 0.18f)) });

        public static readonly ShadowToken Coral = new ShadowToken(
            new[] { new BoxShadow(0, 8, 18, -10, Alpha(new Color32(210, 66, 61, 255), 0.55f)) },
            new[] { new BoxShadow(0, 8, 18, -10, Alpha(new Color32(210, 66, 61, 255), 0.55f)) });

        private static Color32 Alpha(Color32 color, float alpha) => BoardPalette.WithAlpha(color, alpha);
    }

    /// <summary>
    /// Paints box shadows into a texture: each shadow is a Gaussian-blurred rectangle (separable, so exact for
    /// square corners), combined like stacked CSS shadows. The element's own rounded box is cut out, because a
    /// CSS outer shadow is never painted under the element.
    /// </summary>
    public static class ShadowPainter
    {
        /// <summary>Texture pixels per UI unit; shadows are soft, so this only needs to keep the cut-out edge clean.</summary>
        public const float PixelsPerUnit = 2;

        public static Texture2D Paint(float width, float height, float radius, float margin, BoxShadow[] shadows)
        {
            int texWidth = Math.Max(1, Mathf.CeilToInt((width + margin * 2) * PixelsPerUnit));
            int texHeight = Math.Max(1, Mathf.CeilToInt((height + margin * 2) * PixelsPerUnit));
            var pixels = new Color32[texWidth * texHeight];
            var columns = new float[shadows.Length][];
            var rows = new float[shadows.Length][];
            for (int i = 0; i < shadows.Length; i++)
            {
                BoxShadow shadow = shadows[i];
                columns[i] = Profile(texWidth, margin, shadow.X - shadow.Spread, width + shadow.X + shadow.Spread, shadow.Blur / 2);
                rows[i] = Profile(texHeight, margin, shadow.Y - shadow.Spread, height + shadow.Y + shadow.Spread, shadow.Blur / 2);
            }

            Color32 tint = shadows.Length > 0 ? shadows[0].Color : new Color32(0, 0, 0, 0);
            for (int y = 0; y < texHeight; y++)
            {
                float unitY = (y + 0.5f) / PixelsPerUnit - margin;
                // Texture rows start at the bottom.
                int rowStart = (texHeight - 1 - y) * texWidth;
                for (int x = 0; x < texWidth; x++)
                {
                    float unitX = (x + 0.5f) / PixelsPerUnit - margin;
                    float clear = 1;
                    for (int i = 0; i < shadows.Length; i++)
                    {
                        clear *= 1 - shadows[i].Color.a / 255f * columns[i][x] * rows[i][y];
                    }
                    float alpha = (1 - clear) * Outside(unitX, unitY, width, height, radius);
                    pixels[rowStart + x] = new Color32(tint.r, tint.g, tint.b, (byte)Mathf.Clamp(Mathf.RoundToInt(alpha * 255), 0, 255));
                }
            }

            var texture = new Texture2D(texWidth, texHeight, TextureFormat.RGBA32, mipChain: false, linear: false)
            {
                name = "BoxShadow",
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
                hideFlags = HideFlags.DontSave,
            };
            texture.SetPixels32(pixels);
            texture.Apply(updateMipmaps: false);
            return texture;
        }

        /// <summary>Coverage of the blurred interval [start, end] at each pixel along one axis.</summary>
        private static float[] Profile(int count, float margin, float start, float end, float sigma)
        {
            var values = new float[count];
            for (int i = 0; i < count; i++)
            {
                float unit = (i + 0.5f) / PixelsPerUnit - margin;
                values[i] = sigma <= 0.01f
                    ? (unit >= start && unit <= end ? 1 : 0)
                    : 0.5f * (Erf((unit - start) / (sigma * 1.41421356f)) - Erf((unit - end) / (sigma * 1.41421356f)));
            }
            return values;
        }

        /// <summary>1 outside the element's rounded box, 0 inside, with a one-pixel soft edge.</summary>
        private static float Outside(float x, float y, float width, float height, float radius)
        {
            float halfWidth = width / 2;
            float halfHeight = height / 2;
            float qx = Math.Abs(x - halfWidth) - (halfWidth - radius);
            float qy = Math.Abs(y - halfHeight) - (halfHeight - radius);
            float outside = new Vector2(Math.Max(qx, 0), Math.Max(qy, 0)).magnitude + Math.Min(Math.Max(qx, qy), 0) - radius;
            return Mathf.Clamp01(outside * PixelsPerUnit + 0.5f);
        }

        /// <summary>Abramowitz–Stegun 7.1.26, accurate to 1.5e-7.</summary>
        private static float Erf(float x)
        {
            float sign = x < 0 ? -1 : 1;
            x = Math.Abs(x);
            float t = 1 / (1 + 0.3275911f * x);
            float y = 1 - ((((1.061405429f * t - 1.453152027f) * t + 1.421413741f) * t - 0.284496736f) * t + 0.254829592f) * t * Mathf.Exp(-x * x);
            return sign * y;
        }
    }
}

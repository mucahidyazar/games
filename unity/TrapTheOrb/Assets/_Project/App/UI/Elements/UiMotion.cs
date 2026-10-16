using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using UnityEngine.UIElements.Experimental;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>
    /// The app's transitions, on transform and opacity only. With reduced motion every one of them jumps to its end
    /// state, so nothing waits on an animation.
    /// </summary>
    public static class UiMotion
    {
        private const int RiseMs = 420;
        private const int PopMs = 260;
        private const int SheetInMs = 340;
        private const int SheetOutMs = 200;
        private const int FadeMs = 220;
        private const float RiseOffsetPx = 12;
        private const float RiseScale = 0.98f;
        private const float PopScale = 0.96f;

        private static readonly Dictionary<VisualElement, IValueAnimation> Running = new Dictionary<VisualElement, IValueAnimation>();

        /// <summary>cubic-bezier(0.16, 1, 0.3, 1), the site's --ease-out-expo.</summary>
        public static readonly Func<float, float> EaseOutExpo = CubicBezier(0.16f, 1f, 0.3f, 1f);

        private static readonly Func<float, float> EaseInQuad = t => t * t;

        /// <summary>Whether motion is reduced for this player; transitions then jump to the end.</summary>
        public static bool IsReduced { get; set; }

        /// <summary>Fades in while moving up and growing from 98% (animate-rise).</summary>
        public static void Rise(VisualElement element) =>
            Animate(element, RiseMs, EaseOutExpo, t => Apply(element, t, new Vector3(0, RiseOffsetPx * (1 - t), Mathf.Lerp(RiseScale, 1, t))));

        /// <summary>Fades in while growing from 96% (animate-pop).</summary>
        public static void Pop(VisualElement element) =>
            Animate(element, PopMs, EaseOutExpo, t => Apply(element, t, new Vector3(0, 0, Mathf.Lerp(PopScale, 1, t))));

        /// <summary>Slides a bottom sheet up from below the screen edge.</summary>
        public static void SlideUp(VisualElement sheet) =>
            Animate(sheet, SheetInMs, EaseOutExpo, t => sheet.style.translate = new Translate(0, Length.Percent(100 * (1 - t))));

        /// <summary>Slides a bottom sheet back down, then runs <paramref name="done"/>.</summary>
        public static void SlideDown(VisualElement sheet, Action done) =>
            Animate(sheet, SheetOutMs, EaseInQuad, t => sheet.style.translate = new Translate(0, Length.Percent(100 * t)), done);

        public static void FadeIn(VisualElement element) =>
            Animate(element, FadeMs, EaseOutExpo, t => element.style.opacity = t);

        public static void FadeOut(VisualElement element, Action done = null) =>
            Animate(element, FadeMs, EaseInQuad, t => element.style.opacity = 1 - t, done);

        /// <summary>
        /// Stops every running transition, for a screen that is going away: the animation of a detached element
        /// never completes, so the list of running ones would keep the old screen alive.
        /// </summary>
        public static void StopAll()
        {
            var running = new List<IValueAnimation>(Running.Values);
            Running.Clear();
            foreach (IValueAnimation animation in running) animation.Stop();
        }

        /// <summary>Runs <paramref name="frame"/> from 0 to 1, replacing any animation still running on the element.</summary>
        private static void Animate(VisualElement element, int durationMs, Func<float, float> easing, Action<float> frame, Action done = null)
        {
            if (Running.TryGetValue(element, out IValueAnimation previous))
            {
                Running.Remove(element);
                previous.Stop();
            }
            if (IsReduced || element.panel == null)
            {
                frame(1);
                done?.Invoke();
                return;
            }

            frame(0);
            ValueAnimation<float> animation = element.experimental.animation.Start(0f, 1f, durationMs, (_, value) => frame(value)).Ease(easing);
            Running[element] = animation;
            animation.OnCompleted(() =>
            {
                // A stopped animation also completes; only the one still in charge of the element may finish it.
                if (!Running.TryGetValue(element, out IValueAnimation current) || current != animation) return;
                Running.Remove(element);
                frame(1);
                done?.Invoke();
            });
        }

        private static void Apply(VisualElement element, float t, Vector3 values)
        {
            element.style.opacity = t;
            element.style.translate = new Translate(values.x, values.y);
            element.style.scale = new Scale(new Vector2(values.z, values.z));
        }

        /// <summary>A CSS cubic-bezier timing function: solves x(t) = progress, returns y(t).</summary>
        public static Func<float, float> CubicBezier(float x1, float y1, float x2, float y2)
        {
            float cx = 3 * x1;
            float bx = 3 * (x2 - x1) - cx;
            float ax = 1 - cx - bx;
            float cy = 3 * y1;
            float by = 3 * (y2 - y1) - cy;
            float ay = 1 - cy - by;

            float SampleX(float t) => ((ax * t + bx) * t + cx) * t;
            float SampleY(float t) => ((ay * t + by) * t + cy) * t;
            float SlopeX(float t) => (3 * ax * t + 2 * bx) * t + cx;

            float SolveT(float progress)
            {
                float t = progress;
                for (int i = 0; i < 8; i++)
                {
                    float error = SampleX(t) - progress;
                    if (Mathf.Abs(error) < 1e-5f) return t;
                    float slope = SlopeX(t);
                    if (Mathf.Abs(slope) < 1e-6f) break;
                    t -= error / slope;
                }

                // Newton's method can overshoot on steep curves; bisection always converges.
                float low = 0;
                float high = 1;
                t = progress;
                for (int i = 0; i < 24; i++)
                {
                    float x = SampleX(t);
                    if (Mathf.Abs(x - progress) < 1e-5f) break;
                    if (x < progress) low = t;
                    else high = t;
                    t = (low + high) / 2;
                }
                return t;
            }

            return progress =>
            {
                if (progress <= 0) return 0;
                if (progress >= 1) return 1;
                return SampleY(Mathf.Clamp01(SolveT(progress)));
            };
        }
    }

    /// <summary>Gradients as small textures, since USS has no gradient backgrounds.</summary>
    public static class GradientTexture
    {
        private const int Height = 256;

        /// <summary>A top-to-bottom gradient through the given stops (position 0 is the top).</summary>
        public static Texture2D Vertical(params (float Position, Color Color)[] stops)
        {
            if (stops == null || stops.Length == 0) throw new ArgumentException("A gradient needs at least one stop", nameof(stops));
            var texture = new Texture2D(1, Height, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                hideFlags = HideFlags.DontSave,
            };
            var pixels = new Color[Height];
            for (int row = 0; row < Height; row++)
            {
                // Texture rows start at the bottom; UI Toolkit draws the last row at the top of the element.
                float position = 1f - (row + 0.5f) / Height;
                pixels[row] = Sample(stops, position);
            }
            texture.SetPixels(pixels);
            texture.Apply(false);
            return texture;
        }

        private static Color Sample((float Position, Color Color)[] stops, float position)
        {
            if (position <= stops[0].Position) return stops[0].Color;
            for (int i = 1; i < stops.Length; i++)
            {
                if (position > stops[i].Position) continue;
                (float from, Color fromColor) = stops[i - 1];
                (float to, Color toColor) = stops[i];
                float t = to - from < 1e-5f ? 1 : (position - from) / (to - from);
                return Color.Lerp(fromColor, toColor, t);
            }
            return stops[stops.Length - 1].Color;
        }
    }
}

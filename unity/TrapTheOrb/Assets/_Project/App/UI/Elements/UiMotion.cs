using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>The web game's entrance animations, on transform and opacity only.</summary>
    public static class UiMotion
    {
        private const int RiseMs = 420;
        private const int PopMs = 320;
        private const float RiseOffsetPx = 10;
        private const float RiseScale = 0.98f;
        private const float PopScale = 0.94f;

        /// <summary>cubic-bezier(0.16, 1, 0.3, 1), the site's --ease-out-expo.</summary>
        public static readonly Func<float, float> EaseOutExpo = CubicBezier(0.16f, 1f, 0.3f, 1f);

        /// <summary>Whether motion is reduced for this player; entrance animations then jump to the end.</summary>
        public static bool IsReduced { get; set; }

        /// <summary>Fades in while moving up 10px and growing from 98% (animate-rise).</summary>
        public static void Rise(VisualElement element) =>
            Animate(element, RiseMs, t => new Vector3(0, RiseOffsetPx * (1 - t), Mathf.Lerp(RiseScale, 1, t)));

        /// <summary>Fades in while growing from 94% (animate-pop).</summary>
        public static void Pop(VisualElement element) =>
            Animate(element, PopMs, t => new Vector3(0, 0, Mathf.Lerp(PopScale, 1, t)));

        /// <summary><paramref name="frame"/> maps eased progress to (x offset, y offset, scale).</summary>
        private static void Animate(VisualElement element, int durationMs, Func<float, Vector3> frame)
        {
            if (IsReduced)
            {
                Apply(element, 1, frame);
                return;
            }
            Apply(element, 0, frame);
            element.experimental.animation
                .Start(0f, 1f, durationMs, (target, value) => Apply(target, value, frame))
                .Ease(EaseOutExpo)
                .OnCompleted(() => Apply(element, 1, frame));
        }

        private static void Apply(VisualElement element, float t, Func<float, Vector3> frame)
        {
            Vector3 values = frame(t);
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
}

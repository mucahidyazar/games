using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>Progress ring for captured area, with a tick marking the level target (AreaRing.tsx, 28×28).</summary>
    public sealed class AreaRing : VisualElement
    {
        private const float ViewBox = 28;
        private const float Radius = 11;
        private const float Stroke = 4;
        private static readonly CustomStyleProperty<Color> TrackColor = new CustomStyleProperty<Color>("--ring-track");
        private static readonly CustomStyleProperty<Color> TickColor = new CustomStyleProperty<Color>("--ring-tick");
        private static readonly CustomStyleProperty<Color> ReachedColor = new CustomStyleProperty<Color>("--ring-reached");
        private static readonly Color Progress = new Color32(0x1b, 0xb4, 0xab, 255);

        private float percent;
        private float target = 75;
        private Color track = new Color32(0x20, 0x48, 0x54, 255);
        private Color tick = new Color32(0x9a, 0xac, 0xc5, 255);
        private Color reached = new Color32(0x7f, 0xd9, 0xd0, 255);

        public AreaRing()
        {
            AddToClassList("area-ring");
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Draw;
            RegisterCallback<CustomStyleResolvedEvent>(evt =>
            {
                evt.customStyle.TryGetValue(TrackColor, out track);
                evt.customStyle.TryGetValue(TickColor, out tick);
                evt.customStyle.TryGetValue(ReachedColor, out reached);
                MarkDirtyRepaint();
            });
        }

        public void Show(float capturedPercent, float targetPercent)
        {
            if (Math.Abs(capturedPercent - percent) < 0.01f && Math.Abs(targetPercent - target) < 0.01f) return;
            percent = capturedPercent;
            target = targetPercent;
            MarkDirtyRepaint();
        }

        private void Draw(MeshGenerationContext context)
        {
            float unit = Math.Min(contentRect.width, contentRect.height) / ViewBox;
            if (unit <= 0) return;
            var centre = new Vector2(contentRect.width / 2, contentRect.height / 2);
            Painter2D painter = context.painter2D;
            painter.lineWidth = Stroke * unit;

            painter.strokeColor = track;
            painter.lineCap = LineCap.Butt;
            painter.BeginPath();
            painter.Arc(centre, Radius * unit, 0, 360);
            painter.Stroke();

            float progress = Mathf.Clamp01(percent / 100);
            if (progress > 0)
            {
                painter.strokeColor = Progress;
                painter.lineCap = LineCap.Round;
                painter.BeginPath();
                painter.Arc(centre, Radius * unit, -90, -90 + 360 * progress);
                painter.Stroke();
            }

            // The target tick sits on the ring's outer edge, rotated like the SVG's rotate(target% × 360).
            float angle = (target / 100 * 360 - 90) * Mathf.Deg2Rad;
            var direction = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
            painter.strokeColor = percent >= target ? reached : tick;
            painter.lineWidth = 1.6f * unit;
            painter.lineCap = LineCap.Round;
            painter.BeginPath();
            painter.MoveTo(centre + direction * (ViewBox / 2 - 0.6f) * unit);
            painter.LineTo(centre + direction * (ViewBox / 2 - 5.4f) * unit);
            painter.Stroke();
        }
    }

    /// <summary>Half-circle speedometer: empty at level-1 speed, full at the speed cap (SpeedGauge.tsx, 32×24).</summary>
    public sealed class SpeedGauge : VisualElement
    {
        private const float ViewWidth = 32;
        private const float ViewHeight = 24;
        private static readonly CustomStyleProperty<Color> TrackColor = new CustomStyleProperty<Color>("--gauge-track");
        private static readonly CustomStyleProperty<Color> NeedleColor = new CustomStyleProperty<Color>("--gauge-needle");
        private static readonly Color Calm = new Color32(0x2e, 0xc4, 0xbc, 255);
        private static readonly Color Warm = new Color32(0xf5, 0xb8, 0x3d, 255);
        private static readonly Color Hot = new Color32(0xed, 0x64, 0x61, 255);

        private float progress;
        private Color track = new Color32(0x40, 0x56, 0x72, 255);
        private Color needle = new Color32(0xf3, 0xf6, 0xfc, 255);

        public SpeedGauge()
        {
            AddToClassList("speed-gauge");
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Draw;
            RegisterCallback<CustomStyleResolvedEvent>(evt =>
            {
                evt.customStyle.TryGetValue(TrackColor, out track);
                evt.customStyle.TryGetValue(NeedleColor, out needle);
                MarkDirtyRepaint();
            });
        }

        public void Show(double factor, double maxFactor)
        {
            float next = maxFactor > 1 ? Mathf.Clamp01((float)((factor - 1) / (maxFactor - 1))) : 0;
            if (Math.Abs(next - progress) < 0.001f) return;
            progress = next;
            MarkDirtyRepaint();
        }

        private void Draw(MeshGenerationContext context)
        {
            float unit = Math.Min(contentRect.width / ViewWidth, contentRect.height / ViewHeight);
            if (unit <= 0) return;
            var origin = new Vector2((contentRect.width - ViewWidth * unit) / 2, (contentRect.height - ViewHeight * unit) / 2);
            Vector2 centre = origin + new Vector2(16, 19) * unit;
            Painter2D painter = context.painter2D;

            painter.lineWidth = 4 * unit;
            painter.lineCap = LineCap.Round;
            painter.strokeColor = track;
            painter.BeginPath();
            painter.Arc(centre, 11 * unit, 180, 360);
            painter.Stroke();

            if (progress > 0.001f)
            {
                painter.strokeColor = progress < 0.6f ? Color.Lerp(Calm, Warm, progress / 0.6f) : Color.Lerp(Warm, Hot, (progress - 0.6f) / 0.4f);
                painter.BeginPath();
                painter.Arc(centre, 11 * unit, 180, 180 + 180 * progress);
                painter.Stroke();
            }

            float angle = (180 + 180 * progress) * Mathf.Deg2Rad;
            painter.strokeColor = needle;
            painter.lineWidth = 2 * unit;
            painter.BeginPath();
            painter.MoveTo(centre);
            painter.LineTo(centre + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * 8 * unit);
            painter.Stroke();

            painter.fillColor = needle;
            painter.BeginPath();
            painter.Arc(centre, 2.4f * unit, 0, 360);
            painter.Fill();
        }
    }
}

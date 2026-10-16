using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// Progress ring for the captured area: it fills toward the level's target, so a full ring means the level
    /// can be cleared, and turns mint once the target is reached.
    /// </summary>
    public sealed class AreaRing : VisualElement
    {
        private const float Stroke = 5;
        private static readonly CustomStyleProperty<Color> TrackColor = new CustomStyleProperty<Color>("--ring-track");
        private static readonly CustomStyleProperty<Color> ProgressColor = new CustomStyleProperty<Color>("--ring-progress");
        private static readonly CustomStyleProperty<Color> ReachedColor = new CustomStyleProperty<Color>("--ring-reached");

        private float percent;
        private float target = 75;
        private Color track = new Color32(0x19, 0x2d, 0x49, 255);
        private Color progress = new Color32(0x2e, 0xc4, 0xbc, 255);
        private Color reached = new Color32(0x7f, 0xd9, 0xd0, 255);

        public AreaRing()
        {
            AddToClassList("area-ring");
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Draw;
            RegisterCallback<CustomStyleResolvedEvent>(evt =>
            {
                if (evt.customStyle.TryGetValue(TrackColor, out Color value)) track = value;
                if (evt.customStyle.TryGetValue(ProgressColor, out value)) progress = value;
                if (evt.customStyle.TryGetValue(ReachedColor, out value)) reached = value;
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
            float size = Math.Min(contentRect.width, contentRect.height);
            if (size <= Stroke) return;
            var centre = new Vector2(contentRect.width / 2, contentRect.height / 2);
            float radius = (size - Stroke) / 2;
            Painter2D painter = context.painter2D;
            painter.lineWidth = Stroke;

            painter.strokeColor = track;
            painter.lineCap = LineCap.Butt;
            painter.BeginPath();
            painter.Arc(centre, radius, 0, 360);
            painter.Stroke();

            float fraction = target > 0 ? Mathf.Clamp01(percent / target) : 0;
            if (fraction <= 0) return;
            painter.strokeColor = fraction >= 1 ? reached : progress;
            painter.lineCap = fraction >= 1 ? LineCap.Butt : LineCap.Round;
            painter.BeginPath();
            painter.Arc(centre, radius, -90, -90 + 360 * fraction);
            painter.Stroke();
        }
    }
}

using System;
using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// The "+120" that rises from a capture (renderer.ts drawPoints): 800-weight text with a white outline,
    /// fading in fast, rising 28px and fading out in its second half. Labels are pooled; per frame they are only
    /// moved and faded, and their text is set once per popup.
    /// </summary>
    public sealed class PointsLayer : VisualElement
    {
        private const float RisePx = 28;
        private const double FadeInEnd = 0.12;
        private const double FadeOutStart = 0.55;

        private readonly List<Slot> pool = new List<Slot>();
        private Color color = new Color32(0x7e, 0xe1, 0xd0, 255);

        public PointsLayer()
        {
            AddToClassList("points-layer");
            pickingMode = PickingMode.Ignore;
        }

        public void SetColor(Color32 pointsColor)
        {
            color = pointsColor;
            foreach (Slot slot in pool) slot.Label.style.color = color;
        }

        public void Show(IReadOnlyList<Effect> effects, FieldLayout layout, Vector2 shake, double now, bool reducedMotion)
        {
            int used = 0;
            for (int i = 0; i < effects.Count; i++)
            {
                if (!(effects[i] is PointsPopup popup)) continue;
                double t = (now - popup.StartedAt) / popup.DurationMs;
                if (t < 0 || t >= 1) continue;

                float rise = reducedMotion ? 0 : (float)(1 - Math.Pow(1 - t, 3)) * RisePx;
                double alpha = t < FadeInEnd ? t / FadeInEnd : 1 - Math.Min(1, Math.Max(0, (t - FadeOutStart) / (1 - FadeOutStart)));
                Slot slot = Take(used++);
                if (!ReferenceEquals(slot.Popup, popup))
                {
                    slot.Popup = popup;
                    slot.Label.text = "+" + Format.Number(popup.Value);
                }
                slot.Anchor.style.translate = new Translate(layout.X(popup.X) + shake.x, layout.Y(popup.Y) - rise + shake.y);
                slot.Anchor.style.opacity = (float)alpha;
                slot.Anchor.style.display = DisplayStyle.Flex;
            }
            for (int i = used; i < pool.Count; i++)
            {
                pool[i].Popup = null;
                pool[i].Anchor.style.display = DisplayStyle.None;
            }
        }

        /// <summary>A zero-size anchor at the text's centre; the label inside centres itself on it.</summary>
        private Slot Take(int index)
        {
            if (index < pool.Count) return pool[index];
            Label label = Ui.Text(string.Empty, "points-popup__text");
            label.style.color = color;
            VisualElement anchor = Ui.Div("points-popup").Children(label);
            anchor.pickingMode = PickingMode.Ignore;
            var slot = new Slot(anchor, label);
            pool.Add(slot);
            Add(anchor);
            return slot;
        }

        private sealed class Slot
        {
            public Slot(VisualElement anchor, Label label)
            {
                Anchor = anchor;
                Label = label;
            }

            public VisualElement Anchor { get; }
            public Label Label { get; }

            /// <summary>The popup this slot shows, so its text is only set once.</summary>
            public PointsPopup Popup { get; set; }
        }
    }
}

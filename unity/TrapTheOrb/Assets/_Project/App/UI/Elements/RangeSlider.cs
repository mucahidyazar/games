using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>
    /// The site's range slider (.range): a light rail, a teal fill up to the value and a white thumb.
    /// Dragging anywhere on it sets the value, snapped to the step.
    /// </summary>
    public sealed class RangeSlider : VisualElement
    {
        private readonly double min;
        private readonly double max;
        private readonly double step;
        private readonly Action<double> onChange;
        private readonly VisualElement fill;
        private readonly VisualElement thumb;
        private int? activePointer;
        private double value;
        private bool isDisabled;

        public RangeSlider(double min, double max, double step, Action<double> onChange)
        {
            if (max <= min) throw new ArgumentException("A slider needs max > min", nameof(max));
            this.min = min;
            this.max = max;
            this.step = step > 0 ? step : 1;
            this.onChange = onChange;
            AddToClassList("range");

            VisualElement rail = Ui.Div("range__rail");
            fill = Ui.Div("range__fill");
            thumb = Ui.Div("range__thumb");
            rail.Add(fill);
            Add(rail);
            Add(thumb);

            RegisterCallback<PointerDownEvent>(OnPointerDown);
            RegisterCallback<PointerMoveEvent>(OnPointerMove);
            RegisterCallback<PointerUpEvent>(OnPointerUp);
            RegisterCallback<PointerCaptureOutEvent>(_ => EndDrag());
        }

        public double Value
        {
            get => value;
            set
            {
                this.value = Math.Min(max, Math.Max(min, value));
                float percent = (float)((this.value - min) / (max - min) * 100);
                fill.style.width = Length.Percent(percent);
                thumb.style.left = Length.Percent(percent);
            }
        }

        public bool IsDisabled
        {
            get => isDisabled;
            set
            {
                isDisabled = value;
                EnableInClassList("range--disabled", value);
                if (value) EndDrag();
            }
        }

        private void OnPointerDown(PointerDownEvent evt)
        {
            // A drag whose pointer-up never arrived (the app was suspended mid-drag) must not block the slider.
            if (activePointer is int stale && !this.HasPointerCapture(stale)) EndDrag();
            if (isDisabled || activePointer != null) return;
            activePointer = evt.pointerId;
            this.CapturePointer(evt.pointerId);
            AddToClassList("range--active");
            SetFromPosition(evt.localPosition.x);
            evt.StopPropagation();
        }

        private void OnPointerMove(PointerMoveEvent evt)
        {
            if (activePointer != evt.pointerId) return;
            SetFromPosition(evt.localPosition.x);
            evt.StopPropagation();
        }

        private void OnPointerUp(PointerUpEvent evt)
        {
            if (activePointer != evt.pointerId) return;
            SetFromPosition(evt.localPosition.x);
            this.ReleasePointer(evt.pointerId);
            EndDrag();
            evt.StopPropagation();
        }

        private void EndDrag()
        {
            activePointer = null;
            RemoveFromClassList("range--active");
        }

        private void SetFromPosition(float x)
        {
            float width = contentRect.width;
            if (width <= 0) return;
            double ratio = Mathf.Clamp01(x / width);
            double steps = Math.Round(ratio * (max - min) / step);
            double next = Math.Min(max, Math.Max(min, min + steps * step));
            // Avoid 1.3000000000000003 from repeated float steps.
            next = Math.Round(next * 1000) / 1000;
            if (next == value) return;
            Value = next;
            onChange?.Invoke(next);
        }
    }
}

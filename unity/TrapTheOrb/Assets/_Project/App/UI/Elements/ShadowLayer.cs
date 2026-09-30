using System;
using TrapTheOrb.App.Rendering;
using UnityEngine;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>
    /// A box shadow behind its parent (UI Toolkit has no box-shadow). It sits as the parent's first child, reaches
    /// outside it, and repaints when the parent's size or the theme changes.
    /// </summary>
    public sealed class ShadowLayer : VisualElement
    {
        private const float ResizeTolerance = 0.5f;

        private static Theme currentTheme = Theme.Navy;
        private static event Action ThemeChanged;

        private readonly ShadowToken token;
        private readonly float radius;
        private VisualElement host;
        private Texture2D texture;
        private Vector2 paintedSize = new Vector2(-1, -1);
        private Theme paintedTheme;

        private ShadowLayer(ShadowToken token, float radius)
        {
            this.token = token;
            this.radius = radius;
            pickingMode = PickingMode.Ignore;
            AddToClassList("shadow-layer");
            style.position = Position.Absolute;
            RegisterCallback<AttachToPanelEvent>(_ =>
            {
                ThemeChanged += Repaint;
                // A re-attached host keeps its size, so no geometry event would repaint the released texture.
                schedule.Execute(Repaint);
            });
            RegisterCallback<DetachFromPanelEvent>(_ =>
            {
                ThemeChanged -= Repaint;
                Release();
            });
        }

        /// <summary>The theme every shadow is painted for.</summary>
        public static Theme Theme
        {
            get => currentTheme;
            set
            {
                if (value == currentTheme) return;
                currentTheme = value;
                ThemeChanged?.Invoke();
            }
        }

        /// <summary>Gives <paramref name="element"/> a shadow; <paramref name="radius"/> is its corner radius.</summary>
        public static T Attach<T>(T element, ShadowToken token, float radius) where T : VisualElement
        {
            var layer = new ShadowLayer(token, radius) { host = element };
            element.Insert(0, layer);
            element.RegisterCallback<GeometryChangedEvent>(_ => layer.Repaint());
            return element;
        }

        private void Repaint()
        {
            if (host == null) return;
            Rect box = host.layout;
            if (float.IsNaN(box.width) || float.IsNaN(box.height) || box.width < 1 || box.height < 1) return;
            var size = new Vector2(box.width, box.height);
            if (texture != null && paintedTheme == currentTheme &&
                Mathf.Abs(size.x - paintedSize.x) < ResizeTolerance && Mathf.Abs(size.y - paintedSize.y) < ResizeTolerance) return;

            BoxShadow[] shadows = token.For(currentTheme);
            float margin = 0;
            foreach (BoxShadow shadow in shadows) margin = Math.Max(margin, shadow.Reach);
            margin = Mathf.Ceil(margin);

            Release();
            texture = ShadowPainter.Paint(size.x, size.y, radius, margin, shadows);
            paintedSize = size;
            paintedTheme = currentTheme;

            // The host's border is part of its box, so the shadow starts outside it.
            float borderLeft = host.resolvedStyle.borderLeftWidth;
            float borderTop = host.resolvedStyle.borderTopWidth;
            style.left = -margin - borderLeft;
            style.top = -margin - borderTop;
            style.width = size.x + margin * 2;
            style.height = size.y + margin * 2;
            style.backgroundImage = new StyleBackground(texture);
        }

        private void Release()
        {
            if (texture == null) return;
            Object.Destroy(texture);
            texture = null;
        }
    }
}

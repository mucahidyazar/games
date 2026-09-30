using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>A card shown on top of the board (overlay/Panel.tsx); subclasses fill it and refresh it from the model.</summary>
    public abstract class Panel : VisualElement
    {
        protected Panel(bool isMenu = false)
        {
            AddToClassList("panel");
            AddToClassList("card");
            AddToClassList(isMenu ? "panel--menu" : "panel--default");
            ShadowLayer.Attach(this, ShadowToken.Lift, Controls.CardRadius);
        }

        public abstract OverlayKind Kind { get; }

        /// <summary>The start screen sits at the top of narrow boards so its action stays in view.</summary>
        public virtual bool IsTopAligned(OverlayModel model) => false;

        public abstract void Show(OverlayModel model);
    }

    /// <summary>The dimmed, blurred layer over the board that holds one panel at a time.</summary>
    public sealed class OverlayLayer : VisualElement
    {
        private Panel current;

        public OverlayLayer()
        {
            AddToClassList("overlay");
        }

        public OverlayKind Kind => current?.Kind ?? OverlayKind.None;

        /// <summary>Swaps in a new panel (with the rise animation) or hides the layer when null.</summary>
        public void Present(Panel next, OverlayModel model)
        {
            if (current != null) Remove(current);
            current = next;
            this.SetVisible(next != null);
            if (next == null) return;
            Add(next);
            Refresh(model);
            UiMotion.Rise(next);
        }

        public void Refresh(OverlayModel model)
        {
            if (current == null) return;
            EnableInClassList("overlay--top", current.IsTopAligned(model));
            current.Show(model);
        }
    }
}

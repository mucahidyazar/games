using System;
using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>
    /// A modal card over the whole app with a title, a close button and a scrolling body (components/ui/Dialog.tsx).
    /// Tapping the dimmed backdrop closes it.
    /// </summary>
    public sealed class Dialog : VisualElement
    {
        private readonly VisualElement card;
        private readonly Label title;
        private readonly ScrollView body;
        private Action onClose;

        public Dialog()
        {
            AddToClassList("dialog");
            RegisterCallback<PointerDownEvent>(evt =>
            {
                if (evt.target == this) Close();
            });

            title = Ui.Text(string.Empty, "dialog__title");
            body = new ScrollView(ScrollViewMode.Vertical) { horizontalScrollerVisibility = ScrollerVisibility.Hidden };
            body.AddToClassList("dialog__body");
            card = Ui.Div("dialog__card", "card").Children(
                Ui.Div("dialog__header").Children(title, Ui.Button(Close, "dialog__close").Children(Ui.Icon("close", "dialog__close-icon"))),
                body);
            ShadowLayer.Attach(card, ShadowToken.Lift, 16);
            Add(card);
            this.SetVisible(false);
        }

        public bool IsOpen => resolvedStyle.display != DisplayStyle.None && style.display != DisplayStyle.None;

        /// <summary>Shows <paramref name="content"/> under <paramref name="heading"/>; <paramref name="closed"/> runs when it closes.</summary>
        public void Open(string heading, VisualElement content, Action closed = null)
        {
            title.SetText(heading);
            body.Clear();
            body.Add(content);
            body.scrollOffset = UnityEngine.Vector2.zero;
            onClose = closed;
            this.SetVisible(true);
            UiMotion.Pop(card);
        }

        public void Close()
        {
            if (style.display == DisplayStyle.None) return;
            this.SetVisible(false);
            body.Clear();
            Action closed = onClose;
            onClose = null;
            closed?.Invoke();
        }
    }
}

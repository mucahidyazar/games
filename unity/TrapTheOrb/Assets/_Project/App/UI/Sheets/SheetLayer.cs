using System;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>What a bottom sheet shows. Sheets without a title draw their own heading.</summary>
    public abstract class SheetContent : VisualElement
    {
        /// <summary>The header's title; null hides the header.</summary>
        public virtual string Title => null;

        /// <summary>Whether a tap on the dimmed screen or the close button may dismiss the sheet.</summary>
        public virtual bool IsDismissible => true;

        public abstract void Show(OverlayModel model);
    }

    /// <summary>
    /// One bottom sheet at a time over a dimmed screen. It is as tall as its content, up to most of the screen, where
    /// long content scrolls. It slides up when it opens and down when it closes; swapping the content of an open
    /// sheet only cross-fades it.
    /// </summary>
    public sealed class SheetLayer : VisualElement
    {
        private readonly VisualElement scrim;
        private readonly VisualElement sheet;
        private readonly VisualElement header;
        private readonly Label title;
        private readonly Button close;
        private readonly VisualElement body;
        private SheetContent current;
        private Action dismiss;

        public SheetLayer()
        {
            AddToClassList("layer");
            AddToClassList("sheet-layer");

            scrim = Ui.Div("layer", "sheet-scrim");
            scrim.RegisterCallback<ClickEvent>(_ => Dismiss());
            title = Ui.Text(string.Empty, "sheet__title");
            close = Controls.IconButton("close", Dismiss, isBare: true).WithClass("sheet__close");
            header = Ui.Div("sheet__header").Children(title, close);
            body = Ui.Div("sheet__body");
            sheet = Ui.Div("sheet").Children(Ui.Div("sheet__handle"), header, body);

            Add(scrim);
            Add(sheet);
            this.SetVisible(false);
        }

        public SheetContent Current => current;

        /// <summary>Shows <paramref name="content"/>; <paramref name="onDismiss"/> runs when the player dismisses it.</summary>
        public void Present(SheetContent content, Action onDismiss)
        {
            dismiss = onDismiss;
            if (content == current) return;

            bool wasOpen = current != null;
            current = content;
            body.Clear();
            body.Add(content);
            title.SetText(content.Title ?? string.Empty);
            header.SetVisible(content.Title != null);
            close.SetVisible(content.IsDismissible);
            this.SetVisible(true);

            if (wasOpen)
            {
                UiMotion.Pop(body);
                return;
            }
            UiMotion.FadeIn(scrim);
            UiMotion.SlideUp(sheet);
        }

        public void Hide()
        {
            if (current == null) return;
            current = null;
            dismiss = null;
            UiMotion.FadeOut(scrim);
            UiMotion.SlideDown(sheet, () =>
            {
                if (current != null) return;
                this.SetVisible(false);
                body.Clear();
            });
        }

        /// <summary>Keeps the sheet's content clear of the home indicator.</summary>
        public void SetBottomInset(float inset) => sheet.style.paddingBottom = inset + 20;

        private void Dismiss()
        {
            if (current != null && current.IsDismissible) dismiss?.Invoke();
        }
    }

    /// <summary>A titled, scrolling sheet around a view, e.g. "How to play" or the high scores.</summary>
    public sealed class InfoSheet : SheetContent
    {
        private readonly string title;

        public InfoSheet(string title, VisualElement content)
        {
            this.title = title;
            AddToClassList("info-sheet");
            Add(Ui.Scroll("info-sheet__scroll").Children(content));
        }

        public override string Title => title;

        public override void Show(OverlayModel model)
        {
        }
    }
}

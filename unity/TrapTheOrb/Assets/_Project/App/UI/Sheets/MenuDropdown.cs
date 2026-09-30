using System;
using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>The header's menu: a sheet that drops below the top bar (SiteHeader.tsx mobile menu).</summary>
    public sealed class MenuDropdown : VisualElement
    {
        private readonly VisualElement sheet;
        private readonly Action onChanged;

        public MenuDropdown(Action onHowToPlay, Action onHighScores, Action onChanged)
        {
            this.onChanged = onChanged;
            AddToClassList("menu");
            // A tap outside the sheet closes the menu.
            RegisterCallback<PointerDownEvent>(evt =>
            {
                if (evt.target == this) SetOpen(false);
            });

            sheet = Ui.Div("menu__panel").Children(
                Item("How to play", "help", onHowToPlay),
                Item("High scores", "trophy", onHighScores));
            ShadowLayer.Attach(sheet, ShadowToken.Lift, 0);
            Add(sheet);
            this.SetVisible(false);
        }

        public bool IsOpen { get; private set; }

        public void SetOpen(bool open)
        {
            if (open == IsOpen) return;
            IsOpen = open;
            this.SetVisible(open);
            if (open) UiMotion.Pop(sheet);
            onChanged?.Invoke();
        }

        private Button Item(string label, string icon, Action onSelect) =>
            Ui.Button(() =>
            {
                SetOpen(false);
                onSelect?.Invoke();
            }, "menu__item").Children(Ui.Icon(icon, "menu__item-icon"), Ui.Text(label, "menu__item-label"));
    }
}

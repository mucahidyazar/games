using System;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>The app's header: the game's mark and name, sound, theme and the menu (SiteHeader.tsx).</summary>
    public sealed class TopBar : VisualElement
    {
        private readonly VisualElement soundIcon;
        private readonly VisualElement themeIcon;
        private readonly VisualElement menuIcon;

        public TopBar(Action onToggleSound, Action onToggleTheme, Action onToggleMenu)
        {
            AddToClassList("topbar");

            VisualElement brand = Ui.Div("topbar__brand").Children(
                Ui.Div("logo-tile").Children(Ui.Icon("logo", "logo-tile__image")),
                Ui.Div("brand-name").Children(
                    Ui.Text("Trap The ", "brand-name__text"),
                    Ui.Text("Orb", "brand-name__text", "brand-name__text--accent")));

            soundIcon = Ui.Icon("volume-on", "chrome-button__icon");
            themeIcon = Ui.Icon("sun", "chrome-button__icon", "chrome-button__icon--theme");
            menuIcon = Ui.Icon("menu", "chrome-button__icon", "chrome-button__icon--menu");

            VisualElement actions = Ui.Div("topbar__actions").Children(
                Ui.Button(onToggleSound, "chrome-button", "chrome-button--filled").Children(soundIcon),
                Ui.Button(onToggleTheme, "chrome-button").Children(themeIcon),
                Ui.Button(onToggleMenu, "chrome-button", "chrome-button--menu").Children(menuIcon));

            Add(brand);
            Add(actions);
        }

        public void Show(bool isSoundEnabled, Theme theme, bool isMenuOpen)
        {
            soundIcon.SetIcon(isSoundEnabled ? "volume-on" : "volume-off");
            // The toggle shows where it leads: a sun on the navy theme, a moon on the light one.
            themeIcon.SetIcon(theme == Theme.Navy ? "sun" : "moon");
            menuIcon.SetIcon(isMenuOpen ? "close" : "menu");
        }
    }
}

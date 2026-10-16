using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>Sound, vibration, motion and the theme, each one tap away.</summary>
    public sealed class SettingsSheet : SheetContent
    {
        private readonly SwitchRow sound;
        private readonly SwitchRow vibration;
        private readonly SwitchRow motion;
        private readonly Segmented<Theme> theme;
        private readonly VisualElement themeIcon;

        public SettingsSheet(OverlayActions actions)
        {
            AddToClassList("settings-sheet");
            sound = new SwitchRow("volume-on", "Sound", on => actions.SetSound?.Invoke(on));
            vibration = new SwitchRow("vibrate", "Vibration", on => actions.SetHaptics?.Invoke(on));
            motion = new SwitchRow("motion", "Reduce motion", on => actions.SetReducedMotion?.Invoke(on));
            theme = new Segmented<Theme>(value => actions.SetTheme?.Invoke(value), isCompact: true)
                .Option(Theme.Navy, "Navy")
                .Option(Theme.Light, "Light");
            theme.AddToClassList("settings-sheet__theme");
            themeIcon = Ui.Icon("moon", "row__icon");

            Add(Ui.Div("row-group").Children(
                sound,
                vibration,
                motion,
                Ui.Div("row").Children(themeIcon, Ui.Div("row__text").Children(Ui.Text("Theme", "row__title")), theme)));
            Add(Ui.Text($"Trap The Orb {Application.version}", "settings-sheet__version"));
        }

        public override string Title => "Settings";

        public override void Show(OverlayModel model)
        {
            sound.IsOn = model.Settings.SoundEnabled;
            vibration.IsOn = model.Settings.HapticsEnabled;
            motion.IsOn = model.Settings.ReducedMotion || model.IsSystemMotionReduced;
            motion.SetEnabled(!model.IsSystemMotionReduced);
            motion.SetDetail(model.IsSystemMotionReduced ? "On in your system settings" : null);
            theme.Select(model.Theme);
            themeIcon.SetIcon(model.Theme == Theme.Light ? "sun" : "moon");
        }
    }
}

using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>
    /// The pause menu: resume first, then what the mode allows (restart or leave a practice run, end a ranked one),
    /// and the sound and vibration switches. Dismissing it resumes.
    /// </summary>
    public sealed class PauseSheet : SheetContent
    {
        private readonly Label summary;
        private readonly Button restart;
        private readonly Button endRun;
        private readonly Button leave;
        private readonly SwitchRow sound;
        private readonly SwitchRow vibration;

        public PauseSheet(OverlayActions actions)
        {
            AddToClassList("pause-sheet");
            summary = Ui.Text(string.Empty, "sheet-subheading");
            restart = Controls.Secondary("Restart level", () => actions.RestartLevel?.Invoke(), "restart");
            endRun = Controls.Secondary("End run", () => actions.EndRun?.Invoke(), "flag");
            leave = Controls.Ghost("Save and leave", () => actions.LeaveRun?.Invoke(), "home");
            sound = new SwitchRow("volume-on", "Sound", on => actions.SetSound?.Invoke(on));
            vibration = new SwitchRow("vibrate", "Vibration", on => actions.SetHaptics?.Invoke(on));

            Add(Ui.Text("Paused", "sheet-heading"));
            Add(summary);
            Add(Ui.Div("sheet-actions").Children(
                Controls.Primary("Resume", () => actions.Resume?.Invoke(), "play"),
                restart,
                endRun,
                leave).Spaced(10));
            Add(Ui.Div("row-group", "sheet-section").Children(
                sound,
                vibration,
                Rows.Link("help", "How to play", () => actions.OpenSheet?.Invoke(SheetKind.HowToPlay))));
        }

        public override void Show(OverlayModel model)
        {
            HudSnapshot hud = model.Hud;
            bool isRanked = hud.RankedMode;
            summary.SetText($"{ModeContent.Info(hud.Mode).Name} · Level {hud.Level} · {Format.Number(hud.Score)} {Format.Plural(hud.Score, "point", "points")}");
            restart.SetVisible(!isRanked);
            leave.SetVisible(!isRanked);
            endRun.SetVisible(isRanked);
            sound.IsOn = model.Settings.SoundEnabled;
            vibration.IsOn = model.Settings.HapticsEnabled;
        }
    }

    /// <summary>Rows shared by the sheets.</summary>
    public static class Rows
    {
        /// <summary>A row that opens something: icon, label and a chevron.</summary>
        public static Button Link(string icon, string label, System.Action onClick) =>
            Ui.Button(onClick, "row").Children(
                Ui.Icon(icon, "row__icon"),
                Ui.Div("row__text").Children(Ui.Text(label, "row__title")),
                Ui.Icon("chevron-right", "row__chevron"));
    }
}

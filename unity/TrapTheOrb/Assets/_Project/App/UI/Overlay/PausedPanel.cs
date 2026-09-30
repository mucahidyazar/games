using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>"Paused — the orbs will wait for you." (PausedPanel.tsx).</summary>
    public sealed class PausedPanel : Panel
    {
        private readonly Button endRun;
        private readonly Button restart;
        private readonly Label rankedHint;
        private readonly VisualElement practiceHint;

        public PausedPanel(OverlayActions actions)
        {
            Add(Ui.Text("Paused", "panel__title"));
            Add(Ui.Text("The orbs will wait for you.", "panel__subtitle"));

            endRun = Controls.Action("End run", () => actions.EndRun?.Invoke(), "flag", isPrimary: false);
            restart = Controls.Action("Restart level", () => actions.RestartLevel?.Invoke(), "restart", isPrimary: false);
            Add(Ui.Div("panel__actions").Children(
                Controls.Action("Resume", () => actions.Resume?.Invoke(), "play"), endRun, restart));

            rankedHint = Ui.Text("Ending the run keeps the score you have so far. Pick another mode after that.", "panel__hint");
            practiceHint = Ui.Div("panel__practice").Children(
                Controls.TextButton("Change mode", () => actions.LeaveRun?.Invoke()),
                Ui.Text("You can continue this run later from its level.", "panel__hint", "panel__hint--tight"));
            Add(rankedHint);
            Add(practiceHint);
        }

        public override OverlayKind Kind => OverlayKind.Paused;

        public override void Show(OverlayModel model)
        {
            bool isRanked = model.Hud.RankedMode;
            endRun.SetVisible(isRanked);
            restart.SetVisible(!isRanked);
            rankedHint.SetVisible(isRanked);
            practiceHint.SetVisible(!isRanked);
        }
    }
}

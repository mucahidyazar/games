using System;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>"Level 3", the orbs of the level and the run's controls (GameHeader.tsx).</summary>
    public sealed class GameHeader : VisualElement
    {
        private readonly Label title;
        private readonly OrbLineup lineup = new OrbLineup(isSmall: true);
        private readonly Label summary;
        private readonly Button orientationButton;
        private readonly VisualElement orientationIcon;
        private readonly Button primaryButton;
        private readonly VisualElement primaryIcon;
        private readonly Label primaryLabel;
        private readonly Button endRunButton;
        private readonly Button restartButton;

        public GameHeader(Action onToggleOrientation, Action onPrimary, Action onEndRun, Action onRestart)
        {
            AddToClassList("game-header");

            title = Ui.Text("Level 1", "game-header__title");
            summary = Ui.Text(string.Empty, "game-header__summary");
            Add(Ui.Div("game-header__info").Children(
                title,
                Ui.Div("game-header__line").Children(lineup, summary)));

            orientationButton = Controls.Square("wall-vertical", onToggleOrientation, "square-button__icon", "square-button__icon--accent");
            orientationIcon = orientationButton.Q(className: "square-button__icon");

            primaryIcon = Ui.Icon("play", "action-button__icon");
            primaryLabel = Ui.Text("Play", "action-button__label");
            primaryButton = Ui.Button(onPrimary, "action-button", "action-button--primary", "game-header__primary")
                .Children(primaryIcon, primaryLabel);
            ShadowLayer.Attach(primaryButton, ShadowToken.Coral, Controls.ControlRadius);

            endRunButton = Controls.Square("flag", onEndRun, "square-button__icon", "square-button__icon--small");
            restartButton = Controls.Square("restart", onRestart, "square-button__icon", "square-button__icon--small");

            Add(Ui.Div("game-header__actions").Children(orientationButton, primaryButton, endRunButton, restartButton));
        }

        public void Show(HudSnapshot hud, PrimaryAction action, bool isBusy)
        {
            title.SetText($"Level {hud.Level}");
            lineup.Show(hud.OrbTiers);
            summary.SetText($"{hud.OrbCount} {Format.Plural(hud.OrbCount, "orb", "orbs")} · clear at {hud.TargetPercent}%");

            orientationIcon.SetIcon(hud.Orientation == Orientation.Vertical ? "wall-vertical" : "wall-horizontal");

            primaryIcon.SetIcon(action switch
            {
                PrimaryAction.Pause => "pause",
                PrimaryAction.Next => "arrow-right",
                _ => "play",
            });
            primaryLabel.SetText(PrimaryActions.Label(action));
            primaryButton.SetEnabled(hud.Status != HudStatus.Loading && !isBusy);

            bool isRunActive = hud.InRun && (hud.Status == HudStatus.Playing || hud.Status == HudStatus.Paused);
            endRunButton.SetVisible(hud.RankedMode);
            restartButton.SetVisible(!hud.RankedMode);
            endRunButton.SetEnabled(isRunActive);
            restartButton.SetEnabled(isRunActive);
        }
    }
}

using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// The start screen: the field's live preview behind the title, the chosen mode and one big play button in
    /// the thumb zone. High scores and settings sit in the top corner.
    /// </summary>
    public sealed class HomeView : VisualElement
    {
        private readonly VisualElement top;
        private readonly VisualElement dock;
        private readonly VisualElement fade;
        private readonly VisualElement modeTile;
        private readonly VisualElement modeIcon;
        private readonly Label modeName;
        private readonly Label modeDetail;
        private readonly Button primary;
        private readonly Button newGame;
        private readonly OverlayActions actions;
        private Texture2D fadeTexture;
        private string shownTile;
        private SavedRun continuing;

        public HomeView(OverlayActions actions)
        {
            this.actions = actions;
            AddToClassList("layer");
            AddToClassList("home");

            BoardSlot = Ui.Div("layer", "home__board-slot");
            BoardSlot.pickingMode = PickingMode.Ignore;
            fade = Ui.Div("layer", "home__fade");
            fade.pickingMode = PickingMode.Ignore;

            top = Ui.Div("home__top").Children(
                Controls.IconButton("trophy", () => actions.OpenSheet?.Invoke(SheetKind.HighScores)),
                Controls.IconButton("settings", () => actions.OpenSheet?.Invoke(SheetKind.Settings)));

            VisualElement hero = Ui.Div("home__hero").Children(
                Ui.Icon("logo", "home__logo"),
                Ui.Div("wordmark").Children(Ui.Text("Trap The", "wordmark__text"), Ui.Text("Orb", "wordmark__text", "wordmark__text--accent")),
                Ui.Text("Build walls, trap the orbs and claim 75% of the field.", "home__pitch"));
            hero.pickingMode = PickingMode.Ignore;

            modeIcon = Ui.Icon("mode-classic");
            modeTile = Ui.Div("tile").Children(modeIcon);
            modeName = Ui.Text(string.Empty, "mode-card__name");
            modeDetail = Ui.Text(string.Empty, "mode-card__detail");
            Button modeCard = Ui.Button(() => actions.OpenSheet?.Invoke(SheetKind.Modes), "mode-card").Children(
                modeTile,
                Ui.Div("mode-card__text").Children(modeName, modeDetail),
                Ui.Div("mode-card__change").Children(Ui.Text("Change", "mode-card__change-label"), Ui.Icon("chevron-right", "icon--sm", "mode-card__chevron")));

            primary = Controls.Primary("Play", OnPrimary, "play");
            newGame = Controls.Secondary("New game", () => actions.Start?.Invoke(), "restart");
            dock = Ui.Div("home__dock").Children(
                modeCard,
                primary,
                newGame,
                Controls.Ghost("How to play", () => actions.OpenSheet?.Invoke(SheetKind.HowToPlay), "help")).Spaced(12);

            Add(BoardSlot);
            Add(fade);
            Add(top);
            Add(hero);
            Add(dock);
            RegisterCallback<DetachFromPanelEvent>(_ => ReleaseFade());
        }

        /// <summary>Where the screen puts the field, which plays its preview behind the title.</summary>
        public VisualElement BoardSlot { get; }

        public void SetInsets(float left, float top, float right, float bottom)
        {
            this.top.style.top = top + 6;
            this.top.style.right = right + 16;
            dock.style.left = left + 16;
            dock.style.right = right + 16;
            dock.style.bottom = bottom + 16;
        }

        /// <summary>Repaints the scrim that lets the title and the dock read over the field.</summary>
        public void SetPageColor(Color page)
        {
            ReleaseFade();
            fadeTexture = GradientTexture.Vertical(
                (0f, WithAlpha(page, 0.6f)),
                (0.22f, WithAlpha(page, 0.2f)),
                (0.42f, WithAlpha(page, 0.35f)),
                (0.58f, WithAlpha(page, 0.88f)),
                (0.68f, page),
                (1f, page));
            fade.style.backgroundImage = new StyleBackground(fadeTexture);
        }

        public void Show(OverlayModel model)
        {
            GameMode mode = model.Hud.Mode;
            ModeInfo info = ModeContent.Info(mode);
            string tile = "tile--" + mode.Id();
            if (tile != shownTile)
            {
                if (shownTile != null) modeTile.RemoveFromClassList(shownTile);
                modeTile.AddToClassList(tile);
                shownTile = tile;
                modeIcon.SetIcon(ModeContent.IconName(mode));
            }
            modeName.SetText(info.Name);
            modeDetail.SetText(Detail(mode, info, model));

            continuing = model.MatchingSave;
            primary.SetLabel(continuing != null ? $"Continue · level {continuing.Level}" : "Play");
            newGame.SetVisible(continuing != null);
        }

        private void OnPrimary()
        {
            if (continuing != null) actions.ContinueSaved?.Invoke(continuing);
            else actions.Start?.Invoke();
        }

        /// <summary>The best run in a ranked mode, the Custom setup, or the mode's tagline.</summary>
        private static string Detail(GameMode mode, ModeInfo info, OverlayModel model)
        {
            if (mode == GameMode.Custom) return Format.BreakAtSeparators(CustomSummary(model.Settings.Custom));
            if (!Modes.IsRanked(mode)) return info.Tagline;
            IReadOnlyList<HighScore> scores = HighScores.For(model.Player.HighScores, mode);
            return scores.Count == 0
                ? info.Tagline
                : Format.BreakAtSeparators($"Best {Format.Number(scores[0].Score)} · level {scores[0].Level}");
        }

        public static string CustomSummary(CustomSettings custom)
        {
            if (custom == null) return ModeContent.Info(GameMode.Custom).Tagline;
            string lives = custom.Lives == null ? "∞ lives" : $"{custom.Lives} {Format.Plural(custom.Lives.Value, "life", "lives")}";
            return $"{custom.OrbCount} {Format.Plural(custom.OrbCount, "orb", "orbs")} · {Format.OneDecimal(custom.Speed)}× speed · {lives}";
        }

        private static Color WithAlpha(Color color, float alpha) => new Color(color.r, color.g, color.b, alpha);

        private void ReleaseFade()
        {
            if (fadeTexture == null) return;
            Object.Destroy(fadeTexture);
            fadeTexture = null;
        }
    }
}

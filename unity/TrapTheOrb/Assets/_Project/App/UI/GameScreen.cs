using System;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.App.UI.Screens;
using TrapTheOrb.App.UI.Sheets;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI
{
    /// <summary>Platform services the screen needs but does not own.</summary>
    public sealed class ScreenServices
    {
        public GameController Controller { get; init; }
        public RunFlow Flow { get; init; }
        public PlayerStore Store { get; init; }
        public ThemeStore Themes { get; init; }
        public BoardRenderer Renderer { get; init; }

        /// <summary>Opens the platform share sheet with a message.</summary>
        public Action<string> Share { get; init; }

        /// <summary>Monotonic app clock in milliseconds.</summary>
        public Func<double> Clock { get; init; }

        /// <summary>Wall-clock time in Unix milliseconds, for saved scores.</summary>
        public Func<double> Now { get; init; }
    }

    /// <summary>
    /// The whole game screen (GameScreen.tsx): top bar, level header, HUD, the board with its panels, the menu and
    /// dialogs. It wires the controller, the run flow and the player's stored data to the elements.
    /// </summary>
    public sealed partial class GameScreen : VisualElement
    {
        /// <summary>Boards narrower than this show the start menu folded, at the top (the web's 560px container query).</summary>
        private const float NarrowBoard = 560;

        /// <summary>From this width on, the HUD shows icons and exact numbers (the web's sm: breakpoint).</summary>
        private const float WideScreen = 640;

        private readonly ScreenServices services;
        private readonly GameController controller;
        private readonly RunFlow flow;
        private readonly PlayerStore store;
        private readonly TopBar topBar;
        private readonly GameHeader header;
        private readonly HudBar hudBar;
        private readonly VisualElement boardCard;
        private readonly BoardView board;
        private readonly OverlayLayer overlay = new OverlayLayer();
        private readonly MenuDropdown menu;
        private readonly Dialog dialog = new Dialog();
        private readonly OverlayActions actions;
        private readonly VisualElement safeArea;

        public GameScreen(ScreenServices services)
        {
            this.services = services ?? throw new ArgumentNullException(nameof(services));
            controller = services.Controller;
            flow = services.Flow;
            store = services.Store;
            AddToClassList("app");
            actions = CreateActions();

            topBar = new TopBar(ToggleSound, ToggleTheme, () => menu.SetOpen(!menu.IsOpen));
            header = new GameHeader(() => controller.ToggleOrientation(), RunPrimaryAction, EndRunFromHeader, () => controller.RestartLevel());
            hudBar = new HudBar();
            board = new BoardView(controller, services.Renderer);
            board.OverlayHost.Add(overlay);
            boardCard = Controls.Card("board-card").Children(board);
            VisualElement boardArea = Ui.Div("board-area").Children(boardCard);
            boardArea.RegisterCallback<GeometryChangedEvent>(_ => FitBoard(boardArea));

            menu = new MenuDropdown(OpenHowToPlay, OpenHighScores, Refresh);
            safeArea = Ui.Div("app__safe").Children(
                topBar,
                Ui.Div("game").Children(header, hudBar, boardArea),
                menu);
            Add(safeArea);
            Add(dialog);

            controller.HudChanged += Refresh;
            controller.GameEvents += SaveCasualRuns;
            flow.Changed += Refresh;
            store.Changed += OnStoreChanged;
            RegisterCallback<GeometryChangedEvent>(_ => Refresh());

            controller.SetMode(store.Snapshot.Settings.LastMode, CustomFor(store.Snapshot.Settings.LastMode));
            ApplyTheme(services.Themes.Load());
            Refresh();
        }

        /// <summary>One frame: advance the game and redraw the board.</summary>
        public void Tick()
        {
            double now = services.Clock();
            controller.Advance(now);
            board.Render(now);
        }

        /// <summary>Keeps content clear of notches and home indicators (insets in UI units).</summary>
        public void SetSafeArea(float left, float top, float right, float bottom)
        {
            safeArea.style.paddingLeft = left;
            safeArea.style.paddingTop = top;
            safeArea.style.paddingRight = right;
            safeArea.style.paddingBottom = bottom;
        }

        /// <summary>The app went to the background: pause a running level and forget the frame clock.</summary>
        public void OnBackground()
        {
            board.CancelGesture();
            controller.Pause();
            controller.ResetClock();
        }

        public void Dispose()
        {
            controller.HudChanged -= Refresh;
            controller.GameEvents -= SaveCasualRuns;
            flow.Changed -= Refresh;
            store.Changed -= OnStoreChanged;
        }

        private void OnStoreChanged()
        {
            // Custom settings drive the preview behind the start screen.
            if (controller.Mode == Engine.GameMode.Custom && !controller.IsRunActive)
            {
                controller.SetMode(Engine.GameMode.Custom, store.Snapshot.Settings.Custom);
            }
            Refresh();
        }

        /// <summary>Sizes the board card to the field's shape inside the space left for it, centred.</summary>
        private void FitBoard(VisualElement area)
        {
            float width = area.contentRect.width;
            float height = area.contentRect.height;
            if (width < 1 || height < 1) return;

            // The card adds a 1px border and 4px padding around the field on each side.
            const float frame = 10;
            float aspect = height > width ? 0.5f : 2f;
            float innerWidth = Mathf.Max(1, width - frame);
            float innerHeight = Mathf.Max(1, height - frame);
            if (innerWidth / innerHeight > aspect) innerWidth = innerHeight * aspect;
            else innerHeight = innerWidth / aspect;

            float cardWidth = Mathf.Floor(innerWidth + frame);
            float cardHeight = Mathf.Floor(innerHeight + frame);
            if (Mathf.Abs(boardCard.resolvedStyle.width - cardWidth) < 0.5f && Mathf.Abs(boardCard.resolvedStyle.height - cardHeight) < 0.5f) return;
            boardCard.style.width = cardWidth;
            boardCard.style.height = cardHeight;
        }

        private void Refresh()
        {
            HudSnapshot hud = controller.Hud;
            PlayerSnapshot player = store.Snapshot;
            SavedRun matchingSave = player.SavedRun?.Mode == hud.Mode ? player.SavedRun : null;
            PrimaryAction action = PrimaryActions.For(hud, flow.Result != null, matchingSave != null);
            bool isWide = contentRect.width >= WideScreen;

            topBar.Show(player.Settings.SoundEnabled, services.Themes.Current, menu.IsOpen);
            header.Show(hud, action, isBusy: false);
            hudBar.Show(hud, isWide);

            var model = new OverlayModel(hud, flow.Result, player.SavedRun, player.Settings, player.HighScores, controller.Custom,
                IsNarrow: board.contentRect.width < NarrowBoard);
            OverlayKind kind = OverlayKinds.For(hud, flow.Result != null);
            if (kind != overlay.Kind) overlay.Present(CreatePanel(kind), model);
            else overlay.Refresh(model);
            board.SetBlurred(kind != OverlayKind.None);
        }

        private Panel CreatePanel(OverlayKind kind) => kind switch
        {
            OverlayKind.Ready => new ReadyPanel(actions),
            OverlayKind.Paused => new PausedPanel(actions),
            OverlayKind.LevelComplete => new LevelCompletePanel(actions),
            OverlayKind.Result => new ResultPanel(actions, OpenHighScores),
            _ => null,
        };

        private void ApplyTheme(Theme theme)
        {
            EnableInClassList("theme-navy", theme == Theme.Navy);
            EnableInClassList("theme-light", theme == Theme.Light);
            ShadowLayer.Theme = theme;
            board.SetPalette(BoardPalette.For(theme));
        }
    }
}

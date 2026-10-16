using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.App.UI.Screens;
using TrapTheOrb.App.UI.Sheets;
using TrapTheOrb.Engine;
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

        /// <summary>Back on the home screen: hands the app over to the system (Android).</summary>
        public Action LeaveApp { get; init; }
    }

    /// <summary>
    /// The whole app: the home screen, the playing screen and the end of a run, with the sheets that slide over
    /// them. One field is shared by all of them: it plays the preview behind the home screen and the game itself.
    /// </summary>
    public sealed partial class GameScreen : VisualElement
    {
        /// <summary>The field card's border, both sides together.</summary>
        private const float BoardFrame = 3;

        /// <summary>Behind the home screen the field covers the screen, its frame this far past the edges.</summary>
        private const float BackdropBleed = 14;

        private static readonly Color NavyPage = new Color32(0x0b, 0x16, 0x30, 255);
        private static readonly Color LightPage = new Color32(0xf4, 0xf7, 0xfb, 255);

        private readonly ScreenServices services;
        private readonly GameController controller;
        private readonly RunFlow flow;
        private readonly PlayerStore store;
        private readonly OverlayActions actions;
        private readonly BoardView board;
        private readonly VisualElement boardCard;
        private readonly VisualElement playView;
        private readonly VisualElement playInner;
        private readonly VisualElement playBoardSlot;
        private readonly GameHud hud;
        private readonly Segmented<Orientation> direction;
        private readonly HomeView home;
        private readonly RunOverView runOver;
        private readonly SheetLayer sheets = new SheetLayer();
        private readonly Dictionary<SheetKind, SheetContent> sheetContents = new Dictionary<SheetKind, SheetContent>();
        private SheetKind openedSheet = SheetKind.None;
        private ScreenKind? screen;
        private bool isSystemMotionReduced;

        public GameScreen(ScreenServices services)
        {
            this.services = services ?? throw new ArgumentNullException(nameof(services));
            controller = services.Controller;
            flow = services.Flow;
            store = services.Store;
            AddToClassList("app");
            actions = CreateActions();

            board = new BoardView(controller, services.Renderer);
            boardCard = Ui.Div("board-card").Children(board);

            hud = new GameHud(() => controller.Pause());
            direction = new Segmented<Orientation>(value => controller.SetOrientation(value))
                .Option(Orientation.Vertical, "Vertical", "wall-vertical")
                .Option(Orientation.Horizontal, "Horizontal", "wall-horizontal");
            direction.AddToClassList("direction");
            playBoardSlot = Ui.Div("play__board-slot");
            playInner = Ui.Div("play__inner").Children(hud, playBoardSlot, direction);
            playView = Ui.Div("layer", "play").Children(playInner);

            home = new HomeView(actions);
            runOver = new RunOverView(actions);
            playBoardSlot.RegisterCallback<GeometryChangedEvent>(_ => FitBoard());
            home.BoardSlot.RegisterCallback<GeometryChangedEvent>(_ => FitBoard());

            sheetContents[SheetKind.Pause] = new PauseSheet(actions);
            sheetContents[SheetKind.LevelCleared] = new LevelSheet(actions);
            sheetContents[SheetKind.Modes] = new ModeSheet(actions);
            sheetContents[SheetKind.CustomSetup] = new CustomSheet(actions);
            sheetContents[SheetKind.Settings] = new SettingsSheet(actions);
            sheetContents[SheetKind.HowToPlay] = new InfoSheet("How to play", new HowToPlayView());

            Add(playView);
            Add(home);
            Add(runOver);
            Add(sheets);

            controller.HudChanged += Refresh;
            controller.GameEvents += SaveCasualRuns;
            flow.Changed += Refresh;
            store.Changed += OnStoreChanged;

            ApplyMotion();
            controller.SetMode(store.Snapshot.Settings.LastMode, CustomFor(store.Snapshot.Settings.LastMode));
            ApplyTheme(services.Themes.Load());
            Refresh();
        }

        /// <summary>The sheet the player opened, if any (the game's own sheets are not counted).</summary>
        public SheetKind OpenedSheet => openedSheet;

        /// <summary>One frame: advance the game and redraw the field.</summary>
        public void Tick()
        {
            double now = services.Clock();
            controller.Advance(now);
            board.Render(now);
        }

        /// <summary>Keeps content clear of notches and home indicators (insets in UI units).</summary>
        public void SetSafeArea(float left, float top, float right, float bottom)
        {
            home.SetInsets(left, top, right, bottom);
            runOver.SetInsets(left, top, right, bottom);
            playInner.style.paddingLeft = left + 16;
            playInner.style.paddingRight = right + 16;
            playInner.style.paddingTop = top + 6;
            playInner.style.paddingBottom = bottom + 12;
            sheets.SetBottomInset(bottom);
        }

        /// <summary>The app went to the background: pause a running level and forget the frame clock.</summary>
        public void OnBackground()
        {
            board.CancelGesture();
            controller.Pause();
            controller.ResetClock();
        }

        /// <summary>The system back gesture; returns false when there is nothing to go back from.</summary>
        public bool GoBack()
        {
            switch (ScreenRoutes.BackFor(controller.Hud, flow.Result != null, openedSheet))
            {
                case BackAction.CloseSheet:
                    CloseSheet();
                    return true;
                case BackAction.Pause:
                    controller.Pause();
                    return true;
                case BackAction.Resume:
                    controller.Resume();
                    return true;
                case BackAction.GoHome:
                    GoHome();
                    return true;
                case BackAction.LeaveApp:
                    services.LeaveApp?.Invoke();
                    return true;
                default:
                    return false;
            }
        }

        /// <summary>Opens a sheet over the current screen; help, scores and settings pause a running level.</summary>
        public void OpenSheet(SheetKind kind)
        {
            if (kind == SheetKind.None || kind == SheetKind.Pause || kind == SheetKind.LevelCleared)
            {
                CloseSheet();
                return;
            }
            // The scores sheet opens on the mode being played.
            if (kind == SheetKind.HighScores) sheetContents[kind] = new InfoSheet("High scores", new HighScoresView(store, services.Now, controller.Mode));
            openedSheet = kind;
            if (ScreenRoutes.PausesTheGame(kind)) controller.Pause();
            Refresh();
        }

        public void CloseSheet()
        {
            if (openedSheet == SheetKind.None) return;
            openedSheet = SheetKind.None;
            Refresh();
        }

        public void SetTheme(Theme theme)
        {
            services.Themes.Save(theme);
            ApplyTheme(theme);
            Refresh();
        }

        public void Dispose()
        {
            controller.HudChanged -= Refresh;
            controller.GameEvents -= SaveCasualRuns;
            flow.Changed -= Refresh;
            store.Changed -= OnStoreChanged;
            UiMotion.StopAll();
        }

        /// <summary>
        /// The system's reduce-motion preference (iOS Reduce Motion, Android "Remove animations"). It reduces
        /// motion whatever the in-game setting says.
        /// </summary>
        public void SetSystemReducedMotion(bool isReduced)
        {
            if (isSystemMotionReduced == isReduced) return;
            isSystemMotionReduced = isReduced;
            ApplyMotion();
            Refresh();
        }

        /// <summary>Reduced motion turns scripted transitions and the styles' own transitions into jumps.</summary>
        private void ApplyMotion()
        {
            bool isReduced = isSystemMotionReduced || store.Snapshot.Settings.ReducedMotion;
            UiMotion.IsReduced = isReduced;
            EnableInClassList("app--reduced-motion", isReduced);
        }

        private void OnStoreChanged()
        {
            ApplyMotion();
            // Custom settings drive the preview behind the home screen. A finished run stays on the field (and in
            // the HUD state the run-over screen reads) until the player leaves it.
            if (controller.Mode == GameMode.Custom && !controller.Hud.InRun)
            {
                controller.SetMode(GameMode.Custom, store.Snapshot.Settings.Custom);
            }
            Refresh();
        }

        private void Refresh()
        {
            HudSnapshot snapshot = controller.Hud;
            bool hasResult = flow.Result != null;
            ScreenKind next = ScreenRoutes.ScreenFor(snapshot, hasResult);
            if (next != screen) ShowScreen(next);

            var model = new OverlayModel(snapshot, flow.Result, store.Snapshot, controller.Custom, services.Themes.Current)
            {
                IsSystemMotionReduced = isSystemMotionReduced,
            };
            if (next == ScreenKind.Home) home.Show(model);
            else
            {
                hud.Show(snapshot);
                direction.Select(controller.Orientation);
                if (next == ScreenKind.RunOver) runOver.Show(model);
            }
            ShowSheet(model, hasResult);
        }

        private void ShowScreen(ScreenKind next)
        {
            bool isFirst = screen == null;
            screen = next;
            home.SetVisible(next == ScreenKind.Home);
            playView.SetVisible(next != ScreenKind.Home);
            runOver.SetVisible(next == ScreenKind.RunOver);

            VisualElement slot = next == ScreenKind.Home ? home.BoardSlot : playBoardSlot;
            if (boardCard.parent != slot) slot.Add(boardCard);
            boardCard.EnableInClassList("board-card--backdrop", next == ScreenKind.Home);
            FitBoard();

            // A sheet the player opened belongs to the screen it was opened on.
            openedSheet = SheetKind.None;
            if (!isFirst && next == ScreenKind.RunOver) UiMotion.Rise(runOver);
        }

        private void ShowSheet(OverlayModel model, bool hasResult)
        {
            SheetKind fromState = ScreenRoutes.StateSheetFor(model.Hud, hasResult);
            SheetKind visible = ScreenRoutes.Visible(openedSheet, fromState);
            if (visible == SheetKind.None || !sheetContents.TryGetValue(visible, out SheetContent content))
            {
                sheets.Hide();
                return;
            }
            content.Show(model);
            sheets.Present(content, () => OnSheetDismissed(visible));
        }

        private void OnSheetDismissed(SheetKind kind)
        {
            if (kind == openedSheet)
            {
                CloseSheet();
                return;
            }
            if (kind == SheetKind.Pause) controller.Resume();
        }

        /// <summary>Sizes the field card to the field's shape inside its slot; the slot centres it.</summary>
        private void FitBoard()
        {
            VisualElement slot = boardCard.parent;
            if (slot == null) return;
            float width = slot.contentRect.width;
            float height = slot.contentRect.height;
            if (float.IsNaN(width) || float.IsNaN(height) || width < 1 || height < 1) return;

            float cardWidth;
            float cardHeight;
            if (screen == ScreenKind.Home)
            {
                // Cover the screen with the portrait field; the slot centres the overflow.
                cardWidth = Mathf.Ceil(Mathf.Max(width + BackdropBleed * 2, (height + BackdropBleed * 2) / 2));
                cardHeight = cardWidth * 2;
            }
            else
            {
                float aspect = height > width ? 0.5f : 2f;
                float innerWidth = Mathf.Max(1, width - BoardFrame);
                float innerHeight = Mathf.Max(1, height - BoardFrame);
                if (innerWidth / innerHeight > aspect) innerWidth = innerHeight * aspect;
                else innerHeight = innerWidth / aspect;
                cardWidth = Mathf.Floor(innerWidth + BoardFrame);
                cardHeight = Mathf.Floor(innerHeight + BoardFrame);
            }
            if (Mathf.Abs(boardCard.resolvedStyle.width - cardWidth) < 0.5f && Mathf.Abs(boardCard.resolvedStyle.height - cardHeight) < 0.5f) return;
            boardCard.style.width = cardWidth;
            boardCard.style.height = cardHeight;
        }

        private void ApplyTheme(Theme theme)
        {
            EnableInClassList("theme-navy", theme == Theme.Navy);
            EnableInClassList("theme-light", theme == Theme.Light);
            board.SetPalette(BoardPalette.For(theme));
            home.SetPageColor(theme == Theme.Light ? LightPage : NavyPage);
        }
    }
}

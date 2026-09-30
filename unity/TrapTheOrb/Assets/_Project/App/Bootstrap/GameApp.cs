using System;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Platform;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.UIElements;
using Rect = UnityEngine.Rect;

namespace TrapTheOrb.App.Bootstrap
{
    /// <summary>Starts the game: services, the screen and the per-frame loop. Lives on the scene's UI document.</summary>
    [RequireComponent(typeof(UIDocument))]
    public sealed class GameApp : MonoBehaviour
    {
        private const int MinFrameRate = 60;
        private const int MaxFrameRate = 120;

        [SerializeField] private AppAssets assets;

        private UIDocument document;
        private PanelSettings panelSettings;
        private GameScreen screen;
        private GameController controller;
        private RunFlow flow;
        private BoardRenderer boardRenderer;
        private AudioSource audioSource;
        private PlayerStore store;
        private SoundPlayer sound;
        private Rect appliedSafeArea;
        private Vector2Int appliedScreen;

        private void Awake()
        {
            double refresh = Screen.currentResolution.refreshRateRatio.value;
            Application.targetFrameRate = Mathf.Clamp((int)Math.Round(double.IsNaN(refresh) ? MinFrameRate : refresh), MinFrameRate, MaxFrameRate);
            QualitySettings.vSyncCount = 0;
        }

        private void OnEnable()
        {
            if (assets == null)
            {
                Debug.LogError("GameApp needs its AppAssets; run Trap The Orb > Set Up Project in the editor.");
                enabled = false;
                return;
            }

            document = GetComponent<UIDocument>();
            // A runtime copy, so the scale set below never changes the asset in the editor.
            panelSettings = Instantiate(document.panelSettings);
            panelSettings.scaleMode = PanelScaleMode.ConstantPixelSize;
            panelSettings.scale = DisplayMetrics.Scale();
            document.panelSettings = panelSettings;

            VisualElement root = document.rootVisualElement;
            foreach (StyleSheet sheet in assets.StyleSheets) root.styleSheets.Add(sheet);

            var storage = new PlayerPrefsStore();
            store = new PlayerStore(storage, () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();
            sound = new SoundPlayer(audioSource, assets.Sounds()) { IsEnabled = store.Snapshot.Settings.SoundEnabled };
            store.Changed += SyncSound;

            controller = new GameController(sound, Rng.RandomSeed());
            flow = new RunFlow(controller, () => DateTime.UtcNow);
            boardRenderer = new BoardRenderer(assets.OrbTextures);
            screen = new GameScreen(new ScreenServices
            {
                Controller = controller,
                Flow = flow,
                Store = store,
                Themes = new ThemeStore(storage),
                Renderer = boardRenderer,
                Share = NativeShare.Share,
                Clock = () => Time.realtimeSinceStartupAsDouble * 1000,
                Now = () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            });
            root.Add(screen);
            screen.StretchToParentSize();
            ApplySafeArea(force: true);
        }

        private void OnDisable()
        {
            if (store != null) store.Changed -= SyncSound;
            screen?.Dispose();
            screen?.RemoveFromHierarchy();
            screen = null;
            flow?.Dispose();
            boardRenderer?.Dispose();
            if (panelSettings != null) Destroy(panelSettings);
        }

        private void Update()
        {
            if (screen == null) return;
            ApplySafeArea(force: false);
            screen.Tick();
            // Keep the screen on while a level is being played; let it sleep on menus.
            Screen.sleepTimeout = controller.State?.Status == GameStatus.Playing ? SleepTimeout.NeverSleep : SleepTimeout.SystemSetting;
        }

        private void SyncSound() => sound.IsEnabled = store.Snapshot.Settings.SoundEnabled;

        private void OnApplicationPause(bool isPaused)
        {
            if (isPaused) screen?.OnBackground();
        }

        private void ApplySafeArea(bool force)
        {
            Rect safe = Screen.safeArea;
            var size = new Vector2Int(Screen.width, Screen.height);
            if (!force && safe == appliedSafeArea && size == appliedScreen) return;
            appliedSafeArea = safe;
            appliedScreen = size;

            float scale = Mathf.Max(0.01f, panelSettings.scale);
            // Screen coordinates start at the bottom left.
            screen.SetSafeArea(
                safe.xMin / scale,
                (size.y - safe.yMax) / scale,
                (size.x - safe.xMax) / scale,
                safe.yMin / scale);
        }
    }
}

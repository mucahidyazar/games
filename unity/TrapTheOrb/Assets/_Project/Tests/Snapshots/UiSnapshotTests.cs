using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using TrapTheOrb.App.Bootstrap;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;
using Object = UnityEngine.Object;
using Rect = UnityEngine.Rect;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace TrapTheOrb.UiSnapshots
{
    /// <summary>
    /// Renders the game's screens at phone resolutions and saves them as PNG files, so the UI can be reviewed
    /// without a device build. Run in batch mode:
    /// Unity -batchmode -projectPath unity/TrapTheOrb -runTests -testPlatform PlayMode -testCategory Snapshots
    /// The files go to $TTO_SNAPSHOT_DIR, or Temp/UiSnapshots in the project.
    /// </summary>
    public sealed class UiSnapshotTests
    {
        private const string AppAssetsPath = "Assets/_Project/AppAssets.asset";
        private const string PanelSettingsPath = "Assets/_Project/UI/PanelSettings.asset";
        private const double FrameMs = 1000.0 / 60;

        /// <summary>A phone: its screen in pixels, pixels per UI point and the safe-area insets in points.</summary>
        private sealed class Device
        {
            public Device(string name, int width, int height, float scale, float safeTop, float safeBottom)
            {
                Name = name;
                Width = width;
                Height = height;
                Scale = scale;
                SafeTop = safeTop;
                SafeBottom = safeBottom;
            }

            public string Name { get; }
            public int Width { get; }
            public int Height { get; }
            public float Scale { get; }
            public float SafeTop { get; }
            public float SafeBottom { get; }
        }

        private static readonly Device[] Devices =
        {
            new Device("iphone-18-pro", 1206, 2622, 3f, 62, 34),
            new Device("pixel-8", 1080, 2400, 2.625f, 28, 20),
            new Device("iphone-se", 750, 1334, 2f, 20, 0),
            // The narrowest common Android width: Galaxy S2x phones at their default display size.
            new Device("galaxy-s23", 1080, 2340, 3f, 32, 16),
        };

        [UnityTest]
        [Category("Snapshots")]
        public IEnumerator CapturesTheScreens()
        {
            string folder = Environment.GetEnvironmentVariable("TTO_SNAPSHOT_DIR");
            if (string.IsNullOrEmpty(folder)) folder = Path.Combine(Application.dataPath, "..", "Temp", "UiSnapshots");
            Directory.CreateDirectory(folder);

            foreach (Device device in Devices)
            {
                var session = new Session(device, folder);
                try
                {
                    yield return session.Run();
                }
                finally
                {
                    session.Dispose();
                }
            }
        }

        /// <summary>One device: the app's screen in an off-screen panel, driven through its states.</summary>
        private sealed class Session : IDisposable
        {
            private readonly Device device;
            private readonly string folder;
            private readonly RenderTexture target;
            private readonly PanelSettings panel;
            private readonly GameObject host;
            private readonly GameController controller;
            private readonly RunFlow flow;
            private readonly PlayerStore store;
            private readonly BoardRenderer renderer;
            private readonly GameScreen screen;
            private double clock = 1000;

            public Session(Device device, string folder)
            {
                this.device = device;
                this.folder = folder;
#if UNITY_EDITOR
                AppAssets assets = AssetDatabase.LoadAssetAtPath<AppAssets>(AppAssetsPath);
                PanelSettings template = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelSettingsPath);
#else
                AppAssets assets = null;
                PanelSettings template = null;
#endif
                Assert.That(assets, Is.Not.Null, "AppAssets missing; run Trap The Orb > Set Up Project.");
                Assert.That(template, Is.Not.Null, "PanelSettings missing; run Trap The Orb > Set Up Project.");

                target = new RenderTexture(device.Width, device.Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
                target.Create();
                panel = Object.Instantiate(template);
                panel.targetTexture = target;
                panel.scaleMode = PanelScaleMode.ConstantPixelSize;
                panel.scale = device.Scale;
                panel.clearColor = true;
                panel.colorClearValue = new Color32(0x0b, 0x16, 0x30, 255);

                host = new GameObject("UiSnapshot");
                var document = host.AddComponent<UIDocument>();
                document.panelSettings = panel;
                VisualElement root = document.rootVisualElement;
                foreach (StyleSheet sheet in assets.StyleSheets) root.styleSheets.Add(sheet);

                var storage = new MemoryStore();
                store = new PlayerStore(storage, () => 1_760_000_000_000);
                controller = new GameController(new SilentFeedback(), 7, new System.Random(3).NextDouble);
                flow = new RunFlow(controller, () => new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc));
                renderer = new BoardRenderer(assets.OrbTextures);
                screen = new GameScreen(new ScreenServices
                {
                    Controller = controller,
                    Flow = flow,
                    Store = store,
                    Themes = new ThemeStore(storage),
                    Renderer = renderer,
                    Share = _ => { },
                    Clock = () => clock,
                    Now = () => 1_760_000_000_000,
                });
                root.Add(screen);
                screen.StretchToParentSize();
                screen.SetSafeArea(0, device.SafeTop, 0, device.SafeBottom);
            }

            public IEnumerator Run()
            {
                store.SubmitHighScore("Luna", GameMode.Classic, 8410, 6);
                store.SubmitHighScore("Mert", GameMode.Classic, 5120, 4);
                store.SubmitHighScore("Ada", GameMode.Classic, 2380, 3);
                yield return Frames(45);
                yield return Capture("home");

                yield return Sheet(SheetKind.Modes, "modes");
                yield return Sheet(SheetKind.Settings, "settings");
                screen.SetSystemReducedMotion(true);
                yield return Sheet(SheetKind.Settings, "settings-system-motion");
                screen.SetSystemReducedMotion(false);
                yield return Sheet(SheetKind.HighScores, "high-scores");

                flow.Start();
                yield return Frames(20);
                GameState state = controller.State;
                controller.BuildAt(new CellPoint(state.Grid.Cols / 4, state.Grid.Rows / 2), Orientation.Vertical);
                yield return Frames(150);
                controller.BuildAt(new CellPoint(state.Grid.Cols / 2, state.Grid.Rows * 3 / 4), Orientation.Horizontal);
                yield return Frames(20);
                yield return Capture("playing");

                controller.Pause();
                yield return Frames(30);
                yield return Capture("paused");
                yield return Sheet(SheetKind.HowToPlay, "how-to-play");

                controller.Resume();
                flow.EndRun();
                yield return Frames(40);
                yield return Capture("run-over");

                controller.AbandonRun();
                flow.Reset();
                var easy = new CustomSettings(1, 0.6, null, null, null, 50);
                store.SetCustomSettings(easy);
                store.SetLastMode(GameMode.Custom);
                controller.SetMode(GameMode.Custom, easy);
                yield return Frames(30);
                yield return Sheet(SheetKind.CustomSetup, "custom-setup");

                flow.Start();
                yield return ClearLevel();
                yield return Frames(30);
                yield return Capture("level-cleared");

                screen.SetTheme(Theme.Light);
                yield return Frames(10);
                yield return Capture("level-cleared-light");
                controller.NextLevel();
                yield return Frames(60);
                yield return Capture("playing-light");

                controller.AbandonRun();
                yield return Frames(30);
                yield return Capture("home-light");
                screen.SetTheme(Theme.Navy);

                // The HUD's second row: a countdown, then a countdown with a wall budget, mid-run with a big score.
                controller.SetMode(GameMode.TimeAttack);
                controller.StartRun(11, level: 3, score: 48_250);
                yield return Frames(30);
                yield return Capture("playing-time-attack");
                controller.AbandonRun();

                controller.SetMode(GameMode.Custom, Modes.Preset(CustomPreset.Hard));
                controller.StartRun(11, level: 2, score: 96_480);
                yield return Frames(30);
                yield return Capture("playing-custom-hard");
                controller.AbandonRun();
                yield return Frames(10);
            }

            /// <summary>Opens a sheet, captures it, and closes it again.</summary>
            private IEnumerator Sheet(SheetKind kind, string name)
            {
                screen.OpenSheet(kind);
                yield return Frames(30);
                yield return Capture(name);
                screen.CloseSheet();
                yield return Frames(20);
            }

            /// <summary>Walls off the side of the field away from the only orb until the level is cleared.</summary>
            private IEnumerator ClearLevel()
            {
                for (int attempt = 0; attempt < 30 && controller.Hud.Status == HudStatus.Playing; attempt++)
                {
                    GameState state = controller.State;
                    Ball ball = state.Balls[0];
                    int cols = state.Grid.Cols;
                    int rows = state.Grid.Rows;
                    int col = ball.X < cols / 2.0
                        ? Math.Min(cols - 3, (int)Math.Floor(ball.X) + 30)
                        : Math.Max(2, (int)Math.Floor(ball.X) - 30);
                    controller.BuildAt(new CellPoint(col, rows / 2), Orientation.Vertical);
                    yield return Frames(120);
                }
            }

            /// <summary>Advances the game and the UI by <paramref name="count"/> frames of 1/60 s.</summary>
            private IEnumerator Frames(int count)
            {
                for (int i = 0; i < count; i++)
                {
                    clock += FrameMs;
                    screen.Tick();
                    yield return null;
                }
            }

            private IEnumerator Capture(string state)
            {
                // Two more frames, so layout, the fonts' glyphs and the repaint have settled; then let the sheets'
                // transitions, which run on real time, finish while the game itself stands still.
                yield return Frames(2);
                yield return new WaitForSecondsRealtime(0.5f);
                yield return null;
                RenderTexture previous = RenderTexture.active;
                RenderTexture.active = target;
                var pixels = new Texture2D(target.width, target.height, TextureFormat.RGBA32, false);
                pixels.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
                pixels.Apply();
                RenderTexture.active = previous;
                string path = Path.Combine(folder, $"{device.Name}-{state}.png");
                File.WriteAllBytes(path, pixels.EncodeToPNG());
                Object.Destroy(pixels);
                Debug.Log($"UI snapshot: {path}");
            }

            public void Dispose()
            {
                screen.Dispose();
                flow.Dispose();
                renderer.Dispose();
                Object.Destroy(host);
                Object.Destroy(panel);
                target.Release();
                Object.Destroy(target);
            }
        }
    }
}

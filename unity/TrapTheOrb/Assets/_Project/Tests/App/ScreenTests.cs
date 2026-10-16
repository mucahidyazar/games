using NUnit.Framework;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI;
using TrapTheOrb.App.UI.Screens;
using TrapTheOrb.App.UI.Sheets;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Tests
{
    public sealed class ScreenRouteTests
    {
        private static readonly LevelResult Cleared = new LevelResult(3, 78.4, 42_000, 2, null, 300, 600, 120, 0, 1020);

        [Test]
        public void ShowsTheHomeScreenUntilARunStarts()
        {
            Assert.That(ScreenRoutes.ScreenFor(new HudSnapshot(), hasResult: false), Is.EqualTo(ScreenKind.Home));
            Assert.That(ScreenRoutes.ScreenFor(new HudSnapshot { Status = HudStatus.Ready }, false), Is.EqualTo(ScreenKind.Home));
            Assert.That(ScreenRoutes.StateSheetFor(new HudSnapshot { Status = HudStatus.Ready }, false), Is.EqualTo(SheetKind.None));
        }

        [Test]
        public void PlaysWhileARunIsInProgress()
        {
            var playing = new HudSnapshot { Status = HudStatus.Playing, InRun = true };
            var paused = playing with { Status = HudStatus.Paused };
            var cleared = playing with { Status = HudStatus.LevelComplete, LastResult = Cleared };

            Assert.That(ScreenRoutes.ScreenFor(playing, false), Is.EqualTo(ScreenKind.Play));
            Assert.That(ScreenRoutes.StateSheetFor(playing, false), Is.EqualTo(SheetKind.None));
            Assert.That(ScreenRoutes.ScreenFor(paused, false), Is.EqualTo(ScreenKind.Play));
            Assert.That(ScreenRoutes.StateSheetFor(paused, false), Is.EqualTo(SheetKind.Pause));
            Assert.That(ScreenRoutes.StateSheetFor(cleared, false), Is.EqualTo(SheetKind.LevelCleared));
        }

        [Test]
        public void ShowsTheResultOnceTheRunIsOver()
        {
            var over = new HudSnapshot { Status = HudStatus.GameOver, InRun = true };

            Assert.That(ScreenRoutes.ScreenFor(over, hasResult: true), Is.EqualTo(ScreenKind.RunOver));
            Assert.That(ScreenRoutes.StateSheetFor(over, hasResult: true), Is.EqualTo(SheetKind.None));
            // Until the result arrives the field stays on screen.
            Assert.That(ScreenRoutes.ScreenFor(over, hasResult: false), Is.EqualTo(ScreenKind.Play));
        }

        [Test]
        public void ASheetThePlayerOpenedCoversTheGamesOwnSheet()
        {
            Assert.That(ScreenRoutes.Visible(SheetKind.HowToPlay, SheetKind.Pause), Is.EqualTo(SheetKind.HowToPlay));
            Assert.That(ScreenRoutes.Visible(SheetKind.None, SheetKind.Pause), Is.EqualTo(SheetKind.Pause));
            Assert.That(ScreenRoutes.Visible(SheetKind.None, SheetKind.None), Is.EqualTo(SheetKind.None));
        }

        [Test]
        public void TheBackGestureStepsBackOneLevel()
        {
            var playing = new HudSnapshot { Status = HudStatus.Playing, InRun = true };
            var paused = playing with { Status = HudStatus.Paused };

            Assert.That(ScreenRoutes.BackFor(playing, false, SheetKind.None), Is.EqualTo(BackAction.Pause));
            Assert.That(ScreenRoutes.BackFor(paused, false, SheetKind.None), Is.EqualTo(BackAction.Resume));
            Assert.That(ScreenRoutes.BackFor(paused, false, SheetKind.HowToPlay), Is.EqualTo(BackAction.CloseSheet));
            Assert.That(ScreenRoutes.BackFor(playing with { Status = HudStatus.LevelComplete, LastResult = Cleared }, false, SheetKind.None),
                Is.EqualTo(BackAction.None), "a cleared level waits for Next level");
            Assert.That(ScreenRoutes.BackFor(new HudSnapshot { Status = HudStatus.GameOver, InRun = true }, true, SheetKind.None), Is.EqualTo(BackAction.GoHome));
            Assert.That(ScreenRoutes.BackFor(new HudSnapshot { Status = HudStatus.Ready }, false, SheetKind.None),
                Is.EqualTo(BackAction.LeaveApp), "the home screen hands back to the system");
            Assert.That(ScreenRoutes.BackFor(new HudSnapshot { Status = HudStatus.Ready }, false, SheetKind.Modes), Is.EqualTo(BackAction.CloseSheet));
        }

        [Test]
        public void HelpScoresAndSettingsPauseALevel()
        {
            Assert.That(ScreenRoutes.PausesTheGame(SheetKind.HowToPlay), Is.True);
            Assert.That(ScreenRoutes.PausesTheGame(SheetKind.HighScores), Is.True);
            Assert.That(ScreenRoutes.PausesTheGame(SheetKind.Settings), Is.True);
            Assert.That(ScreenRoutes.PausesTheGame(SheetKind.Modes), Is.False);
        }
    }

    public sealed class ScreenCopyTests
    {
        [Test]
        public void NamesTheOrbSpeedsInWords()
        {
            Assert.That(LevelSheet.SpeedSummary(ReadOnlyArray<int>.From(new[] { 1, 0, 0 })), Is.EqualTo("2 calm, 1 quick."));
            Assert.That(LevelSheet.SpeedSummary(ReadOnlyArray<int>.From(new[] { 3 })), Is.EqualTo("1 blazing."));
            Assert.That(LevelSheet.SpeedSummary(ReadOnlyArray<int>.From(new int[0])), Is.Empty);
        }

        [Test]
        public void SummarisesTheCustomSetup()
        {
            Assert.That(HomeView.CustomSummary(Modes.Preset(CustomPreset.Easy)), Is.EqualTo("2 orbs · 0.8× speed · ∞ lives"));
            Assert.That(HomeView.CustomSummary(new CustomSettings(1, 1.2, 1, null, null, 75)), Is.EqualTo("1 orb · 1.2× speed · 1 life"));
        }

        [Test]
        public void WrapsSummariesOnlyAfterTheirSeparators()
        {
            Assert.That(Format.BreakAtSeparators("1 orb · 0.6× speed · ∞ lives"), Is.EqualTo("1\u00A0orb\u00A0· 0.6×\u00A0speed\u00A0· ∞\u00A0lives"));
            Assert.That(Format.BreakAtSeparators("Best 8,410"), Is.EqualTo("Best\u00A08,410"));
        }
    }

    public sealed class AppSettingsTests
    {
        [Test]
        public void RoundTripsVibrationAndMotion()
        {
            var store = new MemoryStore();
            Settings settings = Settings.Default with { HapticsEnabled = false, ReducedMotion = true };

            Assert.That(SettingsStorage.Save(store, settings), Is.True);
            Assert.That(SettingsStorage.Load(store), Is.EqualTo(settings));
        }

        [Test]
        public void KeepsVibrationOnAndMotionFullForTheWebFormat()
        {
            var store = new MemoryStore();
            store.SetItem(StorageKeys.Settings, "{\"soundEnabled\":true,\"hapticsEnabled\":\"yes\"}");

            Settings loaded = SettingsStorage.Load(store);

            Assert.That(loaded.HapticsEnabled, Is.True);
            Assert.That(loaded.ReducedMotion, Is.False);
        }

        [Test]
        public void TheStoreRemembersTheNewSwitches()
        {
            var store = new PlayerStore(new MemoryStore(), () => 0);

            store.SetHapticsEnabled(false);
            store.SetReducedMotion(true);

            Assert.That(store.Snapshot.Settings.HapticsEnabled, Is.False);
            Assert.That(store.Snapshot.Settings.ReducedMotion, Is.True);
        }
    }
}

using System.Linq;
using NUnit.Framework;
using TrapTheOrb.App.Core;
using TrapTheOrb.Engine;
using static TrapTheOrb.App.Tests.ControllerHarness;

namespace TrapTheOrb.App.Tests
{
    public sealed class GameControllerSetupTests
    {
        [Test]
        public void WaitsForASizeBeforeShowingTheReadyScreen()
        {
            var controller = new GameController(new RecordingFeedback(), 1);
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Loading));
            Assert.That(controller.State, Is.Null);

            controller.Resize(1000, 500);

            HudSnapshot hud = controller.Hud;
            Assert.That(hud.Status, Is.EqualTo(HudStatus.Ready));
            Assert.That(hud.Mode, Is.EqualTo(GameMode.Classic));
            Assert.That(hud.RankedMode, Is.True);
            Assert.That(hud.InRun, Is.False);
            Assert.That(hud.OrbCount, Is.EqualTo(1));
            Assert.That(hud.OrbTiers.ToArray(), Is.EqualTo(new[] { 0 }));
            Assert.That(hud.TopSpeedFactor, Is.EqualTo(1));
            Assert.That(hud.MaxSpeedFactor, Is.EqualTo(1.6).Within(1e-9));
            Assert.That(hud.Lives, Is.EqualTo(2));
            Assert.That(hud.InfiniteLives, Is.False);
            Assert.That(hud.TimeLeftMs, Is.Null);
            Assert.That(hud.WallsLeft, Is.Null);
            Assert.That(controller.State.Grid.Cols, Is.EqualTo(300));
            Assert.That(controller.State.Grid.Rows, Is.EqualTo(150));
        }

        [Test]
        public void UsesATallFieldOnAPortraitBoard()
        {
            var controller = new GameController(new RecordingFeedback(), 1);

            controller.Resize(500, 1000);

            Assert.That(controller.State.Grid.Cols, Is.EqualTo(150));
            Assert.That(controller.State.Grid.Rows, Is.EqualTo(300));
            Assert.That(controller.FieldOrientation, Is.EqualTo(FieldOrientation.Portrait));
        }

        [Test]
        public void ReshapesThePreviewOnResizeButNeverARunInProgress()
        {
            (GameController controller, _) = Setup();

            controller.Resize(500, 1000);
            Assert.That(controller.State.Field, Is.EqualTo(FieldOrientation.Portrait));

            controller.StartRun(5);
            controller.Resize(1000, 500);
            Assert.That(controller.State.Field, Is.EqualTo(FieldOrientation.Portrait));
        }

        [Test]
        public void IgnoresEmptyOrInvalidSizes()
        {
            var controller = new GameController(new RecordingFeedback(), 1);

            controller.Resize(0, 400);
            controller.Resize(float.NaN, 400);
            controller.Resize(800, float.PositiveInfinity);

            Assert.That(controller.State, Is.Null);
        }

        [Test]
        public void NotifiesListenersOnlyWhenTheHudChanges()
        {
            (GameController controller, _) = Setup();
            int calls = 0;
            controller.HudChanged += () => calls++;

            controller.Advance(1000);
            Assert.That(calls, Is.Zero);

            controller.StartRun(1);
            Assert.That(calls, Is.EqualTo(1));
        }
    }

    public sealed class GameControllerRunTests
    {
        [Test]
        public void StartsARunWithFeedbackAndARunStartedEvent()
        {
            (GameController controller, RecordingFeedback feedback) = Setup();
            var events = Collect(controller);

            controller.StartRun(9);

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
            Assert.That(controller.Hud.InRun, Is.True);
            Assert.That(controller.IsRunActive, Is.True);
            Assert.That(feedback.Played, Has.Member(SoundName.Start));
            Assert.That(events, Has.Member(new RunStartedEvent(GameMode.Classic, 1, 0)));
        }

        [Test]
        public void UsesTheRequestedFieldWhateverTheBoardShape()
        {
            (GameController controller, _) = Setup();

            controller.StartRun(9, FieldOrientation.Portrait);

            Assert.That(controller.State.Grid.Cols, Is.EqualTo(150));
            Assert.That(controller.State.Grid.Rows, Is.EqualTo(300));
        }

        [Test]
        public void CanStartAnUnrankedRunAtALaterLevel()
        {
            (GameController controller, _) = Setup();

            controller.StartRun(9, level: 4, score: 5000);

            Assert.That(controller.Hud.Level, Is.EqualTo(4));
            Assert.That(controller.Hud.Score, Is.EqualTo(5000));
            Assert.That(controller.Hud.OrbTiers.ToArray(), Is.EqualTo(new[] { 1, 1 }));
        }

        [Test]
        public void Runs120FixedTicksPerSecondAndDropsLongHitches()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(3);

            RunFrames(controller, 60);
            int afterOneSecond = controller.State.Tick;
            controller.Advance(60_000);

            Assert.That(afterOneSecond, Is.InRange(119, 121));
            Assert.That(controller.State.Tick - afterOneSecond, Is.LessThanOrEqualTo(30));
        }

        [Test]
        public void PausesAndResumesOnlyALevelInPlay()
        {
            (GameController controller, _) = Setup();

            controller.TogglePause();
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Ready));

            controller.StartRun(1);
            controller.TogglePause();
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Paused));
            controller.TogglePause();
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
        }

        [Test]
        public void KeepsTheClockStillWhilePaused()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);
            double time = RunFrames(controller, 90);
            long before = controller.Hud.ElapsedMs;

            controller.Pause();
            RunFrames(controller, 120, time);

            Assert.That(before, Is.EqualTo(1000));
            Assert.That(controller.Hud.ElapsedMs, Is.EqualTo(before));
        }

        [Test]
        public void FlipsTheWallOrientation()
        {
            (GameController controller, _) = Setup();

            controller.ToggleOrientation();
            Assert.That(controller.Hud.Orientation, Is.EqualTo(Orientation.Horizontal));
            controller.SetOrientation(Orientation.Vertical);
            Assert.That(controller.Hud.Orientation, Is.EqualTo(Orientation.Vertical));
        }

        [Test]
        public void OnlyMovesOnToTheNextLevelOnceTheLevelIsComplete()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);

            controller.NextLevel();

            Assert.That(controller.Hud.Level, Is.EqualTo(1));
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
        }

        [Test]
        public void EndsARunOnRequestAndKeepsTheFieldAndRecording()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);
            RunFrames(controller, 30);
            controller.BuildAt(new CellPoint(150, 75));

            controller.EndRun();
            controller.EndRun();

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.GameOver));
            Assert.That(controller.Hud.GameOverReason, Is.Null);
            Assert.That(controller.Hud.InRun, Is.True);
            Assert.That(controller.IsRunActive, Is.False);
            Assert.That(controller.GetRecording().Inputs.Count, Is.EqualTo(1));
        }

        [Test]
        public void LeavesARunForTheReadyScreen()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);

            controller.AbandonRun();

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Ready));
            Assert.That(controller.Hud.InRun, Is.False);
            Assert.That(controller.IsRunActive, Is.False);
            Assert.That(controller.GetRecording(), Is.Null);
        }

        [Test]
        public void ForgetsTimeSpentInTheBackground()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);
            RunFrames(controller, 10);
            int tick = controller.State.Tick;

            controller.ResetClock();
            controller.Advance(500_000);

            Assert.That(controller.State.Tick, Is.EqualTo(tick));
        }
    }

    public sealed class GameControllerModeTests
    {
        [Test]
        public void SwitchesTheReadyScreenToAnotherMode()
        {
            (GameController controller, _) = Setup();

            controller.SetMode(GameMode.Zen);

            Assert.That(controller.Mode, Is.EqualTo(GameMode.Zen));
            Assert.That(controller.Custom, Is.Null);
            Assert.That(controller.Hud.RankedMode, Is.False);
            Assert.That(controller.Hud.InfiniteLives, Is.True);
        }

        [Test]
        public void KeepsThePreviewWhenTheSameModeIsPickedAgain()
        {
            (GameController controller, _) = Setup();
            GameState preview = controller.State;

            controller.SetMode(GameMode.Classic);

            Assert.That(controller.State, Is.SameAs(preview));
        }

        [Test]
        public void DoesNotSwitchModesInTheMiddleOfARun()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(1);

            controller.SetMode(GameMode.Zen);

            Assert.That(controller.Hud.Mode, Is.EqualTo(GameMode.Classic));
        }

        [Test]
        public void ShowsTheLimitsOfACustomSetup()
        {
            (GameController controller, _) = Setup();

            controller.SetMode(GameMode.Custom, Modes.Preset(CustomPreset.Hard));

            HudSnapshot hud = controller.Hud;
            Assert.That(hud.Mode, Is.EqualTo(GameMode.Custom));
            Assert.That(hud.OrbCount, Is.EqualTo(5));
            Assert.That(hud.TopSpeedFactor, Is.EqualTo(1.3).Within(1e-9));
            Assert.That(hud.MaxLives, Is.EqualTo(3));
            Assert.That(hud.WallsLeft, Is.EqualTo(16));
            Assert.That(hud.WallBudget, Is.EqualTo(16));
            Assert.That(hud.TimeLeftMs, Is.EqualTo(120_000));
            Assert.That(hud.TargetPercent, Is.EqualTo(80));
        }

        [Test]
        public void IgnoresCustomSettingsForTheOtherModes()
        {
            (GameController controller, _) = Setup();

            controller.SetMode(GameMode.Zen, Modes.Preset(CustomPreset.Hard));

            Assert.That(controller.Custom, Is.Null);
        }

        [Test]
        public void CountsDownInTimeAttack()
        {
            (GameController controller, _) = Setup();
            controller.SetMode(GameMode.TimeAttack);
            controller.StartRun(2);

            RunFrames(controller, 60);

            Assert.That(controller.Hud.TimeLeftMs, Is.EqualTo(44_000));
        }

        [Test]
        public void SpendsTheWallBudgetInLimitedWallsAndSaysWhenItIsGone()
        {
            (GameController controller, RecordingFeedback feedback) = Setup();
            controller.SetMode(GameMode.LimitedWalls);
            controller.StartRun(2);
            int budget = controller.Hud.WallBudget ?? 0;

            double time = 1000;
            for (int wall = 0; wall < budget; wall++)
            {
                BreakWallOnBall(controller);
                time = RunFrames(controller, 6, time);
                if (controller.Hud.Status != HudStatus.Playing) break;
            }

            Assert.That(budget, Is.EqualTo(6));
            Assert.That(controller.Hud.WallsLeft == 0 || controller.Hud.Status == HudStatus.GameOver, Is.True);
            if (controller.Hud.Status != HudStatus.Playing) return;
            Assert.That(controller.BuildAt(new CellPoint(20, 20)), Is.False);
            Assert.That(feedback.Played, Has.Member(SoundName.Blocked));
            Assert.That(controller.Hud.Announcement, Is.EqualTo("No walls left in this level."));
        }
    }

    public sealed class GameControllerWallTests
    {
        [Test]
        public void BuildsOneWallAtATimeAndPlaysFeedbackSounds()
        {
            (GameController controller, RecordingFeedback feedback) = Setup();
            controller.StartRun(42);

            Assert.That(controller.BuildAt(new CellPoint(150, 75)), Is.True);
            Assert.That(controller.BuildAt(new CellPoint(40, 40)), Is.False);
            Assert.That(feedback.Played, Has.Member(SoundName.Build));
            Assert.That(feedback.Played, Has.Member(SoundName.Blocked));
        }

        [Test]
        public void IgnoresWallsOnTheReadyScreen()
        {
            (GameController controller, _) = Setup();

            Assert.That(controller.BuildAt(new CellPoint(150, 75)), Is.False);
        }

        [Test]
        public void ReportsBrokenWallsToListenersAndTheHud()
        {
            (GameController controller, _) = Setup();
            var events = Collect(controller);
            controller.StartRun(42);

            BreakWallOnBall(controller);
            RunFrames(controller, 6);

            Assert.That(events.OfType<WallBrokenEvent>(), Is.Not.Empty);
            Assert.That(controller.Hud.Lives, Is.EqualTo(1));
            Assert.That(controller.Hud.Announcement, Does.Contain("Wall broken — 1 life left"));
        }

        [Test]
        public void PlaysOneBreakSoundWhenBothHalvesBreakTogether()
        {
            (GameController controller, RecordingFeedback feedback) = Setup();
            controller.StartRun(42);

            BreakWallOnBall(controller);
            RunFrames(controller, 6);

            Assert.That(feedback.Count(SoundName.Break), Is.EqualTo(1));
        }

        [Test]
        public void NeverTakesLivesInZen()
        {
            (GameController controller, _) = Setup();
            controller.SetMode(GameMode.Zen);
            controller.StartRun(42);

            BreakWallOnBall(controller);
            RunFrames(controller, 6);

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
            Assert.That(controller.Hud.InfiniteLives, Is.True);
            Assert.That(controller.Hud.Announcement, Is.EqualTo("Wall broken."));
        }

        [Test]
        public void EndsTheRunAfterTheLastLife()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(42);

            double time = 1000;
            for (int attempt = 0; attempt < 2; attempt++)
            {
                BreakWallOnBall(controller);
                time = RunFrames(controller, 6, time);
            }

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.GameOver));
            Assert.That(controller.Hud.GameOverReason, Is.EqualTo(GameOverReason.Lives));
            Assert.That(controller.Hud.Announcement, Does.StartWith("Game over"));
            Assert.That(controller.IsRunActive, Is.False);

            controller.RestartLevel();
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.GameOver));

            controller.StartRun(43);
            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
            Assert.That(controller.Hud.Level, Is.EqualTo(1));
            Assert.That(controller.Hud.Score, Is.Zero);
        }

        [Test]
        public void RestartsTheCurrentLevelWhilePlaying()
        {
            (GameController controller, _) = Setup();
            var events = Collect(controller);
            controller.StartRun(42);
            BreakWallOnBall(controller);
            RunFrames(controller, 6);

            controller.RestartLevel();

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
            Assert.That(controller.Hud.Lives, Is.EqualTo(2));
            Assert.That(controller.Hud.ElapsedMs, Is.Zero);
            Assert.That(events, Has.Member(new LevelStartedEvent(1, 0)));
        }

        [Test]
        public void AimsFromTheCentreAndBuildsAtTheCursor()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(42);

            controller.MoveAim(1, 0);

            Assert.That(controller.BuildAtAim(), Is.True);
            WallHalf wall = controller.State.Walls[0];
            Assert.That(wall.Orientation, Is.EqualTo(Orientation.Vertical));
            Assert.That(wall.Line, Is.EqualTo(150 + (int)JsMath.Round(150 * 0.025)));
        }

        [Test]
        public void MapsBoardPointsToCells()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(42);

            Assert.That(controller.CellAt(10, 10), Is.EqualTo(new CellPoint(3, 3)));
            Assert.That(controller.CellAt(-1, 10), Is.Null);
            Assert.That(controller.BuildAtPoint(500, 250, Orientation.Horizontal), Is.True);
            Assert.That(controller.State.Walls[0].Orientation, Is.EqualTo(Orientation.Horizontal));
        }
    }

    public sealed class GameControllerLevelTests
    {
        [Test]
        public void PreviewsTheNextLevelOnceOneIsClearedThenStartsIt()
        {
            (GameController controller, _) = Setup(7);
            var events = Collect(controller);
            controller.SetMode(GameMode.Custom, EasyCustom);
            controller.StartRun(7);

            ClearLevel(controller);

            HudSnapshot hud = controller.Hud;
            Assert.That(hud.Status, Is.EqualTo(HudStatus.LevelComplete));
            Assert.That(hud.NextLevel.Level, Is.EqualTo(2));
            Assert.That(hud.NextLevel.OrbTiers.ToArray(), Is.EqualTo(new[] { 0 }));
            Assert.That(hud.NextLevel.Change, Is.EqualTo(LevelChange.Repeat));
            Assert.That(hud.LastResult.Level, Is.EqualTo(1));

            controller.NextLevel();

            Assert.That(controller.Hud.Status, Is.EqualTo(HudStatus.Playing));
            Assert.That(controller.Hud.Level, Is.EqualTo(2));
            Assert.That(controller.Hud.NextLevel, Is.Null);
            Assert.That(events, Has.Member(new LevelStartedEvent(2, controller.Hud.Score)));
        }

        [Test]
        public void HasNothingToRecordOutsideARun()
        {
            (GameController controller, _) = Setup();

            Assert.That(controller.GetRecording(), Is.Null);
        }

        [Test]
        public void RecordsEveryAcceptedWallWithTheTickItWasBuiltOn()
        {
            (GameController controller, _) = Setup();
            controller.StartRun(11);
            double time = RunFrames(controller, 30);

            controller.BuildAt(new CellPoint(150, 75), Orientation.Horizontal);
            RunFrames(controller, 30, time);

            RunRecording recording = controller.GetRecording();
            Assert.That(recording.Mode, Is.EqualTo(GameMode.Classic));
            Assert.That(recording.Custom, Is.Null);
            Assert.That(recording.Field, Is.EqualTo(FieldOrientation.Landscape));
            Assert.That(recording.Seed, Is.EqualTo(11));
            Assert.That(recording.Inputs.Count, Is.EqualTo(1));
            RunInput input = recording.Inputs[0];
            Assert.That((input.Col, input.Row, input.Orientation), Is.EqualTo((150, 75, Orientation.Horizontal)));
            Assert.That(input.Tick, Is.GreaterThan(50));
            Assert.That(recording.EndTick, Is.EqualTo(controller.State.Tick));
        }

        [Test]
        public void ProducesRecordingsTheEngineReplaysToTheSameResult()
        {
            (GameController controller, _) = Setup();
            controller.SetMode(GameMode.Custom, EasyCustom);
            controller.StartRun(21);
            double time = ClearLevel(controller);
            controller.NextLevel();
            time = RunFrames(controller, 45, time);
            BreakWallOnBall(controller);
            RunFrames(controller, 30, time);

            RunRecording recording = controller.GetRecording();
            ReplayResult replay = Replay.Run(new ReplayRequest(recording.Mode, recording.Seed, recording.Field, recording.Custom,
                recording.Inputs, recording.EndTick));

            Assert.That(replay.Tick, Is.EqualTo(recording.EndTick));
            Assert.That(replay.Score, Is.EqualTo(controller.State.Score));
            Assert.That(replay.Level, Is.EqualTo(2));
            Assert.That(replay.AcceptedInputs, Is.EqualTo(recording.Inputs.Count));
        }
    }
}

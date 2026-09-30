using System;
using NUnit.Framework;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Run;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Overlay;
using TrapTheOrb.Engine;
using static TrapTheOrb.App.Tests.ControllerHarness;

namespace TrapTheOrb.App.Tests
{
    public sealed class RunFlowTests
    {
        private static readonly DateTime Today = new DateTime(2026, 9, 27, 15, 0, 0, DateTimeKind.Utc);

        private static (GameController Controller, RunFlow Flow) Create()
        {
            (GameController controller, _) = Setup();
            return (controller, new RunFlow(controller, () => Today));
        }

        [Test]
        public void StartsARunOfTheChosenMode()
        {
            (GameController controller, RunFlow flow) = Create();
            int changes = 0;
            flow.Changed += () => changes++;

            flow.Start();

            Assert.That(controller.IsRunActive, Is.True);
            Assert.That(flow.Result, Is.Null);
            Assert.That(changes, Is.EqualTo(1));
        }

        [Test]
        public void GivesEveryoneTheSameDailyLayout()
        {
            (GameController controller, RunFlow flow) = Create();
            controller.SetMode(GameMode.Daily);

            flow.Start();

            Assert.That(controller.GetRecording().Seed, Is.EqualTo(Rng.DailySeed("2026-09-27")));
        }

        [Test]
        public void RecordsTheResultWhenTheRunIsLost()
        {
            (GameController controller, RunFlow flow) = Create();
            flow.Start();

            double time = 1000;
            for (int attempt = 0; attempt < 2; attempt++)
            {
                BreakWallOnBall(controller);
                time = RunFrames(controller, 6, time);
            }

            Assert.That(flow.Result, Is.Not.Null);
            Assert.That(flow.Result.Mode, Is.EqualTo(GameMode.Classic));
            Assert.That(flow.Result.Level, Is.EqualTo(1));
            Assert.That(flow.Result.EndedEarly, Is.False);
        }

        [Test]
        public void EndsARunEarlyWithItsScoreSoFar()
        {
            (GameController controller, RunFlow flow) = Create();
            flow.Start();

            flow.EndRun();

            Assert.That(controller.IsRunActive, Is.False);
            Assert.That(flow.Result.EndedEarly, Is.True);
            Assert.That(flow.Result.Id, Is.EqualTo(1));
        }

        [Test]
        public void ContinuesASavedPracticeRunFromItsLevel()
        {
            (GameController controller, RunFlow flow) = Create();

            flow.ContinueSaved(new SavedRun(GameMode.Custom, Modes.Preset(CustomPreset.Hard), 4, 3200, 1));

            Assert.That(controller.Mode, Is.EqualTo(GameMode.Custom));
            Assert.That(controller.Hud.Level, Is.EqualTo(4));
            Assert.That(controller.Hud.Score, Is.EqualTo(3200));
            Assert.That(controller.Custom, Is.EqualTo(Modes.Preset(CustomPreset.Hard)));
        }

        [Test]
        public void ResetForgetsTheResult()
        {
            (_, RunFlow flow) = Create();
            flow.Start();
            flow.EndRun();

            flow.Reset();

            Assert.That(flow.Result, Is.Null);
        }
    }

    public sealed class PrimaryActionTests
    {
        [TestCase(HudStatus.Playing, false, false, PrimaryAction.Pause)]
        [TestCase(HudStatus.Paused, false, false, PrimaryAction.Resume)]
        [TestCase(HudStatus.LevelComplete, false, false, PrimaryAction.Next)]
        [TestCase(HudStatus.GameOver, false, false, PrimaryAction.PlayAgain)]
        [TestCase(HudStatus.Ready, false, false, PrimaryAction.Play)]
        [TestCase(HudStatus.Ready, false, true, PrimaryAction.Continue)]
        [TestCase(HudStatus.Ready, true, false, PrimaryAction.PlayAgain)]
        public void PicksTheOneMainThingToDo(HudStatus status, bool hasResult, bool canContinue, PrimaryAction expected)
        {
            var hud = new HudSnapshot { Status = status, InRun = status != HudStatus.Ready };

            Assert.That(PrimaryActions.For(hud, hasResult, canContinue), Is.EqualTo(expected));
        }

        [Test]
        public void ShowsTheResultOnlyOnceTheRunIsOver()
        {
            var playing = new HudSnapshot { Status = HudStatus.Playing, InRun = true };
            var over = new HudSnapshot { Status = HudStatus.GameOver, InRun = true };

            Assert.That(OverlayKinds.For(playing, hasResult: true), Is.EqualTo(OverlayKind.None));
            Assert.That(OverlayKinds.For(over, hasResult: true), Is.EqualTo(OverlayKind.Result));
            Assert.That(OverlayKinds.For(new HudSnapshot { Status = HudStatus.Ready }, false), Is.EqualTo(OverlayKind.Ready));
            Assert.That(OverlayKinds.For(new HudSnapshot { Status = HudStatus.Paused, InRun = true }, false), Is.EqualTo(OverlayKind.Paused));
            Assert.That(OverlayKinds.For(new HudSnapshot { Status = HudStatus.LevelComplete, InRun = true }, false), Is.EqualTo(OverlayKind.None));
            Assert.That(OverlayKinds.For(new HudSnapshot { Status = HudStatus.Loading }, false), Is.EqualTo(OverlayKind.None));
        }
    }
}

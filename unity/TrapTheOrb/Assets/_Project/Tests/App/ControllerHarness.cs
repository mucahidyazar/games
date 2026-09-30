using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Tests
{
    /// <summary>Feedback that remembers what it was asked to play.</summary>
    public sealed class RecordingFeedback : IFeedback
    {
        public List<SoundName> Played { get; } = new List<SoundName>();

        public void Play(SoundName name) => Played.Add(name);

        public int Count(SoundName name) => Played.FindAll(played => played == name).Count;
    }

    /// <summary>Helpers shared by the controller tests (GameController.test.ts).</summary>
    public static class ControllerHarness
    {
        public const double FrameMs = 1000.0 / 60;

        /// <summary>A slow single orb with unlimited lives and a low target: easy to clear in a test.</summary>
        public static readonly CustomSettings EasyCustom = new CustomSettings(1, 0.6, null, null, null, 50);

        /// <summary>A controller with a 1000 x 500 board (a 300 x 150 landscape field).</summary>
        public static (GameController Controller, RecordingFeedback Feedback) Setup(uint seed = 42)
        {
            var feedback = new RecordingFeedback();
            var controller = new GameController(feedback, seed, new Random(7).NextDouble);
            controller.Resize(1000, 500);
            return (controller, feedback);
        }

        /// <summary>Runs <paramref name="frames"/> frames of 1/60 s; returns the time of the next frame.</summary>
        public static double RunFrames(GameController controller, int frames, double start = 1000)
        {
            double time = start;
            for (int i = 0; i <= frames; i++)
            {
                controller.Advance(time);
                time += FrameMs;
            }
            return time;
        }

        /// <summary>Builds a wall right on top of the first orb so it breaks immediately.</summary>
        public static void BreakWallOnBall(GameController controller)
        {
            Ball ball = controller.State.Balls[0];
            controller.BuildAt(new CellPoint((int)Math.Floor(ball.X), (int)Math.Floor(ball.Y)), Orientation.Vertical);
        }

        /// <summary>Keeps walling off the side of the field away from the only orb until the level is cleared.</summary>
        public static double ClearLevel(GameController controller, double start = 1000)
        {
            double time = start;
            for (int attempt = 0; attempt < 30 && controller.Hud.Status == HudStatus.Playing; attempt++)
            {
                GameState state = controller.State;
                Ball ball = state.Balls[0];
                int cols = state.Grid.Cols;
                int rows = state.Grid.Rows;
                int col = ball.X < cols / 2.0
                    ? Math.Min(cols - 3, (int)Math.Floor(ball.X) + 40)
                    : Math.Max(2, (int)Math.Floor(ball.X) - 40);
                controller.BuildAt(new CellPoint(col, rows / 2), Orientation.Vertical);
                time = RunFrames(controller, 90, time);
            }
            return time;
        }

        public static List<GameEvent> Collect(GameController controller)
        {
            var events = new List<GameEvent>();
            controller.GameEvents += (batch, _) => events.AddRange(batch);
            return events;
        }
    }
}

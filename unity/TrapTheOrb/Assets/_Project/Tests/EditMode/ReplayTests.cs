using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class ReplayTests
    {
        private static ReplayRequest Request(ReadOnlyArray<RunInput> inputs, int endTick, uint seed = 1) =>
            new ReplayRequest(GameMode.Classic, seed, FieldOrientation.Landscape, null, inputs, endTick);

        private static ReadOnlyArray<RunInput> Inputs(params RunInput[] inputs) => ReadOnlyArray<RunInput>.From(inputs);

        private static RunInput Input(int tick, int col = 50, int row = 50) => new RunInput(tick, col, row, Orientation.Vertical);

        /// <summary>Plays like a person would, recording every accepted wall (the engine's replay test player).</summary>
        private static (GameState State, List<RunInput> Inputs) PlaySession(GameMode mode, uint seed, int ticks, bool reckless = false)
        {
            GameState state = Game.StartGame(Game.CreateRun(new CreateRunOptions(mode, seed)));
            var inputs = new List<RunInput>();

            while (state.Tick < ticks && state.Status != GameStatus.GameOver)
            {
                if (state.Status == GameStatus.LevelComplete)
                {
                    state = Game.AdvanceToNextLevel(state);
                    continue;
                }
                if (state.Tick % 45 == 0 && state.Walls.Count == 0 && ChooseCell(state, reckless) is CellPoint cell)
                {
                    StepResult placed = Game.PlaceWall(state, cell.Col, cell.Row, Orientation.Vertical);
                    if (placed.Events.Any(e => e is WallStartedEvent)) inputs.Add(new RunInput(state.Tick, cell.Col, cell.Row, Orientation.Vertical));
                    state = placed.State;
                }
                state = Game.Tick(state).State;
            }
            return (state, inputs);
        }

        private static CellPoint? ChooseCell(GameState state, bool reckless)
        {
            int row = state.Grid.Rows / 2;
            if (reckless) return state.Balls.Count > 0 ? new CellPoint((int)state.Balls[0].X, (int)state.Balls[0].Y) : (CellPoint?)null;
            for (int col = 8; col < state.Grid.Cols - 8; col += 11)
            {
                int candidate = col;
                bool clear = state.Balls.All(ball => System.Math.Abs(ball.X - candidate) > 14);
                if (clear && !state.Grid.IsSolid(col, row)) return new CellPoint(col, row);
            }
            return null;
        }

        [Test]
        public void ReproducesARecordedClassicSessionExactly()
        {
            (GameState state, List<RunInput> inputs) = PlaySession(GameMode.Classic, 11, 9000);

            ReplayResult replayed = Replay.Run(Request(ReadOnlyArray<RunInput>.From(inputs), state.Tick, 11));

            Assert.That(inputs.Count, Is.GreaterThan(5));
            Assert.That((replayed.Status, replayed.Score, replayed.Level, replayed.Tick), Is.EqualTo((state.Status, state.Score, state.Level, state.Tick)));
            Assert.That(replayed.AcceptedInputs, Is.EqualTo(inputs.Count));
            Assert.That(replayed.Stats, Is.EqualTo(state.Stats));
        }

        [Test]
        public void StopsAtGameOverEvenWhenTheEndTickIsLater()
        {
            (GameState state, List<RunInput> inputs) = PlaySession(GameMode.Hardcore, 3, 5000, reckless: true);

            ReplayResult replayed = Replay.Run(new ReplayRequest(GameMode.Hardcore, 3, FieldOrientation.Landscape, null,
                ReadOnlyArray<RunInput>.From(inputs), state.Tick + 4000));

            Assert.That(state.Status, Is.EqualTo(GameStatus.GameOver));
            Assert.That((replayed.Status, replayed.GameOverReason, replayed.Tick, replayed.Score),
                Is.EqualTo((GameStatus.GameOver, (GameOverReason?)GameOverReason.Lives, state.Tick, state.Score)));
        }

        [Test]
        public void StopsAtTheEndTickForRunsThePlayerLeftEarly()
        {
            (_, List<RunInput> inputs) = PlaySession(GameMode.Zen, 4, 3000);

            ReplayResult replayed = Replay.Run(new ReplayRequest(GameMode.Zen, 4, FieldOrientation.Landscape, null,
                ReadOnlyArray<RunInput>.From(inputs.Where(input => input.Tick <= 1200)), 1200));

            Assert.That(replayed.Tick, Is.EqualTo(1200));
            Assert.That(replayed.Status, Is.Not.EqualTo(GameStatus.GameOver));
        }

        [Test]
        public void CountsInputsTheEngineRefusesWithoutFailingTheRun()
        {
            (GameState state, List<RunInput> inputs) = PlaySession(GameMode.Classic, 11, 2000);

            ReplayResult replayed = Replay.Run(Request(ReadOnlyArray<RunInput>.From(new[] { inputs[0], inputs[0] }.Concat(inputs.Skip(1))), state.Tick, 11));

            Assert.That(replayed.AcceptedInputs, Is.EqualTo(inputs.Count));
            Assert.That(replayed.Score, Is.EqualTo(state.Score));
        }

        [Test]
        public void RejectsMalformedRecordings()
        {
            ReplayErrorCode CodeOf(ReplayRequest request) => Assert.Throws<ReplayException>(() => Replay.Run(request)).Code;

            Assert.That(CodeOf(Request(Inputs(Input(90), Input(30)), 200)), Is.EqualTo(ReplayErrorCode.Order));
            Assert.That(CodeOf(Request(Inputs(Input(300)), 200)), Is.EqualTo(ReplayErrorCode.Range));
            Assert.That(CodeOf(Request(Inputs(Input(10, 400, 10)), 200)), Is.EqualTo(ReplayErrorCode.Range));
            Assert.That(CodeOf(Request(Inputs(Input(10, -1, 10)), 200)), Is.EqualTo(ReplayErrorCode.Range));
            Assert.That(CodeOf(Request(Inputs(), -1)), Is.EqualTo(ReplayErrorCode.Range));
            Assert.That(CodeOf(Request(Inputs(), Replay.MaxRunTicks + 1)), Is.EqualTo(ReplayErrorCode.TooLong));
        }
    }
}

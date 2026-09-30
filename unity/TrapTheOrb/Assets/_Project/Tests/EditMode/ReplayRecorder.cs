using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    /// <summary>A recorded session from the fixtures, ready to replay.</summary>
    internal sealed class RecordedSession
    {
        private RecordedSession(string name, ReplayRequest request)
        {
            Name = name;
            Request = request;
        }

        public string Name { get; }
        public ReplayRequest Request { get; }

        public static RecordedSession From(JToken session)
        {
            RunInput[] inputs = session["inputs"]
                .Select(input => new RunInput((int)input["t"], (int)input["c"], (int)input["r"], Fixtures.OrientationOf(input["o"])))
                .ToArray();
            var request = new ReplayRequest(
                Fixtures.Mode(session["mode"]),
                (uint)session["seed"],
                Fixtures.FieldOf(session["field"]),
                Fixtures.Custom(session["custom"]),
                ReadOnlyArray<RunInput>.From(inputs),
                (int)session["endTick"]);
            return new RecordedSession((string)session["name"], request);
        }
    }

    /// <summary>
    /// The exporter's instrumented replay loop, step for step: checkpoints at the start, every 480 ticks, at every
    /// level start and end, and at the end; plus every event with the tick it happened on.
    /// </summary>
    internal static class ReplayRecorder
    {
        private const int CheckpointEvery = 480;

        public static void AssertMatches(RecordedSession recorded, JToken session)
        {
            var checkpoints = new List<(string Reason, GameState State)>();
            var events = new List<(int Tick, GameEvent Event)>();
            Play(recorded.Request, checkpoints, events);

            JToken[] expectedCheckpoints = session["checkpoints"].ToArray();
            JToken[] expectedEvents = session["events"].ToArray();
            for (int index = 0; index < System.Math.Min(checkpoints.Count, expectedCheckpoints.Length); index++)
            {
                JToken expected = expectedCheckpoints[index];
                string where = $"{recorded.Name} checkpoint {index} ({expected["reason"]} at tick {expected["tick"]})";
                Assert.That(checkpoints[index].Reason, Is.EqualTo((string)expected["reason"]), where);
                SnapshotAssert.State(checkpoints[index].State, expected, where);
            }
            Assert.That(checkpoints.Count, Is.EqualTo(expectedCheckpoints.Length), $"{recorded.Name} checkpoint count");

            for (int index = 0; index < System.Math.Min(events.Count, expectedEvents.Length); index++)
            {
                JToken expected = expectedEvents[index];
                string where = $"{recorded.Name} event {index} at tick {expected["tick"]}";
                Assert.That(events[index].Tick, Is.EqualTo((int)expected["tick"]), where);
                SnapshotAssert.Event(events[index].Event, expected["event"], where);
            }
            Assert.That(events.Count, Is.EqualTo(expectedEvents.Length), $"{recorded.Name} event count");
        }

        private static void Play(ReplayRequest request, List<(string, GameState)> checkpoints, List<(int, GameEvent)> events)
        {
            GameState state = Game.StartGame(Game.CreateRun(new CreateRunOptions(request.Mode, request.Seed)
            {
                Field = request.Field,
                Custom = request.Custom,
            }));
            int next = 0;
            checkpoints.Add(("start", state));

            while (state.Status != GameStatus.GameOver)
            {
                if (state.Status == GameStatus.LevelComplete)
                {
                    if (state.Tick >= request.EndTick) break;
                    state = Game.AdvanceToNextLevel(state);
                    checkpoints.Add(("levelStart", state));
                    continue;
                }

                while (next < request.Inputs.Count && request.Inputs[next].Tick == state.Tick)
                {
                    RunInput input = request.Inputs[next];
                    StepResult placed = Game.PlaceWall(state, input.Col, input.Row, input.Orientation);
                    foreach (GameEvent placedEvent in placed.Events) events.Add((state.Tick, placedEvent));
                    state = placed.State;
                    next++;
                }

                if (state.Tick >= request.EndTick) break;
                StepResult step = Game.Tick(state);
                foreach (GameEvent tickEvent in step.Events) events.Add((step.State.Tick, tickEvent));
                state = step.State;
                if (state.Tick % CheckpointEvery == 0) checkpoints.Add(("interval", state));
                if (state.Status == GameStatus.LevelComplete) checkpoints.Add(("levelComplete", state));
            }
            checkpoints.Add(("end", state));
        }
    }
}

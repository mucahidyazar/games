using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    /// <summary>Compares engine values with the exporter's JSON, bit for bit.</summary>
    internal static class SnapshotAssert
    {
        public static void State(GameState state, JToken expected, string where)
        {
            Assert.That(state.Status.ToString(), Is.EqualTo(ParityTests.Pascal((string)expected["status"])), $"{where}: status");
            Assert.That(state.Level, Is.EqualTo((int)expected["level"]), $"{where}: level");
            Assert.That(state.Lives, Is.EqualTo((int)expected["lives"]), $"{where}: lives");
            Assert.That(state.Score, Is.EqualTo((long)expected["score"]), $"{where}: score");
            Assert.That(state.LevelStartScore, Is.EqualTo((long)expected["levelStartScore"]), $"{where}: levelStartScore");
            Assert.That(state.LevelTicks, Is.EqualTo((int)expected["levelTicks"]), $"{where}: levelTicks");
            Assert.That(state.Tick, Is.EqualTo((int)expected["tick"]), $"{where}: tick");
            Assert.That(state.WallsLeft, Is.EqualTo(Fixtures.OptionalInt(expected["wallsLeft"])), $"{where}: wallsLeft");
            Assert.That(state.LevelLivesLost, Is.EqualTo((int)expected["levelLivesLost"]), $"{where}: levelLivesLost");
            Assert.That(state.LevelWallsUsed, Is.EqualTo((int)expected["levelWallsUsed"]), $"{where}: levelWallsUsed");
            Assert.That(state.RngSeed, Is.EqualTo((uint)expected["rngSeed"]), $"{where}: rngSeed");
            Assert.That(state.NextId, Is.EqualTo((int)expected["nextId"]), $"{where}: nextId");

            JToken grid = expected["grid"];
            Assert.That(state.Grid.Cols, Is.EqualTo((int)grid["cols"]), $"{where}: cols");
            Assert.That(state.Grid.Rows, Is.EqualTo((int)grid["rows"]), $"{where}: rows");
            Assert.That(state.Grid.SolidInteriorCount, Is.EqualTo((int)grid["solidInteriorCount"]), $"{where}: solid cells");
            Assert.That(state.Grid.Version, Is.EqualTo((int)grid["version"]), $"{where}: grid version");
            Assert.That(Fixtures.GridHash(state.Grid), Is.EqualTo((uint)grid["hash"]), $"{where}: grid cells");

            JToken[] balls = expected["balls"].ToArray();
            Assert.That(state.Balls.Count, Is.EqualTo(balls.Length), $"{where}: ball count");
            for (int index = 0; index < balls.Length; index++) Ball(state.Balls[index], balls[index], $"{where}: ball {index}");

            JToken[] walls = expected["walls"].ToArray();
            Assert.That(state.Walls.Count, Is.EqualTo(walls.Length), $"{where}: wall count");
            for (int index = 0; index < walls.Length; index++) Wall(state.Walls[index], walls[index], $"{where}: wall {index}");

            Stats(state.Stats, expected["stats"], $"{where}: stats");
            Result(state.LastResult, expected["lastResult"], $"{where}: lastResult");
        }

        public static void Ball(Ball ball, JToken expected, string where)
        {
            Assert.That(ball.Id, Is.EqualTo((int)expected["id"]), $"{where} id");
            Assert.That(Fixtures.Hex(ball.X), Is.EqualTo((string)expected["x"]), $"{where} x");
            Assert.That(Fixtures.Hex(ball.Y), Is.EqualTo((string)expected["y"]), $"{where} y");
            Assert.That(Fixtures.Hex(ball.Vx), Is.EqualTo((string)expected["vx"]), $"{where} vx");
            Assert.That(Fixtures.Hex(ball.Vy), Is.EqualTo((string)expected["vy"]), $"{where} vy");
            Assert.That(Fixtures.Hex(ball.Radius), Is.EqualTo((string)expected["radius"]), $"{where} radius");
            Assert.That(ball.Tier, Is.EqualTo((int)expected["tier"]), $"{where} tier");
        }

        public static void Wall(WallHalf wall, JToken expected, string where)
        {
            Assert.That(wall.Id, Is.EqualTo((int)expected["id"]), $"{where} id");
            Assert.That(wall.Orientation.ToString(), Is.EqualTo(ParityTests.Pascal((string)expected["orientation"])), $"{where} orientation");
            Assert.That(wall.Line, Is.EqualTo((int)expected["line"]), $"{where} line");
            Assert.That(wall.Origin, Is.EqualTo((int)expected["origin"]), $"{where} origin");
            Assert.That(wall.Direction, Is.EqualTo((int)expected["direction"]), $"{where} direction");
            Assert.That(Fixtures.Hex(wall.Length), Is.EqualTo((string)expected["length"]), $"{where} length");
        }

        public static void Stats(RunStats stats, JToken expected, string where)
        {
            Assert.That(stats.LevelsCleared, Is.EqualTo((int)expected["levelsCleared"]), $"{where} levelsCleared");
            Assert.That(stats.HighestLevel, Is.EqualTo((int)expected["highestLevel"]), $"{where} highestLevel");
            Assert.That(stats.WallsBuilt, Is.EqualTo((int)expected["wallsBuilt"]), $"{where} wallsBuilt");
            Assert.That(stats.WallsBroken, Is.EqualTo((int)expected["wallsBroken"]), $"{where} wallsBroken");
            Assert.That(OptionalHex(stats.TightestTrapPct), Is.EqualTo((string)expected["tightestTrapPct"]), $"{where} tightestTrapPct");
            Assert.That(Fixtures.Hex(stats.BiggestCapturePct), Is.EqualTo((string)expected["biggestCapturePct"]), $"{where} biggestCapturePct");
            Assert.That(OptionalHex(stats.BestClearPct), Is.EqualTo((string)expected["bestClearPct"]), $"{where} bestClearPct");
            Assert.That(stats.PerfectStreak, Is.EqualTo((int)expected["perfectStreak"]), $"{where} perfectStreak");
            Assert.That(stats.BestPerfectStreak, Is.EqualTo((int)expected["bestPerfectStreak"]), $"{where} bestPerfectStreak");
            Assert.That(OptionalHex(stats.FastestClearRatio), Is.EqualTo((string)expected["fastestClearRatio"]), $"{where} fastestClearRatio");
            Assert.That(stats.MaxRegionsInOneWall, Is.EqualTo((int)expected["maxRegionsInOneWall"]), $"{where} maxRegionsInOneWall");
            Assert.That(stats.FewestWallsClear, Is.EqualTo(Fixtures.OptionalInt(expected["fewestWallsClear"])), $"{where} fewestWallsClear");
        }

        private static void Result(LevelResult result, JToken expected, string where)
        {
            if (expected == null || expected.Type == JTokenType.Null)
            {
                Assert.That(result, Is.Null, where);
                return;
            }
            Assert.That(result, Is.Not.Null, where);
            Assert.That(result.Level, Is.EqualTo((int)expected["level"]), $"{where} level");
            Assert.That(Fixtures.Hex(result.Percent), Is.EqualTo((string)expected["percent"]), $"{where} percent");
            Assert.That(result.ElapsedMs, Is.EqualTo((long)expected["elapsedMs"]), $"{where} elapsedMs");
            Assert.That(result.LivesLeft, Is.EqualTo((int)expected["livesLeft"]), $"{where} livesLeft");
            Assert.That(result.WallsLeft, Is.EqualTo(Fixtures.OptionalInt(expected["wallsLeft"])), $"{where} wallsLeft");
            Assert.That(result.AreaBonus, Is.EqualTo((long)expected["areaBonus"]), $"{where} areaBonus");
            Assert.That(result.LivesBonus, Is.EqualTo((long)expected["livesBonus"]), $"{where} livesBonus");
            Assert.That(result.TimeBonus, Is.EqualTo((long)expected["timeBonus"]), $"{where} timeBonus");
            Assert.That(result.WallBonus, Is.EqualTo((long)expected["wallBonus"]), $"{where} wallBonus");
            Assert.That(result.TotalBonus, Is.EqualTo((long)expected["totalBonus"]), $"{where} totalBonus");
        }

        public static void Event(GameEvent actual, JToken expected, string where)
        {
            string type = (string)expected["type"];
            switch (actual)
            {
                case WallStartedEvent started:
                    Assert.That(type, Is.EqualTo("wallStarted"), where);
                    Assert.That(started.Orientation.ToString(), Is.EqualTo(ParityTests.Pascal((string)expected["orientation"])), where);
                    Assert.That((started.Col, started.Row), Is.EqualTo(((int)expected["col"], (int)expected["row"])), where);
                    Assert.That(started.WallsLeft, Is.EqualTo(Fixtures.OptionalInt(expected["wallsLeft"])), where);
                    break;
                case WallRejectedEvent rejected:
                    Assert.That(type, Is.EqualTo("wallRejected"), where);
                    Assert.That(rejected.Reason.ToString(), Is.EqualTo(ParityTests.Pascal((string)expected["reason"])), where);
                    break;
                case WallCompletedEvent completed:
                    Assert.That(type, Is.EqualTo("wallCompleted"), where);
                    Wall(completed.Wall, expected["wall"], $"{where} wall");
                    Assert.That(completed.WallCells, Is.EqualTo((int)expected["wallCells"]), $"{where} wallCells");
                    Assert.That(completed.CapturedCells, Is.EqualTo((int)expected["capturedCells"]), $"{where} capturedCells");
                    Assert.That(completed.CapturedRegions, Is.EqualTo((int)expected["capturedRegions"]), $"{where} capturedRegions");
                    Assert.That(Fixtures.Hex(completed.PercentGained), Is.EqualTo((string)expected["percentGained"]), $"{where} percentGained");
                    Assert.That(completed.Points, Is.EqualTo((long)expected["points"]), $"{where} points");
                    Assert.That(completed.Runs.Count, Is.EqualTo((int)expected["runs"]), $"{where} runs");
                    Assert.That(RunsHash(completed.Runs), Is.EqualTo((uint)expected["runsHash"]), $"{where} runs hash");
                    break;
                case WallBrokenEvent broken:
                    Assert.That(type, Is.EqualTo("wallBroken"), where);
                    Wall(broken.Wall, expected["wall"], $"{where} wall");
                    Assert.That(broken.BallId, Is.EqualTo((int)expected["ballId"]), where);
                    Assert.That(broken.LivesLeft, Is.EqualTo((int)expected["livesLeft"]), where);
                    break;
                case LevelCompleteEvent complete:
                    Assert.That(type, Is.EqualTo("levelComplete"), where);
                    Assert.That(complete.Result.Level, Is.EqualTo((int)expected["level"]), where);
                    Assert.That(complete.Result.TotalBonus, Is.EqualTo((long)expected["totalBonus"]), where);
                    break;
                case GameOverEvent over:
                    Assert.That(type, Is.EqualTo("gameOver"), where);
                    Assert.That(over.Level, Is.EqualTo((int)expected["level"]), where);
                    Assert.That(over.Score, Is.EqualTo((long)expected["score"]), where);
                    Assert.That(over.Reason.ToString(), Is.EqualTo(ParityTests.Pascal((string)expected["reason"])), where);
                    break;
                default:
                    Assert.Fail($"{where}: unexpected event {actual}");
                    break;
            }
        }

        private static string OptionalHex(double? value) => value is double number ? Fixtures.Hex(number) : null;

        /// <summary>The exporter hashes each run as three bytes (row, start, end, each modulo 256).</summary>
        private static uint RunsHash(ReadOnlyArray<CellRun> runs)
        {
            unchecked
            {
                uint hash = 0x811C9DC5u;
                foreach (CellRun run in runs)
                {
                    foreach (int value in new[] { run.Row & 255, run.Start & 255, run.End & 255 })
                    {
                        hash ^= (uint)value;
                        hash *= 0x01000193u;
                    }
                }
                return hash;
            }
        }
    }
}

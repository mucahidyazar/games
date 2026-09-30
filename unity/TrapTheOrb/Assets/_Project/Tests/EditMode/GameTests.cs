using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class GameTests
    {
        private static Ball Still(int id, double x, double y) => new Ball(id, x, y, 0, 0, 3.3, 0);

        /// <summary>A running game on a small 40 × 20 field (684 interior cells) with the given orbs.</summary>
        private static GameState PlayingWith(Ball[] balls, GameMode mode = GameMode.Classic) =>
            Game.StartGame(Game.CreateRun(new CreateRunOptions(mode, 1))) with { Grid = Grid.Create(40, 20), Balls = ReadOnlyArray<Ball>.From(balls) };

        private static (GameState State, List<GameEvent> Events) RunTicks(GameState state, int ticks)
        {
            var events = new List<GameEvent>();
            for (int i = 0; i < ticks; i++)
            {
                StepResult result = Game.Tick(state);
                state = result.State;
                events.AddRange(result.Events);
            }
            return (state, events);
        }

        private static (GameState State, List<GameEvent> Events) Build(GameState state, int col, int row, Orientation orientation) =>
            RunTicks(Game.PlaceWall(state, col, row, orientation).State, (int)JsMath.Round(0.6 * Constants.TicksPerSecond));

        /// <summary>Walls off 75% of the field around a single orb parked on the left.</summary>
        private static (GameState Before, List<GameEvent> LastEvents, GameState State) CompleteLevel(GameState start)
        {
            (GameState first, _) = Build(start, 20, 10, Orientation.Vertical); // 50%
            (GameState second, _) = Build(first, 5, 5, Orientation.Horizontal); // ~63.9%
            (GameState third, List<GameEvent> events) = Build(second, 5, 15, Orientation.Horizontal); // 75%
            return (second, events, third);
        }

        private static GameState ParkedOrb(GameMode mode = GameMode.Classic) => PlayingWith(new[] { Still(1, 8, 10) }, mode);

        [Test]
        public void CreateRun_StartsClassicOnLevelOneWithASingleCalmOrbAndTwoLives()
        {
            GameState game = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1));

            Assert.That((game.Status, game.Level, game.Lives, game.Score, game.Tick), Is.EqualTo((GameStatus.Ready, 1, 2, 0L, 0)));
            Assert.That(game.Field, Is.EqualTo(FieldOrientation.Landscape));
            Assert.That(game.Balls.Count, Is.EqualTo(1));
            Assert.That(game.Balls[0].Tier, Is.Zero);
            Assert.That(game.Walls.Count, Is.Zero);
            Assert.That((game.Grid.Cols, game.Grid.Rows), Is.EqualTo((300, 150)));
            Assert.That(game.Stats.HighestLevel, Is.EqualTo(1));
        }

        [Test]
        public void CreateRun_BuildsTheSameLayoutTurnedOnItsSideForPortraitScreens()
        {
            GameState landscape = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 5) { Level = 9 });
            GameState portrait = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 5) { Level = 9, Field = FieldOrientation.Portrait });

            Assert.That((portrait.Grid.Cols, portrait.Grid.Rows), Is.EqualTo((150, 300)));
            Assert.That(portrait.Balls.ToArray(), Is.EqualTo(landscape.Balls.Select(Balls.Transpose).ToArray()));
        }

        [Test]
        public void CreateRun_CanContinueASavedRunAtALaterLevelWithItsScore()
        {
            GameState game = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1) { Level = 9, Score = 4200 });

            Assert.That((game.Level, game.Lives, game.Score, game.LevelStartScore), Is.EqualTo((9, 5, 4200L, 4200L)));
            Assert.That(game.Balls.Select(ball => ball.Tier), Is.EqualTo(new[] { 1, 1, 1, 1 }));
        }

        [Test]
        public void CreateRun_IgnoresNegativeOrFractionalCarriedScores()
        {
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1) { Score = -50 }).Score, Is.Zero);
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1) { Score = 99.7 }).Score, Is.EqualTo(99));
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1) { Score = double.NaN }).Score, Is.Zero);
        }

        [Test]
        public void CreateRun_SetsUpTheRulesOfEachMode()
        {
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Hardcore, 1)).Lives, Is.EqualTo(1));
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.LimitedWalls, 1)).WallsLeft, Is.EqualTo(6));
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.TimeAttack, 1)).Config.TimeLimitTicks, Is.EqualTo(45 * Constants.TicksPerSecond));
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1)).WallsLeft, Is.Null);
            Assert.That(Game.CreateRun(new CreateRunOptions(GameMode.Custom, 1) { Custom = Modes.Preset(CustomPreset.Expert) }).Balls.Count, Is.EqualTo(8));
        }

        [Test]
        public void Tick_LetsOrbsRoamBeforeTheStartWithoutCountingTimeThenStartsFromTheSpawnPoint()
        {
            GameState ready = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 3) { Level = 5 });

            GameState preview = RunTicks(ready, 30).State;
            GameState started = Game.StartGame(preview);

            Assert.That(preview.Balls.ToArray(), Is.Not.EqualTo(ready.Balls.ToArray()));
            Assert.That(preview.Tick, Is.Zero);
            Assert.That((started.Status, started.Tick, started.LevelTicks), Is.EqualTo((GameStatus.Playing, 0, 0)));
            Assert.That(started.Balls.ToArray(), Is.EqualTo(ready.SpawnBalls.ToArray()));
        }

        [Test]
        public void Tick_CountsTicksWhilePlayingAndFreezesWhilePaused()
        {
            GameState playing = Game.StartGame(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 3)));
            GameState paused = Game.PauseGame(playing);

            Assert.That((RunTicks(playing, 3).State.Tick, RunTicks(playing, 3).State.LevelTicks), Is.EqualTo((3, 3)));
            StepResult frozen = Game.Tick(paused);
            Assert.That(frozen.State, Is.SameAs(paused));
            Assert.That(frozen.Events, Is.Empty);
        }

        [Test]
        public void Tick_IsDeterministicForAGivenSeed()
        {
            GameState a = RunTicks(Game.StartGame(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 9) { Level = 12 })), 240).State;
            GameState b = RunTicks(Game.StartGame(Game.CreateRun(new CreateRunOptions(GameMode.Classic, 9) { Level = 12 })), 240).State;

            Assert.That(a.Balls.ToArray(), Is.EqualTo(b.Balls.ToArray()));
            Assert.That((a.Tick, a.Score, a.RngSeed), Is.EqualTo((b.Tick, b.Score, b.RngSeed)));
        }

        [Test]
        public void PlaceWall_OnlyAcceptsWallsWhilePlaying()
        {
            GameState ready = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1));

            StepResult result = Game.PlaceWall(ready, 5, 5, Orientation.Vertical);

            Assert.That(result.State, Is.SameAs(ready));
            Assert.That(result.Events, Is.EqualTo(new[] { new WallRejectedEvent(WallRejectReason.NotPlaying) }));
        }

        [Test]
        public void PlaceWall_RejectsWallsOnSolidCells()
        {
            Assert.That(Game.PlaceWall(ParkedOrb(), 0, 5, Orientation.Vertical).Events, Is.EqualTo(new[] { new WallRejectedEvent(WallRejectReason.Solid) }));
        }

        [Test]
        public void PlaceWall_AllowsOnlyOneWallUnderConstructionAtATime()
        {
            StepResult started = Game.PlaceWall(ParkedOrb(), 20, 10, Orientation.Vertical);

            StepResult second = Game.PlaceWall(started.State, 30, 10, Orientation.Horizontal);

            Assert.That(started.Events, Is.EqualTo(new[] { new WallStartedEvent(Orientation.Vertical, 20, 10, null) }));
            Assert.That(started.State.Walls.Count, Is.EqualTo(2));
            Assert.That((started.State.LevelWallsUsed, started.State.Stats.WallsBuilt), Is.EqualTo((1, 1)));
            Assert.That(second.Events, Is.EqualTo(new[] { new WallRejectedEvent(WallRejectReason.Busy) }));
        }

        [Test]
        public void PlaceWall_SpendsTheLimitedWallsBudgetAndRefusesWallsOnceItIsEmpty()
        {
            GameState playing = ParkedOrb(GameMode.LimitedWalls) with { WallsLeft = 3 };

            StepResult started = Game.PlaceWall(playing, 20, 10, Orientation.Vertical);

            Assert.That(started.State.WallsLeft, Is.EqualTo(2));
            Assert.That(((WallStartedEvent)started.Events[0]).WallsLeft, Is.EqualTo(2));
            Assert.That(Game.PlaceWall(playing with { WallsLeft = 0 }, 20, 10, Orientation.Vertical).Events,
                Is.EqualTo(new[] { new WallRejectedEvent(WallRejectReason.NoWalls) }));
        }

        [Test]
        public void Walls_CaptureRegionsWithoutOrbsAndScoreThem()
        {
            (GameState state, List<GameEvent> events) = Build(ParkedOrb(), 20, 10, Orientation.Vertical);

            WallCompletedEvent[] completed = events.OfType<WallCompletedEvent>().ToArray();
            Assert.That(completed.Length, Is.EqualTo(2));
            Assert.That(completed.Sum(e => e.CapturedCells), Is.EqualTo(18 * 18));
            Assert.That(completed.Sum(e => e.CapturedRegions), Is.EqualTo(1));
            Assert.That(state.Grid.CapturedPercent, Is.EqualTo(50).Within(0.01));
            Assert.That(state.Walls.Count, Is.Zero);
            Assert.That(state.Score, Is.EqualTo(completed.Sum(e => e.Points)));
            Assert.That(state.Stats.BiggestCapturePct, Is.GreaterThan(45));
            Assert.That(state.Stats.TightestTrapPct, Is.EqualTo(50).Within(0.5));
        }

        [Test]
        public void Walls_AHalfThatAnOrbTouchesBreaksAndCostsALife()
        {
            (GameState state, List<GameEvent> events) = Build(PlayingWith(new[] { Still(1, 20.5, 14) }), 20, 4, Orientation.Vertical);

            WallBrokenEvent[] broken = events.OfType<WallBrokenEvent>().ToArray();
            Assert.That(broken.Length, Is.EqualTo(1));
            Assert.That(broken[0].Wall.Direction, Is.EqualTo(1));
            Assert.That(broken[0].LivesLeft, Is.EqualTo(1));
            Assert.That((state.Lives, state.Status, state.LevelLivesLost, state.Stats.WallsBroken), Is.EqualTo((1, GameStatus.Playing, 1, 1)));
        }

        [Test]
        public void Walls_BreakingBothHalvesInTheSameInstantCostsASingleLife()
        {
            (GameState state, List<GameEvent> events) = Build(PlayingWith(new[] { Still(1, 20.5, 10.5) }), 20, 10, Orientation.Vertical);

            Assert.That(events.OfType<WallBrokenEvent>().Count(), Is.EqualTo(2));
            Assert.That(state.Lives, Is.EqualTo(1));
        }

        [Test]
        public void Walls_LosingTheLastLifeEndsTheGame()
        {
            (GameState state, List<GameEvent> events) = Build(PlayingWith(new[] { Still(1, 20.5, 14) }) with { Lives = 1 }, 20, 4, Orientation.Vertical);

            Assert.That((state.Status, state.Lives, state.Walls.Count, state.GameOverReason), Is.EqualTo((GameStatus.GameOver, 0, 0, (GameOverReason?)GameOverReason.Lives)));
            Assert.That(events.OfType<GameOverEvent>(), Is.EqualTo(new[] { new GameOverEvent(1, state.Score, GameOverReason.Lives) }));
        }

        [Test]
        public void Walls_ZenNeverRunsOutOfLives()
        {
            GameState state = PlayingWith(new[] { Still(1, 20.5, 14) }, GameMode.Zen);
            foreach (int col in new[] { 18, 19, 21, 22 }) state = Build(state, col, 4, Orientation.Vertical).State;

            Assert.That((state.Status, state.Lives, state.LevelLivesLost), Is.EqualTo((GameStatus.Playing, 2, 4)));
        }

        [Test]
        public void TimeAttack_EndsTheRunWhenTheCountdownRunsOut()
        {
            GameState playing = ParkedOrb(GameMode.TimeAttack);
            GameState timed = playing with { Config = playing.Config with { TimeLimitTicks = 60 } };

            (GameState state, List<GameEvent> events) = RunTicks(timed, 61);

            Assert.That((state.Status, state.GameOverReason, state.LevelTicks), Is.EqualTo((GameStatus.GameOver, (GameOverReason?)GameOverReason.Time, 60)));
            Assert.That(events.OfType<GameOverEvent>().Single().Reason, Is.EqualTo(GameOverReason.Time));
        }

        [Test]
        public void LimitedWalls_EndsTheRunWhenTheLastWallFallsShortOfTheTarget()
        {
            (GameState state, _) = Build(ParkedOrb(GameMode.LimitedWalls) with { WallsLeft = 1 }, 20, 10, Orientation.Vertical);

            Assert.That((state.Status, state.GameOverReason, state.WallsLeft), Is.EqualTo((GameStatus.GameOver, (GameOverReason?)GameOverReason.Walls, (int?)0)));
        }

        [Test]
        public void Level_CompletesAtSeventyFivePercentAndPaysOutTheLevelBonus()
        {
            (GameState before, List<GameEvent> lastEvents, GameState state) = CompleteLevel(ParkedOrb());

            LevelCompleteEvent complete = lastEvents.OfType<LevelCompleteEvent>().Single();
            long lastWallPoints = lastEvents.OfType<WallCompletedEvent>().Sum(e => e.Points);
            Assert.That(before.Status, Is.EqualTo(GameStatus.Playing));
            Assert.That((state.Status, state.Walls.Count), Is.EqualTo((GameStatus.LevelComplete, 0)));
            Assert.That((complete.Result.Level, complete.Result.LivesLeft, complete.Result.WallsLeft), Is.EqualTo((1, 2, (int?)null)));
            Assert.That((complete.Result.AreaBonus, complete.Result.LivesBonus), Is.EqualTo((0L, 200L)));
            Assert.That(complete.Result.Percent, Is.EqualTo(75).Within(0.01));
            Assert.That(complete.Result.TimeBonus, Is.GreaterThan(0));
            Assert.That(state.LastResult, Is.EqualTo(complete.Result));
            Assert.That(state.Score, Is.EqualTo(before.Score + lastWallPoints + complete.Result.TotalBonus));
            Assert.That((state.Stats.LevelsCleared, state.Stats.BestPerfectStreak), Is.EqualTo((1, 1)));
        }

        [Test]
        public void Level_PaysABonusForWallsLeftOverInLimitedWalls()
        {
            GameState state = CompleteLevel(ParkedOrb(GameMode.LimitedWalls) with { WallsLeft = 5 }).State;

            Assert.That((state.LastResult.WallsLeft, state.LastResult.WallBonus), Is.EqualTo(((int?)2, 100L)));
        }

        [Test]
        public void Level_MovesOnToTheNextLevelWithThePlannedOrbsAndFreshLives()
        {
            GameState state = CompleteLevel(ParkedOrb()).State;

            GameState next = Game.AdvanceToNextLevel(state);

            Assert.That((next.Status, next.Level, next.Lives, next.Score, next.LevelStartScore, next.LevelTicks, next.Tick),
                Is.EqualTo((GameStatus.Playing, 2, 3, state.Score, state.Score, 0, state.Tick)));
            Assert.That(next.LastResult, Is.Null);
            Assert.That(next.Balls.Count, Is.EqualTo(2));
            Assert.That((next.Grid.Cols, next.Grid.Rows, next.Grid.CapturedPercent), Is.EqualTo((300, 150, 0.0)));
            Assert.That((next.Stats.HighestLevel, next.Stats.LevelsCleared), Is.EqualTo((2, 1)));
        }

        [Test]
        public void Level_CarriesTheSingleHardcoreLifeIntoTheNextLevel()
        {
            GameState state = CompleteLevel(ParkedOrb(GameMode.Hardcore) with { Lives = 1 }).State;

            Assert.That(Game.AdvanceToNextLevel(state).Lives, Is.EqualTo(1));
        }

        [Test]
        public void Level_IgnoresNextLevelRequestsUntilTheLevelIsComplete()
        {
            GameState playing = ParkedOrb();

            Assert.That(Game.AdvanceToNextLevel(playing), Is.SameAs(playing));
        }

        [Test]
        public void Level_RestartsTheCurrentLevelWithTheScoreItStartedWith()
        {
            GameState playing = ParkedOrb() with { Score = 999, LevelStartScore = 100, Lives = 1, LevelTicks = 500 };

            GameState restarted = Game.RestartLevel(playing);

            Assert.That((restarted.Status, restarted.Level, restarted.Score, restarted.Lives, restarted.LevelTicks), Is.EqualTo((GameStatus.Playing, 1, 100L, 2, 0)));
        }

        [Test]
        public void PauseAndResume_OnlyWorkFromTheMatchingStates()
        {
            GameState ready = Game.CreateRun(new CreateRunOptions(GameMode.Classic, 1));
            GameState playing = Game.StartGame(ready);

            Assert.That(Game.PauseGame(ready), Is.SameAs(ready));
            Assert.That(Game.ResumeGame(playing), Is.SameAs(playing));
            Assert.That(Game.PauseGame(playing).Status, Is.EqualTo(GameStatus.Paused));
            Assert.That(Game.ResumeGame(Game.PauseGame(playing)).Status, Is.EqualTo(GameStatus.Playing));
            Assert.That(Game.StartGame(playing), Is.SameAs(playing));
        }

        [Test]
        public void Simulation_NeverLetsAnOrbSinkIntoAWallDuringChaoticPlay()
        {
            CustomSettings custom = Modes.Preset(CustomPreset.Expert) with { Lives = null, Walls = null, TimeLimitSeconds = null };
            GameState state = Game.StartGame(Game.CreateRun(new CreateRunOptions(GameMode.Custom, 2024) { Custom = custom }));
            uint seed = 77;

            for (int frame = 0; frame < 4000; frame++)
            {
                if (frame % 20 == 0)
                {
                    (double rx, uint s1) = Rng.Next(seed);
                    (double ry, uint s2) = Rng.Next(s1);
                    (double ro, uint s3) = Rng.Next(s2);
                    seed = s3;
                    int col = (int)(rx * state.Grid.Cols);
                    int row = (int)(ry * state.Grid.Rows);
                    state = Game.PlaceWall(state, col, row, ro < 0.5 ? Orientation.Vertical : Orientation.Horizontal).State;
                }

                state = Game.Tick(state).State;
                if (state.Status == GameStatus.LevelComplete) state = Game.AdvanceToNextLevel(state);

                foreach (Ball ball in state.Balls)
                {
                    Assert.That(Geometry.CircleOverlapsSolid(state.Grid, ball.X, ball.Y, ball.Radius), Is.False, $"frame {frame}");
                }
            }
        }
    }
}

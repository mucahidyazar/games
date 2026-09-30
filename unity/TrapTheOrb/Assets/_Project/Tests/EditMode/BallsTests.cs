using System;
using System.Linq;
using NUnit.Framework;

namespace TrapTheOrb.Engine.Tests
{
    public sealed class BallsTests
    {
        private static Ball MakeBall(int id = 1, double x = 10, double y = 10, double vx = 10, double vy = 10, double radius = 2) =>
            new Ball(id, x, y, vx, vy, radius, 0);

        private static ReadOnlyArray<Ball> Many(params Ball[] balls) => ReadOnlyArray<Ball>.From(balls);

        private static double Distance(Ball a, Ball b) => Math.Sqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y));

        [Test]
        public void Move_TravelsAlongItsVelocityInOpenSpace()
        {
            Ball moved = Balls.Move(MakeBall(), Grid.Create(40, 30), 0.1);

            Assert.That(moved.X, Is.EqualTo(11).Within(1e-9));
            Assert.That(moved.Y, Is.EqualTo(11).Within(1e-9));
            Assert.That((moved.Vx, moved.Vy), Is.EqualTo((10.0, 10.0)));
        }

        [Test]
        public void Move_BouncesOffTheBorderByReversingTheBlockedAxisOnly()
        {
            Ball moved = Balls.Move(MakeBall(x: 36.5), Grid.Create(40, 30), 0.1); // right edge at 38.5, border at 39

            Assert.That(moved.Vx, Is.EqualTo(-10));
            Assert.That(moved.Vy, Is.EqualTo(10));
            Assert.That(moved.X, Is.EqualTo(36.5));
            Assert.That(moved.Y, Is.EqualTo(11).Within(1e-9));
        }

        [Test]
        public void Move_BouncesOffWallsBuiltInsideTheField()
        {
            Grid walled = Grid.Create(40, 30).Fill(Enumerable.Range(0, 28).Select(i => (i + 1) * 40 + 20).ToArray(), CellState.Wall);

            Ball moved = Balls.Move(MakeBall(x: 17.5, y: 15), walled, 0.1);

            Assert.That(moved.Vx, Is.EqualTo(-10));
        }

        [Test]
        public void Move_NeverOverlapsSolidCellsEvenAfterThousandsOfSteps()
        {
            int[] cells = Enumerable.Range(0, 20).Select(i => (i + 1) * 40 + 15).Concat(Enumerable.Range(0, 14).Select(i => 12 * 40 + 16 + i)).ToArray();
            Grid walled = Grid.Create(40, 30).Fill(cells, CellState.Wall);
            Ball ball = MakeBall(x: 25, y: 20, vx: 37, vy: -41, radius: 3.3);

            for (int i = 0; i < 5000; i++)
            {
                ball = Balls.Move(ball, walled, 1.0 / 120);
                Assert.That(Geometry.CircleOverlapsSolid(walled, ball.X, ball.Y, ball.Radius), Is.False, $"step {i}");
            }
        }

        [Test]
        public void ResolvePairs_SwapsVelocityComponentsOfBallsThatApproachEachOther()
        {
            ReadOnlyArray<Ball> next = Balls.ResolvePairs(Many(MakeBall(1, 10, 10, 5, 5), MakeBall(2, 13, 10, -5, 5)));

            Assert.That((next[0].Vx, next[1].Vx), Is.EqualTo((-5.0, 5.0)));
            Assert.That((next[0].Vy, next[1].Vy), Is.EqualTo((5.0, 5.0)));
        }

        [Test]
        public void ResolvePairs_PushesApartOverlappingBallsThatMoveInLockstep()
        {
            ReadOnlyArray<Ball> next = Balls.ResolvePairs(Many(MakeBall(1, 10, 10, 5, 5), MakeBall(2, 11, 10.5, 5, 5)));

            Assert.That((next[0].Vx, next[1].Vx), Is.EqualTo((-5.0, 5.0)));
            Assert.That((next[0].Vy, next[1].Vy), Is.EqualTo((5.0, 5.0)));
        }

        [Test]
        public void ResolvePairs_SeparatesLockstepBallsAlongTheAxisTheyAreMostOffsetOn()
        {
            ReadOnlyArray<Ball> next = Balls.ResolvePairs(Many(MakeBall(1, 10, 12, -5, 5), MakeBall(2, 10, 10, -5, 5)));

            Assert.That((next[0].Vy, next[1].Vy), Is.EqualTo((5.0, -5.0)));
            Assert.That((next[0].Vx, next[1].Vx), Is.EqualTo((-5.0, -5.0)));
        }

        [Test]
        public void ResolvePairs_NeverLetsTwoLockstepBallsStayGluedTogether()
        {
            Grid grid = Grid.Create(60, 40);
            ReadOnlyArray<Ball> balls = Balls.ResolvePairs(Many(MakeBall(1, 20, 20, 40, 40, 3.3), MakeBall(2, 21, 20, 40, 40, 3.3)));

            for (int i = 0; i < 60; i++)
            {
                balls = Balls.ResolvePairs(ReadOnlyArray<Ball>.From(balls.Select(ball => Balls.Move(ball, grid, 1.0 / 120))));
            }

            Assert.That(Distance(balls[0], balls[1]), Is.GreaterThan(6.6));
        }

        [Test]
        public void ResolvePairs_LeavesSeparatingOrDistantBallsAlone()
        {
            ReadOnlyArray<Ball> balls = Many(MakeBall(1, 10, 10, -5, 5), MakeBall(2, 13, 10, 5, 5), MakeBall(3, 30, 30));

            Assert.That(Balls.ResolvePairs(balls).IsSameInstance(balls), Is.True);
        }

        [Test]
        public void Spawn_PlacesOneOrbPerSpeedWithThatSpeedAndTierInsideFreeSpace()
        {
            Grid grid = Grid.Create(120, 60);
            double[] speeds = { 40, 40, 48, 56, 40, 40, 40, 40 };
            int[] tiers = { 0, 0, 1, 2, 0, 0, 0, 0 };

            SpawnResult result = Balls.Spawn(new SpawnOptions(grid, ReadOnlyArray<double>.From(speeds), ReadOnlyArray<int>.From(tiers), 3.3, 42, 5));

            Assert.That(result.Balls.Select(ball => ball.Id), Is.EqualTo(new[] { 5, 6, 7, 8, 9, 10, 11, 12 }));
            for (int index = 0; index < result.Balls.Count; index++)
            {
                Ball ball = result.Balls[index];
                Assert.That(Geometry.CircleOverlapsSolid(grid, ball.X, ball.Y, ball.Radius), Is.False);
                Assert.That((Math.Abs(ball.Vx), Math.Abs(ball.Vy)), Is.EqualTo((speeds[index], speeds[index])));
                Assert.That(ball.Tier, Is.EqualTo(tiers[index]));
            }
        }

        [Test]
        public void Spawn_IsDeterministicForAGivenSeedAndAdvancesTheSeed()
        {
            SpawnResult Spawn(uint seed) => Balls.Spawn(new SpawnOptions(Grid.Create(120, 60),
                ReadOnlyArray<double>.From(new double[] { 40, 40, 40 }), ReadOnlyArray<int>.From(new[] { 0, 0, 0 }), 3.3, seed, 1));

            SpawnResult first = Spawn(7);
            SpawnResult second = Spawn(7);
            SpawnResult other = Spawn(8);

            Assert.That(second.Balls.ToArray(), Is.EqualTo(first.Balls.ToArray()));
            Assert.That(second.Seed, Is.EqualTo(first.Seed));
            Assert.That(first.Seed, Is.Not.EqualTo(7u));
            Assert.That(other.Balls.ToArray(), Is.Not.EqualTo(first.Balls.ToArray()));
        }

        [Test]
        public void Spawn_KeepsFreshlySpawnedBallsApartFromEachOther()
        {
            SpawnResult result = Balls.Spawn(new SpawnOptions(Grid.Create(120, 60),
                ReadOnlyArray<double>.From(Enumerable.Repeat(40.0, 12)), ReadOnlyArray<int>.From(Enumerable.Repeat(0, 12)), 3.3, 99, 1));

            for (int i = 0; i < result.Balls.Count; i++)
            {
                for (int j = i + 1; j < result.Balls.Count; j++)
                {
                    Assert.That(Distance(result.Balls[i], result.Balls[j]), Is.GreaterThan(result.Balls[i].Radius + result.Balls[j].Radius));
                }
            }
        }

        [Test]
        public void Transpose_MirrorsAnOrbAcrossTheDiagonalForPortraitFields()
        {
            Ball ball = MakeBall(x: 12, y: 3, vx: -5, vy: 9);

            Assert.That(Balls.Transpose(ball), Is.EqualTo(new Ball(1, 3, 12, 9, -5, 2, 0)));
        }
    }
}

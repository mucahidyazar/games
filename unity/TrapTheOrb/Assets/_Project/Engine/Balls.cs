using System;

namespace TrapTheOrb.Engine
{
    public static class Balls
    {
        private const int MaxSpawnAttempts = 400;

        /// <summary>Extra breathing room between freshly spawned balls and the walls, in cells.</summary>
        private const double SpawnMargin = 1;

        private const double HeadingThreshold = 0.5;

        /// <summary>
        /// Moves a ball one step, resolving each axis on its own: a blocked axis flips its velocity and keeps the
        /// previous coordinate, so a ball can never end up overlapping a solid cell.
        /// </summary>
        public static Ball Move(Ball ball, Grid grid, double dt)
        {
            double x = ball.X;
            double y = ball.Y;
            double vx = ball.Vx;
            double vy = ball.Vy;

            double nextX = x + vx * dt;
            if (Geometry.CircleOverlapsSolid(grid, nextX, y, ball.Radius)) vx = -vx;
            else x = nextX;

            double nextY = y + vy * dt;
            if (Geometry.CircleOverlapsSolid(grid, x, nextY, ball.Radius)) vy = -vy;
            else y = nextY;

            return ball.WithMotion(x, y, vx, vy);
        }

        /// <summary>
        /// Lets overlapping balls bounce off each other by exchanging the velocity components along which they
        /// approach. Keeps motion strictly diagonal. Returns the input when nothing collides.
        /// </summary>
        public static ReadOnlyArray<Ball> ResolvePairs(ReadOnlyArray<Ball> balls)
        {
            Ball[] next = null;

            for (int i = 0; i < balls.Count; i++)
            {
                for (int j = i + 1; j < balls.Count; j++)
                {
                    Ball a = next != null ? next[i] : balls[i];
                    Ball b = next != null ? next[j] : balls[j];

                    double dx = b.X - a.X;
                    double dy = b.Y - a.Y;
                    double reach = a.Radius + b.Radius;
                    if (dx * dx + dy * dy >= reach * reach) continue;

                    bool swapX = (b.Vx - a.Vx) * dx < 0;
                    bool swapY = (b.Vy - a.Vy) * dy < 0;
                    if (swapX || swapY)
                    {
                        next ??= balls.ToArray();
                        next[i] = a.WithVelocity(swapX ? b.Vx : a.Vx, swapY ? b.Vy : a.Vy);
                        next[j] = b.WithVelocity(swapX ? a.Vx : b.Vx, swapY ? a.Vy : b.Vy);
                        continue;
                    }

                    // Overlapping balls moving in lockstep would stay glued together forever.
                    if (a.Vx != b.Vx || a.Vy != b.Vy) continue;
                    next ??= balls.ToArray();
                    (next[i], next[j]) = SteerApart(a, b, dx, dy);
                }
            }

            return next == null ? balls : ReadOnlyArray<Ball>.Wrap(next);
        }

        /// <summary>
        /// Turns two lockstep balls away from each other along the axis they are most offset on. Only velocities
        /// change, so neither ball can be pushed into a wall.
        /// </summary>
        private static (Ball, Ball) SteerApart(Ball a, Ball b, double dx, double dy)
        {
            if (Math.Abs(dx) >= Math.Abs(dy))
            {
                int directionX = dx < 0 ? -1 : 1;
                return (a.WithVelocity(-directionX * Math.Abs(a.Vx), a.Vy), b.WithVelocity(directionX * Math.Abs(b.Vx), b.Vy));
            }

            int directionY = dy < 0 ? -1 : 1;
            return (a.WithVelocity(a.Vx, -directionY * Math.Abs(a.Vy)), b.WithVelocity(b.Vx, directionY * Math.Abs(b.Vy)));
        }

        /// <summary>Places one ball per speed on free space, with random diagonal headings.</summary>
        public static SpawnResult Spawn(SpawnOptions options)
        {
            Grid grid = options.Grid;
            double radius = options.Radius;
            uint currentSeed = options.Seed;
            double Draw()
            {
                (double value, uint next) = Rng.Next(currentSeed);
                currentSeed = next;
                return value;
            }

            double pad = 1 + radius + SpawnMargin;
            double spanX = Math.Max(0, grid.Cols - pad * 2);
            double spanY = Math.Max(0, grid.Rows - pad * 2);
            var balls = new Ball[options.Speeds.Count];

            for (int index = 0; index < balls.Length; index++)
            {
                double x = grid.Cols / 2.0;
                double y = grid.Rows / 2.0;

                for (int attempt = 0; attempt < MaxSpawnAttempts; attempt++)
                {
                    double candidateX = pad + Draw() * spanX;
                    double candidateY = pad + Draw() * spanY;
                    if (Geometry.CircleOverlapsSolid(grid, candidateX, candidateY, radius + SpawnMargin)) continue;

                    bool crowded = IsCrowded(balls, index, candidateX, candidateY, radius);
                    x = candidateX;
                    y = candidateY;
                    if (!crowded) break;
                }

                double speed = options.Speeds[index];
                double vx = Draw() < HeadingThreshold ? -speed : speed;
                double vy = Draw() < HeadingThreshold ? -speed : speed;
                int tier = index < options.Tiers.Count ? options.Tiers[index] : 0;
                balls[index] = new Ball(options.FirstId + index, x, y, vx, vy, radius, tier);
            }

            return new SpawnResult(ReadOnlyArray<Ball>.Wrap(balls), currentSeed);
        }

        /// <summary>
        /// Squared distances only: a square root may round differently between runtimes, and every runtime must
        /// reproduce the exact same spawn positions.
        /// </summary>
        private static bool IsCrowded(Ball[] placed, int count, double x, double y, double radius)
        {
            for (int i = 0; i < count; i++)
            {
                Ball other = placed[i];
                double reach = other.Radius + radius + SpawnMargin;
                double dx = other.X - x;
                double dy = other.Y - y;
                if (dx * dx + dy * dy <= reach * reach) return true;
            }
            return false;
        }

        /// <summary>Mirrors a ball across the diagonal: the portrait field is the landscape field turned on its side.</summary>
        public static Ball Transpose(Ball ball) => new Ball(ball.Id, ball.Y, ball.X, ball.Vy, ball.Vx, ball.Radius, ball.Tier);
    }

    public sealed record SpawnOptions(
        Grid Grid,
        ReadOnlyArray<double> Speeds,
        ReadOnlyArray<int> Tiers,
        double Radius,
        uint Seed,
        int FirstId);

    public readonly struct SpawnResult
    {
        public SpawnResult(ReadOnlyArray<Ball> balls, uint seed)
        {
            Balls = balls;
            Seed = seed;
        }

        public ReadOnlyArray<Ball> Balls { get; }
        public uint Seed { get; }
    }
}

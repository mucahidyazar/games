using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Rendering
{
    /// <summary>A recent position of an orb, in cells, with the app time it was seen.</summary>
    public readonly struct TrailSample
    {
        public TrailSample(double x, double y, double t)
        {
            X = x;
            Y = y;
            T = t;
        }

        public double X { get; }
        public double Y { get; }
        public double T { get; }
    }

    /// <summary>
    /// The recent path of every orb, for the comet tails (renderer.ts updateTrails). A render cache updated every
    /// frame, so it reuses its buffers instead of allocating new ones.
    /// </summary>
    public sealed class Trails
    {
        public const double LifetimeMs = 280;
        public const int MaxSamples = 18;
        private const double MinMove = 0.05;

        private static readonly IReadOnlyList<TrailSample> Empty = Array.Empty<TrailSample>();
        private readonly Dictionary<int, List<TrailSample>> samples = new Dictionary<int, List<TrailSample>>();
        private readonly Stack<List<TrailSample>> spare = new Stack<List<TrailSample>>();
        private readonly List<int> gone = new List<int>();
        private readonly HashSet<int> seen = new HashSet<int>();

        public IReadOnlyList<TrailSample> For(int ballId) =>
            samples.TryGetValue(ballId, out List<TrailSample> trail) ? trail : Empty;

        public void Update(ReadOnlyArray<Ball> balls, double now)
        {
            seen.Clear();
            foreach (Ball ball in balls)
            {
                seen.Add(ball.Id);
                if (!samples.TryGetValue(ball.Id, out List<TrailSample> trail))
                {
                    trail = spare.Count > 0 ? spare.Pop() : new List<TrailSample>(MaxSamples + 1);
                    samples[ball.Id] = trail;
                }

                TrailSample? last = trail.Count > 0 ? trail[trail.Count - 1] : (TrailSample?)null;
                bool moved = last == null || Math.Abs(last.Value.X - ball.X) + Math.Abs(last.Value.Y - ball.Y) > MinMove;
                if (moved) trail.Add(new TrailSample(ball.X, ball.Y, now));

                int expired = 0;
                while (expired < trail.Count && now - trail[expired].T > LifetimeMs) expired++;
                int excess = Math.Max(0, trail.Count - expired - MaxSamples);
                if (expired + excess > 0) trail.RemoveRange(0, expired + excess);
            }

            gone.Clear();
            foreach (int id in samples.Keys)
            {
                if (!seen.Contains(id)) gone.Add(id);
            }
            foreach (int id in gone)
            {
                List<TrailSample> trail = samples[id];
                samples.Remove(id);
                trail.Clear();
                spare.Push(trail);
            }
        }

        public void Clear()
        {
            foreach (List<TrailSample> trail in samples.Values)
            {
                trail.Clear();
                spare.Push(trail);
            }
            samples.Clear();
        }
    }
}

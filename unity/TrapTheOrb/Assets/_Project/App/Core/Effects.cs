using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Core
{
    /// <summary>A short-lived visual on the board. Times are in milliseconds of the app clock.</summary>
    public abstract record Effect(double StartedAt)
    {
        public abstract double DurationMs { get; }

        public bool IsOver(double now) => now - StartedAt >= DurationMs;
    }

    /// <summary>Freshly captured cells flash in the building colour.</summary>
    public sealed record CaptureFlash(ReadOnlyArray<CellRun> Runs, double StartedAt) : Effect(StartedAt)
    {
        public override double DurationMs => 700;
    }

    /// <summary>A wall half an orb broke, flashing coral and growing.</summary>
    public sealed record BrokenWall(Rect Rect, double StartedAt) : Effect(StartedAt)
    {
        public override double DurationMs => 560;
    }

    /// <summary>"+120" rising from the captured area.</summary>
    public sealed record PointsPopup(double X, double Y, long Value, double StartedAt) : Effect(StartedAt)
    {
        public override double DurationMs => 1100;
    }

    public sealed record ParticleBurst(IReadOnlyList<Particle> Particles, double StartedAt) : Effect(StartedAt)
    {
        public override double DurationMs => Core.Particles.LifetimeMs;
    }

    /// <summary>A confetti-like speck thrown up when territory is captured. Units: cells and cells per second.</summary>
    public readonly struct Particle
    {
        public Particle(double x, double y, double vx, double vy, double size, int tone)
        {
            X = x;
            Y = y;
            Vx = vx;
            Vy = vy;
            Size = size;
            Tone = tone;
        }

        public double X { get; }
        public double Y { get; }
        public double Vx { get; }
        public double Vy { get; }
        public double Size { get; }

        /// <summary>Index into the particle colours (teal, mint, amber).</summary>
        public int Tone { get; }
    }

    /// <summary>render/particles.ts.</summary>
    public static class Particles
    {
        public const double LifetimeMs = 850;
        public const int MaxParticles = 42;
        private const int MinParticles = 8;
        private const int CellsPerParticle = 260;
        private const double Gravity = 70;
        private const int ToneCount = 3;

        /// <summary>
        /// Scatters particles over the captured runs, weighted by run length, each flying up and out.
        /// <paramref name="random"/> returns values in [0, 1).
        /// </summary>
        public static IReadOnlyList<Particle> ForCapture(ReadOnlyArray<CellRun> runs, Func<double> random)
        {
            int total = 0;
            foreach (CellRun run in runs) total += run.End - run.Start;
            if (total == 0) return Array.Empty<Particle>();

            int count = Math.Min(MaxParticles, MinParticles + total / CellsPerParticle);
            var particles = new List<Particle>(count);
            for (int i = 0; i < count; i++)
            {
                double target = random() * total;
                CellRun chosen = runs[runs.Count - 1];
                foreach (CellRun candidate in runs)
                {
                    target -= candidate.End - candidate.Start;
                    if (target < 0)
                    {
                        chosen = candidate;
                        break;
                    }
                }

                double angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.9;
                double speed = 18 + random() * 26;
                double x = chosen.Start + random() * (chosen.End - chosen.Start);
                double y = chosen.Row + random();
                double size = 0.6 + random() * 0.9;
                particles.Add(new Particle(x, y, Math.Cos(angle) * speed, Math.Sin(angle) * speed, size, i % ToneCount));
            }
            return particles;
        }

        /// <summary>Where a particle is, and how visible, <paramref name="elapsedMs"/> after it was spawned.</summary>
        public static (double X, double Y, double Alpha) At(Particle particle, double elapsedMs)
        {
            double t = Math.Max(0, elapsedMs) / 1000;
            double life = Math.Min(1, Math.Max(0, elapsedMs / LifetimeMs));
            return (particle.X + particle.Vx * t, particle.Y + particle.Vy * t + 0.5 * Gravity * t * t, 1 - life * life);
        }
    }
}

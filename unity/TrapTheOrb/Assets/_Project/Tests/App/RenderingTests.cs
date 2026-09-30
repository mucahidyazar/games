using System;
using System.Collections.Generic;
using NUnit.Framework;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine;

namespace TrapTheOrb.App.Tests
{
    public sealed class LayoutTests
    {
        [Test]
        public void FitsTheGridCentredWithAUniformScale()
        {
            FieldLayout layout = FieldLayout.Fit(400, 1000, new GridDims(150, 300));

            Assert.That(layout.Scale, Is.EqualTo(400f / 150).Within(1e-5));
            Assert.That(layout.OffsetX, Is.EqualTo(0).Within(1e-4));
            Assert.That(layout.OffsetY, Is.EqualTo((1000 - 300 * (400f / 150)) / 2).Within(1e-3));
        }

        [Test]
        public void MapsPointsToCellsAndNothingOutside()
        {
            FieldLayout layout = FieldLayout.Fit(300, 150, new GridDims(300, 150));
            var dims = new GridDims(300, 150);

            Assert.That(layout.CellAt(dims, 10.5f, 20.9f), Is.EqualTo(new CellPoint(10, 20)));
            Assert.That(layout.CellAt(dims, -0.1f, 5), Is.Null);
            Assert.That(layout.CellAt(dims, 300, 5), Is.Null);
        }

        [Test]
        public void FindsTheCentreOfCapturedRuns()
        {
            var runs = ReadOnlyArray<CellRun>.From(new[] { new CellRun(0, 0, 4), new CellRun(1, 0, 4) });

            Assert.That(Runs.Centroid(runs), Is.EqualTo((2.0, 1.0)));
            Assert.That(Runs.Centroid(ReadOnlyArray<CellRun>.From(new CellRun[0])), Is.Null);
        }
    }

    public sealed class EffectTests
    {
        [Test]
        public void ThrowsParticlesUpFromTheCapturedArea()
        {
            var random = new System.Random(3);
            var runs = ReadOnlyArray<CellRun>.From(new[] { new CellRun(10, 20, 60) });

            IReadOnlyList<Particle> particles = Particles.ForCapture(runs, random.NextDouble);

            Assert.That(particles.Count, Is.EqualTo(8));
            foreach (Particle particle in particles)
            {
                Assert.That(particle.X, Is.InRange(20.0, 60.0));
                Assert.That(particle.Y, Is.InRange(10.0, 11.0));
                Assert.That(particle.Vy, Is.LessThan(0));
            }
        }

        [Test]
        public void CapsTheParticlesOfHugeCaptures()
        {
            var runs = ReadOnlyArray<CellRun>.From(new[] { new CellRun(0, 0, 300_000) });

            Assert.That(Particles.ForCapture(runs, () => 0.5).Count, Is.EqualTo(Particles.MaxParticles));
            Assert.That(Particles.ForCapture(ReadOnlyArray<CellRun>.From(new CellRun[0]), () => 0.5), Is.Empty);
        }

        [Test]
        public void FadesParticlesOutOverTheirLifetime()
        {
            var particle = new Particle(0, 0, 10, -20, 1, 0);

            Assert.That(Particles.At(particle, 0).Alpha, Is.EqualTo(1));
            Assert.That(Particles.At(particle, Particles.LifetimeMs).Alpha, Is.EqualTo(0));
            Assert.That(Particles.At(particle, 500).Y, Is.GreaterThan(-10), "gravity pulls the particle back down");
        }

        [Test]
        public void EffectsExpireAfterTheirDuration()
        {
            var flash = new CaptureFlash(ReadOnlyArray<CellRun>.From(new CellRun[0]), 1000);

            Assert.That(flash.IsOver(1699), Is.False);
            Assert.That(flash.IsOver(1700), Is.True);
        }

        [Test]
        public void ShakesBrieflyAfterABrokenWall()
        {
            var effects = new List<Effect> { new BrokenWall(new Engine.Rect(0, 0, 1, 1), 1000) };

            Assert.That(BoardRenderer.ShakeOffset(effects, 1010, false), Is.Not.EqualTo(Vector2.zero));
            Assert.That(BoardRenderer.ShakeOffset(effects, 1300, false), Is.EqualTo(Vector2.zero));
            Assert.That(BoardRenderer.ShakeOffset(effects, 1010, true), Is.EqualTo(Vector2.zero));
            Assert.That(BoardRenderer.ShakeOffset(new List<Effect>(), 1010, false), Is.EqualTo(Vector2.zero));
        }
    }

    public sealed class TrailTests
    {
        private static ReadOnlyArray<Ball> BallAt(double x, double y) =>
            ReadOnlyArray<Ball>.From(new[] { new Ball(1, x, y, 0, 0, 3.3, 0) });

        [Test]
        public void RecordsOnlyRealMovement()
        {
            var trails = new Trails();

            trails.Update(BallAt(10, 10), 0);
            trails.Update(BallAt(10.01, 10.01), 16);
            trails.Update(BallAt(11, 10), 32);

            Assert.That(trails.For(1).Count, Is.EqualTo(2));
        }

        [Test]
        public void ForgetsOldSamplesAndGoneOrbs()
        {
            var trails = new Trails();
            for (int frame = 0; frame < 40; frame++) trails.Update(BallAt(frame, 10), frame * 16);

            Assert.That(trails.For(1).Count, Is.LessThanOrEqualTo(Trails.MaxSamples));
            Assert.That(40 * 16 - trails.For(1)[0].T, Is.LessThanOrEqualTo(Trails.LifetimeMs + 16));

            trails.Update(ReadOnlyArray<Ball>.From(new Ball[0]), 700);
            Assert.That(trails.For(1), Is.Empty);
        }
    }

    public sealed class MotionTests
    {
        [Test]
        public void EasesOutExponentially()
        {
            Func<float, float> ease = UiMotion.EaseOutExpo;

            Assert.That(ease(0), Is.EqualTo(0));
            Assert.That(ease(1), Is.EqualTo(1));
            Assert.That(ease(0.2f), Is.GreaterThan(0.6f), "most of the motion happens early");
            Assert.That(ease(0.5f), Is.GreaterThan(ease(0.25f)));
        }

        [Test]
        public void SolvesALinearBezierToIdentity()
        {
            Func<float, float> linear = UiMotion.CubicBezier(0, 0, 1, 1);

            Assert.That(linear(0.37f), Is.EqualTo(0.37f).Within(1e-3));
        }
    }

    public sealed class ShadowTests
    {
        [Test]
        public void PaintsOnlyOutsideTheElement()
        {
            var shadow = new[] { new BoxShadow(0, 4, 12, 0, new Color32(0, 0, 0, 255)) };

            Texture2D texture = ShadowPainter.Paint(40, 20, 6, 22, shadow);
            try
            {
                float ppu = ShadowPainter.PixelsPerUnit;
                // Centre of the element: cut out. Just below it: shadow.
                Color32 inside = texture.GetPixel(Mathf.RoundToInt((22 + 20) * ppu), texture.height - Mathf.RoundToInt((22 + 10) * ppu));
                Color32 below = texture.GetPixel(Mathf.RoundToInt((22 + 20) * ppu), texture.height - Mathf.RoundToInt((22 + 23) * ppu));
                Color32 corner = texture.GetPixel(0, 0);

                Assert.That(inside.a, Is.EqualTo(0));
                Assert.That(below.a, Is.GreaterThan(40));
                Assert.That(corner.a, Is.LessThan(8));
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(texture);
            }
        }
    }
}

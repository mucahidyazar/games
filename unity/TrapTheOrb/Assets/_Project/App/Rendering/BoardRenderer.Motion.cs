using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.Rendering
{
    public sealed partial class BoardRenderer
    {
        private const float AnchorMinPx = 10;
        private const float AnchorMaxPx = 15;
        private const float AnchorCellFactor = 3.9f;
        private const float AnchorCornerRatio = 0.22f;
        private const float WideTrailRadii = 2.3f;
        private const float WideTrailAlpha = 0.1f;
        private const float NarrowTrailRadii = 1.35f;
        private const float NarrowTrailAlpha = 0.2f;

        private void DrawAim(MeshGenerationContext context, in BoardFrame frame, CellSpace cells)
        {
            if (!(frame.Aim is CellPoint aim)) return;
            if (!(Walls.PreviewExtent(frame.State.Grid, aim.Col, aim.Row, frame.Orientation) is Extent extent)) return;

            bool vertical = frame.Orientation == Orientation.Vertical;
            int line = vertical ? aim.Col : aim.Row;
            int origin = (vertical ? aim.Row : aim.Col) + 1;
            Color32 color = BoardPalette.WithAlpha(Palette.Building, AimAlpha);
            DashedLine(frame.Orientation, line, origin, extent.Start, 0, color, cells);
            DashedLine(frame.Orientation, line, origin, extent.End, 0, color, cells);
            builder.Flush(context);
            DrawAnchor(context, frame.Orientation, line, origin, AimAnchorAlpha, cells);
        }

        private void DrawBuildingWalls(MeshGenerationContext context, in BoardFrame frame, CellSpace cells)
        {
            ReadOnlyArray<WallHalf> walls = frame.State.Walls;
            if (walls.Count == 0) return;
            const float period = DashCells + GapCells;
            float offset = frame.ReducedMotion ? 0 : -(float)(frame.Now / 1000 * DashSpeedCells % period);
            foreach (WallHalf wall in walls)
            {
                DashedLine(wall.Orientation, wall.Line, wall.Origin, Walls.Tip(wall), offset, Palette.Building, cells);
            }
            builder.Flush(context);
            DrawAnchor(context, walls[0].Orientation, walls[0].Line, walls[0].Origin, 1, cells);
        }

        /// <summary>
        /// A one-cell-wide dashed line along a grid line, from <paramref name="from"/> to <paramref name="to"/> (in cells),
        /// with butt ends — the canvas setLineDash / lineDashOffset pattern, measured from the start of the path.
        /// </summary>
        private void DashedLine(Orientation orientation, int line, double from, double to, float dashOffset, Color32 color, CellSpace cells)
        {
            const float period = DashCells + GapCells;
            float length = (float)Math.Abs(to - from);
            float direction = to >= from ? 1 : -1;
            float centre = line + 0.5f;
            for (float start = -(((dashOffset % period) + period) % period); start < length; start += period)
            {
                float segmentStart = Math.Max(start, 0);
                float segmentEnd = Math.Min(start + DashCells, length);
                if (segmentEnd <= segmentStart) continue;
                double a = from + direction * segmentStart;
                double b = from + direction * segmentEnd;
                double low = Math.Min(a, b);
                float span = (float)Math.Abs(b - a) * cells.Scale;
                if (orientation == Orientation.Vertical)
                {
                    builder.Rect(cells.X(centre - 0.5), cells.Y(low), cells.Scale, span, color);
                }
                else
                {
                    builder.Rect(cells.X(low), cells.Y(centre - 0.5), span, cells.Scale, color);
                }
            }
        }

        /// <summary>The rounded square marking where a wall starts.</summary>
        private void DrawAnchor(MeshGenerationContext context, Orientation orientation, int line, int origin, float alpha, CellSpace cells)
        {
            float size = Mathf.Clamp(AnchorCellFactor * cells.Scale, AnchorMinPx, AnchorMaxPx);
            Vector2 centre = orientation == Orientation.Vertical ? cells.Point(line + 0.5, origin) : cells.Point(origin, line + 0.5);
            float x = centre.x - size / 2;
            float y = centre.y - size / 2;
            float r = size * AnchorCornerRatio;

            Painter2D painter = context.painter2D;
            painter.fillColor = BoardPalette.WithAlpha(Palette.Anchor, alpha);
            painter.BeginPath();
            painter.MoveTo(new Vector2(x + r, y));
            painter.LineTo(new Vector2(x + size - r, y));
            painter.ArcTo(new Vector2(x + size, y), new Vector2(x + size, y + r), r);
            painter.LineTo(new Vector2(x + size, y + size - r));
            painter.ArcTo(new Vector2(x + size, y + size), new Vector2(x + size - r, y + size), r);
            painter.LineTo(new Vector2(x + r, y + size));
            painter.ArcTo(new Vector2(x, y + size), new Vector2(x, y + size - r), r);
            painter.LineTo(new Vector2(x, y + r));
            painter.ArcTo(new Vector2(x, y), new Vector2(x + r, y), r);
            painter.ClosePath();
            painter.Fill();
        }

        /// <summary>Soft comet tails that follow each orb's recent path (two passes for a feathered edge).</summary>
        private void DrawTrails(ReadOnlyArray<Ball> balls, CellSpace cells)
        {
            foreach (Ball ball in balls)
            {
                IReadOnlyList<TrailSample> samples = trails.For(ball.Id);
                if (samples.Count < 3) continue;
                Color32 color = BoardPalette.TrailColors[Math.Min(ball.Tier, BoardPalette.TrailColors.Length - 1)];
                FillTrail(samples, ball.Radius * WideTrailRadii, WideTrailAlpha, color, cells);
                FillTrail(samples, ball.Radius * NarrowTrailRadii, NarrowTrailAlpha, color, cells);
            }
        }

        /// <summary>
        /// A tapering ribbon along the samples, fading from transparent at the oldest sample to
        /// <paramref name="maxAlpha"/> at the newest — the canvas linear gradient, evaluated per vertex.
        /// </summary>
        private void FillTrail(IReadOnlyList<TrailSample> samples, double maxWidth, float maxAlpha, Color32 color, CellSpace cells)
        {
            int count = samples.Count;
            TrailSample oldest = samples[0];
            TrailSample newest = samples[count - 1];
            double axisX = newest.X - oldest.X;
            double axisY = newest.Y - oldest.Y;
            double axisLengthSquared = axisX * axisX + axisY * axisY;
            // A zero-length canvas gradient paints nothing.
            if (axisLengthSquared <= 0) return;

            Vector2 previousLeft = default;
            Vector2 previousRight = default;
            Color32 previousLeftColor = default;
            Color32 previousRightColor = default;
            for (int i = 0; i < count; i++)
            {
                TrailSample prev = samples[Math.Max(0, i - 1)];
                TrailSample next = samples[Math.Min(count - 1, i + 1)];
                TrailSample current = samples[i];
                double dx = next.X - prev.X;
                double dy = next.Y - prev.Y;
                double length = Math.Sqrt(dx * dx + dy * dy);
                if (length == 0) length = 1;
                double half = maxWidth / 2 * (0.25 + 0.75 * ((double)i / (count - 1)));
                double nx = -dy / length * half;
                double ny = dx / length * half;

                double leftX = current.X + nx;
                double leftY = current.Y + ny;
                double rightX = current.X - nx;
                double rightY = current.Y - ny;
                Vector2 left = cells.Point(leftX, leftY);
                Vector2 right = cells.Point(rightX, rightY);
                Color32 leftColor = GradientColor(color, maxAlpha, leftX - oldest.X, leftY - oldest.Y, axisX, axisY, axisLengthSquared);
                Color32 rightColor = GradientColor(color, maxAlpha, rightX - oldest.X, rightY - oldest.Y, axisX, axisY, axisLengthSquared);
                if (i > 0) builder.Quad(previousLeft, left, right, previousRight, previousLeftColor, leftColor, rightColor, previousRightColor);
                previousLeft = left;
                previousRight = right;
                previousLeftColor = leftColor;
                previousRightColor = rightColor;
            }
        }

        private static Color32 GradientColor(Color32 color, float maxAlpha, double px, double py, double axisX, double axisY, double axisLengthSquared)
        {
            double t = Math.Min(1, Math.Max(0, (px * axisX + py * axisY) / axisLengthSquared));
            return BoardPalette.WithAlpha(color, (float)(maxAlpha * t));
        }

        private void DrawParticles(in BoardFrame frame, CellSpace cells)
        {
            IReadOnlyList<Effect> effects = frame.Effects;
            for (int i = 0; i < effects.Count; i++)
            {
                if (!(effects[i] is ParticleBurst burst)) continue;
                double elapsed = frame.Now - burst.StartedAt;
                if (elapsed < 0 || elapsed >= Particles.LifetimeMs) continue;
                IReadOnlyList<Particle> particles = burst.Particles;
                for (int p = 0; p < particles.Count; p++)
                {
                    Particle particle = particles[p];
                    (double x, double y, double alpha) = Particles.At(particle, elapsed);
                    if (alpha <= 0) continue;
                    Color32 color = BoardPalette.WithAlpha(BoardPalette.ParticleColors[particle.Tone], (float)alpha);
                    float size = (float)particle.Size * cells.Scale;
                    builder.Rect(cells.X(x) - size / 2, cells.Y(y) - size / 2, size, size, color);
                }
            }
        }

        private void DrawBalls(MeshGenerationContext context, ReadOnlyArray<Ball> balls, CellSpace cells)
        {
            for (int tier = 0; tier < orbTextures.Count; tier++)
            {
                foreach (Ball ball in balls)
                {
                    if (Math.Min(ball.Tier, orbTextures.Count - 1) != tier) continue;
                    float side = (float)ball.Radius * cells.Scale * SpriteRadii;
                    builder.TexturedRect(cells.X(ball.X) - side / 2, cells.Y(ball.Y) - side / 2, side, side, new Color32(255, 255, 255, 255));
                }
                builder.Flush(context, orbTextures[tier]);
            }
        }
    }
}

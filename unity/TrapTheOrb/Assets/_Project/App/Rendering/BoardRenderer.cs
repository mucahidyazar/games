using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.Rendering
{
    /// <summary>Everything one frame of the board needs.</summary>
    public readonly struct BoardFrame
    {
        public BoardFrame(GameState state, FieldLayout layout, double now, Orientation orientation, CellPoint? aim,
            IReadOnlyList<Effect> effects, bool reducedMotion)
        {
            State = state;
            Layout = layout;
            Now = now;
            Orientation = orientation;
            Aim = aim;
            Effects = effects;
            ReducedMotion = reducedMotion;
        }

        public GameState State { get; }
        public FieldLayout Layout { get; }
        public double Now { get; }
        public Orientation Orientation { get; }

        /// <summary>Cell the player is aiming at (finger down), if any.</summary>
        public CellPoint? Aim { get; }
        public IReadOnlyList<Effect> Effects { get; }
        public bool ReducedMotion { get; }
    }

    /// <summary>
    /// Draws a game state into a UI Toolkit mesh (render/renderer.ts): the static field, capture flashes, broken
    /// walls, the aim, walls under construction, comet trails, capture particles and the orbs.
    /// </summary>
    public sealed partial class BoardRenderer : IDisposable
    {
        /// <summary>Dash and gap of walls under construction, in cells, and how fast the dashes travel.</summary>
        private const float DashCells = 3.2f;
        private const float GapCells = 2f;
        private const float DashSpeedCells = 7f;
        private const double ShakeMs = 260;
        private const double ShakePx = 3.5;
        private const double CaptureFlashAlpha = 0.45;
        private const double BrokenAlpha = 0.9;
        private const double BrokenGrowCells = 1.4;
        private const float AimAlpha = 0.3f;
        private const float AimAnchorAlpha = 0.5f;

        /// <summary>The baked orb sprite is this many radii wide (radius plus glow and shadow padding).</summary>
        private const float SpriteRadii = 404f / 96f;

        private static readonly Color32 White = new Color32(255, 255, 255, 255);

        private readonly FieldTexture fieldTexture = new FieldTexture();
        private readonly Trails trails = new Trails();
        private readonly MeshBuilder builder = new MeshBuilder();
        private readonly IReadOnlyList<Texture2D> orbTextures;

        public BoardRenderer(IReadOnlyList<Texture2D> orbTextures)
        {
            if (orbTextures == null || orbTextures.Count == 0) throw new ArgumentException("Orb sprites are missing", nameof(orbTextures));
            this.orbTextures = orbTextures;
        }

        public BoardPalette Palette { get; set; } = BoardPalette.Navy;

        /// <summary>Records orb positions for the trails; call once per frame, before drawing.</summary>
        public void Advance(GameState state, double now) => trails.Update(state.Balls, now);

        public void ResetTrails() => trails.Clear();

        public void Dispose() => fieldTexture.Dispose();

        /// <summary>Decaying jitter after the most recent broken wall, in UI units; none when motion is reduced.</summary>
        public static Vector2 ShakeOffset(IReadOnlyList<Effect> effects, double now, bool reducedMotion)
        {
            if (reducedMotion) return Vector2.zero;
            double latest = double.NegativeInfinity;
            for (int i = 0; i < effects.Count; i++)
            {
                if (effects[i] is BrokenWall) latest = Math.Max(latest, effects[i].StartedAt);
            }
            double elapsed = now - latest;
            if (double.IsInfinity(elapsed) || double.IsNaN(elapsed) || elapsed < 0 || elapsed >= ShakeMs) return Vector2.zero;
            double amplitude = ShakePx * Math.Pow(1 - elapsed / ShakeMs, 2);
            return new Vector2((float)(Math.Sin(elapsed * 0.09) * amplitude), (float)(Math.Cos(elapsed * 0.13) * amplitude));
        }

        public void Draw(MeshGenerationContext context, in BoardFrame frame)
        {
            GameState state = frame.State;
            if (state == null || frame.Layout.Scale <= 0) return;
            Vector2 shake = ShakeOffset(frame.Effects, frame.Now, frame.ReducedMotion);
            var cells = new CellSpace(frame.Layout, shake);

            builder.TexturedRect(cells.X(0), cells.Y(0), state.Grid.Cols * cells.Scale, state.Grid.Rows * cells.Scale, White);
            builder.Flush(context, fieldTexture.For(state.Grid, Palette));

            DrawCaptureFlashes(frame, cells);
            DrawBrokenWalls(frame, cells);
            if (state.Status == GameStatus.Playing && state.Walls.Count == 0) DrawAim(context, frame, cells);
            DrawBuildingWalls(context, frame, cells);
            DrawTrails(state.Balls, cells);
            DrawParticles(frame, cells);
            builder.Flush(context);
            DrawBalls(context, state.Balls, cells);
        }

        private void DrawCaptureFlashes(in BoardFrame frame, CellSpace cells)
        {
            IReadOnlyList<Effect> effects = frame.Effects;
            for (int i = 0; i < effects.Count; i++)
            {
                if (!(effects[i] is CaptureFlash flash)) continue;
                double t = (frame.Now - flash.StartedAt) / flash.DurationMs;
                if (t < 0 || t >= 1) continue;
                Color32 color = BoardPalette.WithAlpha(Palette.Building, (float)(CaptureFlashAlpha * Math.Pow(1 - t, 2)));
                foreach (CellRun run in flash.Runs)
                {
                    builder.Rect(cells.X(run.Start), cells.Y(run.Row), (run.End - run.Start) * cells.Scale, cells.Scale, color);
                }
            }
        }

        private void DrawBrokenWalls(in BoardFrame frame, CellSpace cells)
        {
            IReadOnlyList<Effect> effects = frame.Effects;
            for (int i = 0; i < effects.Count; i++)
            {
                if (!(effects[i] is BrokenWall broken)) continue;
                double t = (frame.Now - broken.StartedAt) / broken.DurationMs;
                if (t < 0 || t >= 1) continue;
                double grow = frame.ReducedMotion ? 0 : EaseOutCubic(t) * BrokenGrowCells;
                Engine.Rect rect = broken.Rect;
                builder.Rect(
                    cells.X(rect.Left - grow),
                    cells.Y(rect.Top - grow),
                    (float)(rect.Right - rect.Left + grow * 2) * cells.Scale,
                    (float)(rect.Bottom - rect.Top + grow * 2) * cells.Scale,
                    BoardPalette.WithAlpha(Palette.Broken, (float)(BrokenAlpha * (1 - t))));
            }
        }

        private static double EaseOutCubic(double t) => 1 - Math.Pow(1 - t, 3);

        /// <summary>Maps grid cells to UI units, including the shake.</summary>
        private readonly struct CellSpace
        {
            private readonly float offsetX;
            private readonly float offsetY;

            public CellSpace(FieldLayout layout, Vector2 shake)
            {
                Scale = layout.Scale;
                offsetX = layout.OffsetX + shake.x;
                offsetY = layout.OffsetY + shake.y;
            }

            public float Scale { get; }

            public float X(double col) => offsetX + (float)col * Scale;

            public float Y(double row) => offsetY + (float)row * Scale;

            public Vector2 Point(double col, double row) => new Vector2(X(col), Y(row));
        }
    }
}

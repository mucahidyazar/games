using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using TrapTheOrb.App.Rendering;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine;
using UnityEngine.UIElements;
using PointerType = UnityEngine.UIElements.PointerType;

namespace TrapTheOrb.App.UI.Screens
{
    /// <summary>
    /// The playing field (GameBoard.tsx): draws the game and turns taps and swipes into walls. A tap builds in the
    /// current direction; a swipe picks the direction of the wall first. It only reacts while a level is played.
    /// </summary>
    public sealed class BoardView : VisualElement
    {
        /// <summary>A drag longer than this (UI units) picks the wall direction instead of tapping.</summary>
        private const float SwipeThreshold = 18;

        private readonly GameController controller;
        private readonly BoardRenderer renderer;
        private readonly VisualElement canvas;
        private readonly PointsLayer points;
        private Gesture? gesture;
        private double now;
        private GameState drawnState;
        private CellPoint? drawnAim;
        private Orientation drawnOrientation;
        private bool isPaletteDirty = true;
        private bool hadEffects;

        public BoardView(GameController controller, BoardRenderer renderer)
        {
            this.controller = controller ?? throw new ArgumentNullException(nameof(controller));
            this.renderer = renderer ?? throw new ArgumentNullException(nameof(renderer));
            AddToClassList("board");

            canvas = Ui.Div("board__canvas");
            canvas.generateVisualContent += Draw;
            points = new PointsLayer();
            Add(canvas);
            Add(points);

            canvas.RegisterCallback<GeometryChangedEvent>(_ => controller.Resize(canvas.contentRect.width, canvas.contentRect.height));
            canvas.RegisterCallback<PointerDownEvent>(OnPointerDown);
            canvas.RegisterCallback<PointerMoveEvent>(OnPointerMove);
            canvas.RegisterCallback<PointerUpEvent>(OnPointerUp);
            canvas.RegisterCallback<PointerCancelEvent>(evt => CancelGesture(evt.pointerId));
            canvas.RegisterCallback<PointerCaptureOutEvent>(evt => CancelGesture(evt.pointerId));
            canvas.RegisterCallback<PointerLeaveEvent>(evt =>
            {
                if (evt.pointerType == PointerType.mouse) controller.ClearAim();
            });
        }

        public void SetPalette(BoardPalette palette)
        {
            renderer.Palette = palette;
            points.SetColor(palette.PointsText);
            isPaletteDirty = true;
            canvas.MarkDirtyRepaint();
        }

        /// <summary>
        /// Redraws the field for this frame when something on it changed (the web's needsRender): the engine state,
        /// the aim, the wall direction, the colours or a running effect. <paramref name="nowMs"/> is the app clock.
        /// </summary>
        public void Render(double nowMs)
        {
            now = nowMs;
            GameState state = controller.State;
            if (state == null || controller.Layout is not FieldLayout layout) return;

            IReadOnlyList<Effect> effects = controller.Effects;
            bool hasEffects = effects.Count > 0;
            bool isStateNew = !ReferenceEquals(state, drawnState);
            bool changed = isStateNew || isPaletteDirty || hasEffects || hadEffects ||
                !Nullable.Equals(controller.Aim, drawnAim) || controller.Orientation != drawnOrientation;
            hadEffects = hasEffects;
            if (!changed) return;

            // Trails follow the orbs, so they only move when the engine state does.
            if (isStateNew) renderer.Advance(state, nowMs);
            drawnState = state;
            drawnAim = controller.Aim;
            drawnOrientation = controller.Orientation;
            isPaletteDirty = false;
            Vector2 shake = BoardRenderer.ShakeOffset(effects, nowMs, UiMotion.IsReduced);
            points.Show(effects, layout, shake, nowMs, UiMotion.IsReduced);
            canvas.MarkDirtyRepaint();
        }

        /// <summary>Forgets an unfinished swipe, e.g. when the app is sent to the background mid-gesture.</summary>
        public void CancelGesture()
        {
            if (!(gesture is Gesture current)) return;
            if (canvas.HasPointerCapture(current.PointerId)) canvas.ReleasePointer(current.PointerId);
            gesture = null;
            controller.ClearAim();
        }

        private void Draw(MeshGenerationContext context)
        {
            GameState state = controller.State;
            if (state == null || controller.Layout is not FieldLayout layout) return;
            renderer.Draw(context, new BoardFrame(state, layout, now, controller.Orientation, controller.Aim, controller.Effects, UiMotion.IsReduced));
        }

        private bool IsPlaying => controller.State?.Status == GameStatus.Playing;

        private void OnPointerDown(PointerDownEvent evt)
        {
            if (!IsPlaying) return;
            Vector2 point = evt.localPosition;

            if (evt.pointerType == PointerType.mouse)
            {
                if (evt.button == 1)
                {
                    controller.ToggleOrientation();
                    controller.AimAtPoint(point.x, point.y);
                }
                else if (evt.button == 0)
                {
                    controller.BuildAtPoint(point.x, point.y);
                }
                return;
            }

            // A swipe whose finger-up never arrived (the app was suspended) must not block the board.
            if (gesture is Gesture stale && !canvas.HasPointerCapture(stale.PointerId)) gesture = null;
            // Only one finger steers at a time; a resting palm or a second touch must not hijack the swipe.
            if (gesture != null) return;
            canvas.CapturePointer(evt.pointerId);
            gesture = new Gesture(evt.pointerId, point, null);
            controller.AimAtPoint(point.x, point.y);
        }

        private void OnPointerMove(PointerMoveEvent evt)
        {
            Vector2 point = evt.localPosition;
            if (evt.pointerType == PointerType.mouse)
            {
                if (IsPlaying) controller.AimAtPoint(point.x, point.y);
                return;
            }

            if (!(gesture is Gesture current) || current.PointerId != evt.pointerId) return;
            Vector2 delta = point - current.Start;
            if (delta.magnitude < SwipeThreshold) return;

            Orientation orientation = Mathf.Abs(delta.y) >= Mathf.Abs(delta.x) ? Orientation.Vertical : Orientation.Horizontal;
            if (orientation == current.Orientation) return;
            gesture = new Gesture(current.PointerId, current.Start, orientation);
            controller.SetOrientation(orientation);
        }

        private void OnPointerUp(PointerUpEvent evt)
        {
            if (evt.pointerType == PointerType.mouse || !(gesture is Gesture current) || current.PointerId != evt.pointerId) return;
            gesture = null;
            if (canvas.HasPointerCapture(evt.pointerId)) canvas.ReleasePointer(evt.pointerId);
            controller.BuildAtPoint(current.Start.x, current.Start.y, current.Orientation);
            controller.ClearAim();
        }

        private void CancelGesture(int pointerId)
        {
            if (!(gesture is Gesture current) || current.PointerId != pointerId) return;
            gesture = null;
            controller.ClearAim();
        }

        private readonly struct Gesture
        {
            public Gesture(int pointerId, Vector2 start, Orientation? orientation)
            {
                PointerId = pointerId;
                Start = start;
                Orientation = orientation;
            }

            public int PointerId { get; }
            public Vector2 Start { get; }

            /// <summary>Set once the finger has moved far enough to count as a swipe.</summary>
            public Orientation? Orientation { get; }
        }
    }
}

using System;
using TrapTheOrb.Engine;
using UnityEngine;
using Grid = TrapTheOrb.Engine.Grid;
using Object = UnityEngine.Object;

namespace TrapTheOrb.App.Rendering
{
    /// <summary>
    /// The field's walls and captured territory as a one-pixel-per-cell texture, drawn point-sampled so every cell
    /// stays a crisp square. Rebuilt only when the grid or the colours change (the web's static canvas layer).
    /// </summary>
    public sealed class FieldTexture : IDisposable
    {
        private Texture2D texture;
        private Color32[] pixels;
        private Grid drawnGrid;
        private int drawnVersion = -1;
        private BoardPalette drawnPalette;

        public Texture2D For(Grid grid, BoardPalette palette)
        {
            if (texture == null || texture.width != grid.Cols || texture.height != grid.Rows) Allocate(grid.Cols, grid.Rows);
            if (ReferenceEquals(grid, drawnGrid) && grid.Version == drawnVersion && palette == drawnPalette) return texture;

            Paint(grid, palette);
            drawnGrid = grid;
            drawnVersion = grid.Version;
            drawnPalette = palette;
            return texture;
        }

        public void Dispose()
        {
            if (texture != null) Object.Destroy(texture);
            texture = null;
        }

        private void Allocate(int cols, int rows)
        {
            Dispose();
            texture = new Texture2D(cols, rows, TextureFormat.RGBA32, mipChain: false, linear: false)
            {
                name = "FieldTexture",
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp,
                hideFlags = HideFlags.DontSave,
            };
            pixels = new Color32[cols * rows];
            drawnGrid = null;
        }

        private void Paint(Grid grid, BoardPalette palette)
        {
            ReadOnlySpan<byte> cells = grid.Cells;
            int cols = grid.Cols;
            int rows = grid.Rows;
            for (int row = 0; row < rows; row++)
            {
                // Texture rows start at the bottom; the grid's first row is the top one.
                int target = (rows - 1 - row) * cols;
                int source = row * cols;
                for (int col = 0; col < cols; col++) pixels[target + col] = ColorOf(cells[source + col], palette);
            }
            texture.SetPixels32(pixels);
            texture.Apply(updateMipmaps: false);
        }

        private static Color32 ColorOf(byte cell, BoardPalette palette) => cell switch
        {
            CellState.Wall => palette.Wall,
            CellState.Captured => palette.Captured,
            _ => palette.Field,
        };
    }
}

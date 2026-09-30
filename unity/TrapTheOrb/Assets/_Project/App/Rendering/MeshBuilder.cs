using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.Rendering
{
    /// <summary>
    /// Collects flat quads for one UI Toolkit mesh allocation, reusing its buffers between frames.
    /// Positions are in the element's local units.
    /// </summary>
    public sealed class MeshBuilder
    {
        private const int MaxVertices = ushort.MaxValue;
        private readonly List<Vertex> vertices = new List<Vertex>(1024);
        private readonly List<ushort> indices = new List<ushort>(1536);

        public bool IsEmpty => vertices.Count == 0;

        public void Rect(float x, float y, float width, float height, Color32 color)
        {
            if (width <= 0 || height <= 0 || color.a == 0) return;
            Quad(new Vector2(x, y), new Vector2(x + width, y), new Vector2(x + width, y + height), new Vector2(x, y + height),
                color, color, color, color);
        }

        /// <summary>A textured rectangle showing the whole texture.</summary>
        public void TexturedRect(float x, float y, float width, float height, Color32 tint)
        {
            if (!HasRoom(4)) return;
            ushort first = (ushort)vertices.Count;
            vertices.Add(Vertex(x, y, tint, new Vector2(0, 1)));
            vertices.Add(Vertex(x + width, y, tint, new Vector2(1, 1)));
            vertices.Add(Vertex(x + width, y + height, tint, new Vector2(1, 0)));
            vertices.Add(Vertex(x, y + height, tint, new Vector2(0, 0)));
            AddQuadIndices(first);
        }

        /// <summary>Four corners in clockwise order, each with its own colour.</summary>
        public void Quad(Vector2 a, Vector2 b, Vector2 c, Vector2 d, Color32 colorA, Color32 colorB, Color32 colorC, Color32 colorD)
        {
            if (!HasRoom(4)) return;
            ushort first = (ushort)vertices.Count;
            vertices.Add(Vertex(a.x, a.y, colorA, Vector2.zero));
            vertices.Add(Vertex(b.x, b.y, colorB, Vector2.zero));
            vertices.Add(Vertex(c.x, c.y, colorC, Vector2.zero));
            vertices.Add(Vertex(d.x, d.y, colorD, Vector2.zero));
            AddQuadIndices(first);
        }

        /// <summary>Writes everything collected so far into the context and starts over.</summary>
        public void Flush(MeshGenerationContext context, Texture texture = null)
        {
            if (vertices.Count == 0) return;
            MeshWriteData mesh = context.Allocate(vertices.Count, indices.Count, texture);
            if (mesh.vertexCount > 0)
            {
                foreach (Vertex vertex in vertices) mesh.SetNextVertex(vertex);
                foreach (ushort index in indices) mesh.SetNextIndex(index);
            }
            vertices.Clear();
            indices.Clear();
        }

        private bool HasRoom(int count) => vertices.Count + count <= MaxVertices;

        private void AddQuadIndices(ushort first)
        {
            // Two triangles, wound clockwise as UI Toolkit expects.
            indices.Add(first);
            indices.Add((ushort)(first + 1));
            indices.Add((ushort)(first + 2));
            indices.Add(first);
            indices.Add((ushort)(first + 2));
            indices.Add((ushort)(first + 3));
        }

        private static Vertex Vertex(float x, float y, Color32 tint, Vector2 uv) => new Vertex
        {
            position = new Vector3(x, y, UnityEngine.UIElements.Vertex.nearZ),
            tint = tint,
            uv = uv,
        };
    }
}

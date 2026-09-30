using System;
using System.Collections;
using System.Collections.Generic;

namespace TrapTheOrb.Engine
{
    /// <summary>
    /// A read-only view of an array that nobody mutates after it was handed out.
    /// A struct, so indexing and <c>foreach</c> allocate nothing in the simulation loop.
    /// </summary>
    public readonly struct ReadOnlyArray<T> : IReadOnlyList<T>, IEquatable<ReadOnlyArray<T>>
    {
        private readonly T[] items;

        private ReadOnlyArray(T[] items)
        {
            this.items = items;
        }

        public static ReadOnlyArray<T> Empty => default;

        public int Count => items?.Length ?? 0;

        public T this[int index] => (items ?? Array.Empty<T>())[index];

        public ReadOnlySpan<T> AsSpan() => items;

        /// <summary>Copies the values, so later changes to <paramref name="values"/> cannot leak in.</summary>
        public static ReadOnlyArray<T> From(IEnumerable<T> values) =>
            values == null ? Empty : new ReadOnlyArray<T>(new List<T>(values).ToArray());

        /// <summary>Wraps an array the engine just built and will never touch again.</summary>
        internal static ReadOnlyArray<T> Wrap(T[] owned) => new ReadOnlyArray<T>(owned);

        /// <summary>True when both views share the same backing array (the engine returned the input unchanged).</summary>
        public bool IsSameInstance(ReadOnlyArray<T> other) => ReferenceEquals(items, other.items);

        /// <summary>
        /// Identity, not contents: two views are equal when they share a backing array. Cheap enough for the UI to
        /// compare snapshots every frame; compare the items yourself when the contents matter.
        /// </summary>
        public bool Equals(ReadOnlyArray<T> other) => IsSameInstance(other);

        public override bool Equals(object obj) => obj is ReadOnlyArray<T> other && Equals(other);

        public override int GetHashCode() => items == null ? 0 : items.GetHashCode();

        public T[] ToArray() => items == null ? Array.Empty<T>() : (T[])items.Clone();

        public Enumerator GetEnumerator() => new Enumerator(items);

        IEnumerator<T> IEnumerable<T>.GetEnumerator() => ((IEnumerable<T>)(items ?? Array.Empty<T>())).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => (items ?? Array.Empty<T>()).GetEnumerator();

        public struct Enumerator
        {
            private readonly T[] items;
            private int index;

            internal Enumerator(T[] items)
            {
                this.items = items;
                index = -1;
            }

            public T Current => items[index];

            public bool MoveNext() => items != null && ++index < items.Length;
        }
    }
}

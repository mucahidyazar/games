using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>The app's buttons and small controls. Every tappable control is at least 44pt tall.</summary>
    public static class Controls
    {
        /// <summary>The one main action of a screen: coral, full width, 56pt.</summary>
        public static Button Primary(string label, Action onClick, string icon = null, bool iconAfter = false) =>
            Build(label, onClick, icon, iconAfter, "btn--primary");

        /// <summary>A second choice next to or under the primary action: 52pt, on a sunken surface.</summary>
        public static Button Secondary(string label, Action onClick, string icon = null) =>
            Build(label, onClick, icon, false, "btn--secondary");

        /// <summary>A quiet text-and-icon action, still 48pt tall.</summary>
        public static Button Ghost(string label, Action onClick, string icon = null) =>
            Build(label, onClick, icon, false, "btn--ghost");

        /// <summary>A 44pt square holding one icon; <paramref name="isBare"/> drops the surface.</summary>
        public static Button IconButton(string icon, Action onClick, bool isBare = false) =>
            Ui.Button(onClick, "icon-button", isBare ? "icon-button--bare" : null).Children(Ui.Icon(icon));

        /// <summary>Replaces a button's label text (buttons built here have exactly one).</summary>
        public static void SetLabel(this Button button, string text) => button.Q<Label>(className: "btn__label")?.SetText(text);

        /// <summary>Swaps the leading icon of a button built here.</summary>
        public static void SetButtonIcon(this Button button, string icon) => button.Q(className: "btn__icon")?.SetIcon(icon);

        public static Label Chip(string text, params string[] classes) => Ui.Text(text, classes).WithClass("chip");

        public static T WithClass<T>(this T element, string className) where T : VisualElement
        {
            element.AddToClassList(className);
            return element;
        }

        private static Button Build(string label, Action onClick, string icon, bool iconAfter, string variant)
        {
            Button button = Ui.Button(onClick, "btn", variant);
            VisualElement iconElement = icon == null ? null : Ui.Icon(icon, "btn__icon", iconAfter ? "btn__icon--after" : null);
            if (iconElement != null && !iconAfter) button.Add(iconElement);
            button.Add(Ui.Text(label, "btn__label"));
            if (iconElement != null && iconAfter) button.Add(iconElement);
            return button;
        }
    }

    /// <summary>An on/off switch; a tap anywhere on its row should call <see cref="Toggle"/>.</summary>
    public sealed class Switch : VisualElement
    {
        private bool isOn;

        public Switch()
        {
            AddToClassList("switch");
            pickingMode = PickingMode.Ignore;
            Add(Ui.Div("switch__knob"));
        }

        public bool IsOn
        {
            get => isOn;
            set
            {
                isOn = value;
                EnableInClassList("switch--on", value);
            }
        }
    }

    /// <summary>A row with an icon, a label and a switch; the whole row is the tap target.</summary>
    public sealed class SwitchRow : Button
    {
        private readonly Switch control = new Switch();
        private readonly Label detail = Ui.Text(string.Empty, "row__detail");

        public SwitchRow(string icon, string label, Action<bool> onChange)
        {
            text = string.Empty;
            focusable = false;
            RemoveFromClassList(ussClassName);
            AddToClassList("button");
            AddToClassList("row");
            clicked += () => onChange?.Invoke(!control.IsOn);
            Add(Ui.Icon(icon, "row__icon"));
            Add(Ui.Div("row__text").Children(Ui.Text(label, "row__title"), detail));
            Add(control);
            detail.SetVisible(false);
        }

        public bool IsOn
        {
            get => control.IsOn;
            set => control.IsOn = value;
        }

        /// <summary>Shows a second line under the label; null or empty hides it.</summary>
        public void SetDetail(string text)
        {
            detail.SetText(text ?? string.Empty);
            detail.SetVisible(!string.IsNullOrEmpty(text));
        }
    }

    /// <summary>Two or three equal segments, one of them selected (the wall direction, the theme).</summary>
    public sealed class Segmented<T> : VisualElement
    {
        private readonly List<(T Value, Button Button)> segments = new List<(T, Button)>();
        private readonly Action<T> onChange;

        public Segmented(Action<T> onChange, bool isCompact = false)
        {
            this.onChange = onChange;
            AddToClassList("segmented");
            if (isCompact) AddToClassList("segmented--compact");
        }

        public Segmented<T> Option(T value, string label, string icon = null)
        {
            Button button = Ui.Button(() => onChange?.Invoke(value), "segment");
            if (icon != null) button.Add(Ui.Icon(icon, "segment__icon"));
            button.Add(Ui.Text(label, "segment__label"));
            segments.Add((value, button));
            Add(button);
            return this;
        }

        public void Select(T value)
        {
            foreach ((T option, Button button) in segments) button.EnableInClassList("segment--on", EqualityComparer<T>.Default.Equals(option, value));
        }
    }

    /// <summary>Coloured dots for the orbs of a level; colour shows speed (calm → blazing).</summary>
    public sealed class OrbLineup : VisualElement
    {
        private readonly bool isSmall;
        private int[] shown = Array.Empty<int>();

        public OrbLineup(bool isSmall = false)
        {
            this.isSmall = isSmall;
            AddToClassList("orb-lineup");
            pickingMode = PickingMode.Ignore;
        }

        public OrbLineup Show(IReadOnlyList<int> tiers)
        {
            if (Same(tiers)) return this;
            Clear();
            var copy = new int[tiers.Count];
            for (int i = 0; i < tiers.Count; i++)
            {
                copy[i] = tiers[i];
                Add(Ui.Div("orb-dot", isSmall ? "orb-dot--sm" : "orb-dot--md", "orb-dot--tier" + Math.Min(3, Math.Max(0, tiers[i]))));
            }
            shown = copy;
            return this;
        }

        public OrbLineup Show(ReadOnlyArray<int> tiers)
        {
            var list = new List<int>(tiers.Count);
            foreach (int tier in tiers) list.Add(tier);
            return Show(list);
        }

        private bool Same(IReadOnlyList<int> tiers)
        {
            if (tiers.Count != shown.Length) return false;
            for (int i = 0; i < shown.Length; i++)
            {
                if (tiers[i] != shown[i]) return false;
            }
            return true;
        }
    }
}

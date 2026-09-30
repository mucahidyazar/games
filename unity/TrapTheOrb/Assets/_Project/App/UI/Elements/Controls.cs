using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>The site's buttons and small pieces (overlay/Panel.tsx, OrbLineup.tsx).</summary>
    public static class Controls
    {
        public const float CardRadius = 12;
        public const float ControlRadius = 9;

        /// <summary>Coral (primary) or outlined (secondary) 40px button with an optional icon.</summary>
        public static Button Action(string label, Action onClick, string icon = null, bool isPrimary = true, bool iconAfter = false)
        {
            Button button = Ui.Button(onClick, "action-button", isPrimary ? "action-button--primary" : "action-button--secondary");
            VisualElement iconElement = icon == null ? null : Ui.Icon(icon, "action-button__icon", iconAfter ? "action-button__icon--after" : null);
            if (iconElement != null && !iconAfter) button.Add(iconElement);
            button.Add(Ui.Text(label, "action-button__label"));
            if (iconElement != null && iconAfter) button.Add(iconElement);
            if (isPrimary) ShadowLayer.Attach(button, ShadowToken.Coral, ControlRadius);
            return button;
        }

        /// <summary>Small underlined text button for secondary choices inside a panel.</summary>
        public static Button TextButton(string label, Action onClick, bool isMuted = false) =>
            Ui.Button(onClick, "text-button", isMuted ? "text-button--muted" : null).Children(Ui.Text(label, "text-button__label"));

        /// <summary>A 40px square card button holding one icon (header controls).</summary>
        public static Button Square(string icon, Action onClick, params string[] iconClasses)
        {
            Button button = Ui.Button(onClick, "square-button", "card");
            button.Add(Ui.Icon(icon, iconClasses));
            ShadowLayer.Attach(button, ShadowToken.Card, ControlRadius);
            return button;
        }

        /// <summary>A surface card with the card shadow.</summary>
        public static VisualElement Card(params string[] classes)
        {
            VisualElement card = Ui.Div(classes);
            card.AddToClassList("card");
            return ShadowLayer.Attach(card, ShadowToken.Card, CardRadius);
        }

        public static Label Chip(string text, params string[] classes) => Ui.Text(text, classes).WithClass("chip");

        public static Label Eyebrow(string text) => Ui.Text(text, "eyebrow");

        /// <summary>A short note under the panel's actions, e.g. why a run is not ranked.</summary>
        public static Label Note(string text, bool isAlert = false) => Ui.Text(text, "note", isAlert ? "note--alert" : null);

        public static T WithClass<T>(this T element, string className) where T : VisualElement
        {
            element.AddToClassList(className);
            return element;
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

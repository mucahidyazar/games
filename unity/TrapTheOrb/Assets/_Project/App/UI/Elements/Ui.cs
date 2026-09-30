using System;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Elements
{
    /// <summary>Tiny builders for the element tree, so screens read like markup.</summary>
    public static class Ui
    {
        public static VisualElement Div(params string[] classes) => With(new VisualElement(), classes);

        public static Label Text(string text, params string[] classes)
        {
            var label = new Label(text);
            // Labels only show text; taps belong to the element around them.
            label.pickingMode = PickingMode.Ignore;
            return With(label, classes);
        }

        /// <summary>A tinted vector icon; <paramref name="name"/> selects the image through the "icon--name" class.</summary>
        public static VisualElement Icon(string name, params string[] classes)
        {
            VisualElement icon = Div(classes);
            icon.AddToClassList("icon");
            icon.AddToClassList("icon--" + name);
            icon.pickingMode = PickingMode.Ignore;
            return icon;
        }

        /// <summary>A button without Unity's default look; content is added as children.</summary>
        public static Button Button(Action onClick, params string[] classes)
        {
            var button = new Button(onClick) { text = string.Empty, focusable = false };
            button.RemoveFromClassList(UnityEngine.UIElements.Button.ussClassName);
            button.AddToClassList("button");
            return With(button, classes);
        }

        public static T With<T>(T element, params string[] classes) where T : VisualElement
        {
            foreach (string name in classes)
            {
                if (!string.IsNullOrEmpty(name)) element.AddToClassList(name);
            }
            return element;
        }

        public static T Children<T>(this T element, params VisualElement[] children) where T : VisualElement
        {
            foreach (VisualElement child in children)
            {
                if (child != null) element.Add(child);
            }
            return element;
        }

        public static void SetVisible(this VisualElement element, bool isVisible) =>
            element.style.display = isVisible ? DisplayStyle.Flex : DisplayStyle.None;

        /// <summary>Swaps the icon image of an element built by <see cref="Icon"/>.</summary>
        public static void SetIcon(this VisualElement icon, string name)
        {
            foreach (string className in new System.Collections.Generic.List<string>(icon.GetClasses()))
            {
                if (className.StartsWith("icon--", StringComparison.Ordinal)) icon.RemoveFromClassList(className);
            }
            icon.AddToClassList("icon--" + name);
        }

        public static void SetText(this Label label, string text)
        {
            if (label.text != text) label.text = text;
        }
    }
}

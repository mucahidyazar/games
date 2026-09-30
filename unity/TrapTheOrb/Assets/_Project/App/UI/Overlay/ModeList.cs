using System;
using System.Collections.Generic;
using System.Linq;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Overlay
{
    /// <summary>
    /// Every mode, grouped. Picking one only shows it next to the list (and in the orbs behind the panel);
    /// nothing starts until Play. On narrow boards the list folds behind a "Change" button.
    /// </summary>
    public sealed class ModeList : VisualElement
    {
        private readonly Action<GameMode> onSelect;
        private readonly VisualElement toggleIcon;
        private readonly Label toggleName;
        private readonly VisualElement chevron;
        private readonly VisualElement groups;
        private readonly Dictionary<GameMode, Button> items = new Dictionary<GameMode, Button>();
        private bool isOpen;

        public ModeList(Action<GameMode> onSelect)
        {
            this.onSelect = onSelect;
            AddToClassList("mode-list");

            toggleIcon = Ui.Icon("mode-classic", "mode-toggle__glyph");
            toggleName = Ui.Text(string.Empty, "mode-toggle__name");
            chevron = Ui.Icon("chevron-down", "mode-toggle__chevron");
            Add(Ui.Button(() => SetOpen(!isOpen), "mode-toggle").Children(
                Ui.Div("mode-toggle__tile").Children(toggleIcon),
                Ui.Div("mode-toggle__text").Children(Ui.Text("MODE", "mode-toggle__eyebrow"), toggleName),
                Ui.Div("mode-toggle__change").Children(Ui.Text("Change", "mode-toggle__change-label"), chevron)));

            groups = Ui.Div("mode-groups");
            groups.Add(Group("Ranked", ModeContent.Modes.Where(mode => Modes.IsRanked(mode.Id))));
            groups.Add(Group("Practice", ModeContent.Modes.Where(mode => !Modes.IsRanked(mode.Id))));
            Add(groups);
            SetOpen(false);
        }

        public void Show(GameMode current)
        {
            ModeInfo info = ModeContent.Info(current);
            toggleIcon.SetIcon(ModeContent.IconName(current));
            toggleName.SetText(info.Name);
            foreach (KeyValuePair<GameMode, Button> item in items)
            {
                item.Value.EnableInClassList("mode-item--current", item.Key == current);
            }
        }

        private void SetOpen(bool open)
        {
            isOpen = open;
            groups.SetVisible(open);
            chevron.EnableInClassList("mode-toggle__chevron--open", open);
        }

        private VisualElement Group(string label, IEnumerable<ModeInfo> modes)
        {
            VisualElement grid = Ui.Div("mode-group__grid");
            foreach (ModeInfo mode in modes)
            {
                GameMode id = mode.Id;
                Button item = Ui.Button(() =>
                {
                    SetOpen(false);
                    onSelect?.Invoke(id);
                }, "mode-item").Children(
                    Ui.Div("mode-item__tile").Children(Ui.Icon(ModeContent.IconName(id), "mode-item__glyph")),
                    Ui.Text(mode.Short, "mode-item__label"));
                items[id] = item;
                grid.Add(item);
            }
            return Ui.Div("mode-group").Children(Ui.Text(label.ToUpperInvariant(), "mode-group__label"), grid);
        }
    }
}

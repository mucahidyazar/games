using System;
using System.Collections.Generic;
using TrapTheOrb.App.Content;
using TrapTheOrb.App.Storage;
using TrapTheOrb.App.UI.Elements;
using TrapTheOrb.Engine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>Scores saved on this device, one table per ranked mode (leaderboards/DeviceScores.tsx).</summary>
    public sealed class HighScoresView : VisualElement
    {
        private readonly PlayerStore store;
        private readonly Func<double> nowMs;
        private readonly Dictionary<GameMode, Button> tabs = new Dictionary<GameMode, Button>();
        private readonly VisualElement table;
        private readonly Button clearButton;
        private readonly Label clearLabel;
        private GameMode mode;
        private bool isConfirmingClear;

        public HighScoresView(PlayerStore store, Func<double> nowMs, GameMode initialMode)
        {
            this.store = store ?? throw new ArgumentNullException(nameof(store));
            this.nowMs = nowMs;
            mode = Modes.IsRanked(initialMode) ? initialMode : GameMode.Classic;
            AddToClassList("scores");

            VisualElement tabBar = Ui.Div("scores__tabs");
            foreach (GameMode id in Modes.Ranked)
            {
                GameMode tab = id;
                Button button = Ui.Button(() => Select(tab), "scores__tab").Children(Ui.Text(ModeContent.Info(tab).Name, "scores__tab-label"));
                tabs[tab] = button;
                tabBar.Add(button);
            }
            Add(tabBar);

            table = Ui.Div("scores__table");
            Add(table);

            clearLabel = Ui.Text("Clear device scores", "scores__clear-label");
            clearButton = Ui.Button(OnClear, "scores__clear").Children(clearLabel);
            Add(Ui.Div("scores__footer").Children(
                Ui.Text("Scores stay on this device only.", "scores__footnote"), clearButton));

            RegisterCallback<AttachToPanelEvent>(_ => store.Changed += Refresh);
            RegisterCallback<DetachFromPanelEvent>(_ => store.Changed -= Refresh);
            Refresh();
        }

        private void Select(GameMode next)
        {
            mode = next;
            isConfirmingClear = false;
            Refresh();
        }

        private void OnClear()
        {
            if (!isConfirmingClear)
            {
                isConfirmingClear = true;
                Refresh();
                return;
            }
            isConfirmingClear = false;
            store.ClearScores();
        }

        private void Refresh()
        {
            foreach (KeyValuePair<GameMode, Button> tab in tabs) tab.Value.EnableInClassList("scores__tab--current", tab.Key == mode);

            IReadOnlyList<HighScore> scores = HighScores.For(store.Snapshot.HighScores, mode);
            table.Clear();
            if (scores.Count == 0)
            {
                table.Add(Ui.Text($"No {ModeContent.Info(mode).Name} scores on this device yet.", "scores__empty"));
            }
            else
            {
                table.Add(Ui.Div("scores__row", "scores__row--head").Children(
                    Ui.Text("#", "scores__rank-head"), Ui.Text("NAME", "scores__name-head"),
                    Ui.Text("SCORE", "scores__score-head"), Ui.Text("LEVEL", "scores__level-head")));
                for (int i = 0; i < scores.Count; i++) table.Add(Row(i + 1, scores[i]));
            }

            clearButton.SetVisible(store.Snapshot.HighScores.Count > 0);
            clearButton.EnableInClassList("scores__clear--confirm", isConfirmingClear);
            clearLabel.SetText(isConfirmingClear ? "Tap again to clear" : "Clear device scores");
        }

        private VisualElement Row(int rank, HighScore entry)
        {
            string podium = rank <= 3 ? "rank--podium-" + rank : null;
            return Ui.Div("scores__row").Children(
                Ui.Div("scores__rank").Children(Ui.Text(rank.ToString(), "rank", podium)),
                Ui.Div("scores__name").Children(
                    Ui.Text(entry.Name, "scores__name-text"),
                    Ui.Text(TimeAgo.Format(entry.CreatedAt, nowMs()), "scores__when")),
                Ui.Text(Format.Number(entry.Score), "scores__score"),
                Ui.Text(entry.Level.ToString(), "scores__level"));
        }
    }

    /// <summary>"5 minutes ago", "yesterday", or a date once it is more than a week old (leaderboards/timeAgo.ts).</summary>
    public static class TimeAgo
    {
        private const double Minute = 60_000;
        private const double Hour = 60 * Minute;
        private const double Day = 24 * Hour;

        public static string Format(double timeMs, double nowMs)
        {
            double elapsed = Math.Max(0, nowMs - timeMs);
            if (elapsed < Minute) return "just now";
            if (elapsed < Hour) return Ago((int)Math.Floor(elapsed / Minute), "minute");
            if (elapsed < Day) return Ago((int)Math.Floor(elapsed / Hour), "hour");
            if (elapsed < 7 * Day)
            {
                int days = (int)Math.Floor(elapsed / Day);
                return days == 1 ? "yesterday" : $"{days} days ago";
            }
            return DateTimeOffset.FromUnixTimeMilliseconds((long)timeMs).LocalDateTime
                .ToString("MMM d, yyyy", System.Globalization.CultureInfo.GetCultureInfo("en-US"));
        }

        private static string Ago(int count, string unit) => $"{count} {unit}{(count == 1 ? string.Empty : "s")} ago";
    }
}

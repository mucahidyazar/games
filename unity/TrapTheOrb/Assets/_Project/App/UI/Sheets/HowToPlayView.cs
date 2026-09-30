using TrapTheOrb.App.UI.Elements;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.UI.Sheets
{
    /// <summary>"How to play" (content/HowToPlayContent.tsx), rewritten for touch and for scores kept on the device.</summary>
    public sealed class HowToPlayView : VisualElement
    {
        public HowToPlayView()
        {
            AddToClassList("prose");

            Add(Ui.Text("Goal", "prose__heading", "prose__heading--first"));
            Paragraph("Orbs bounce around the field. Build walls to trap them in smaller and smaller spaces, and " +
                "<b>claim at least 75% of the field</b> to clear the level.");

            Heading("Orbs and levels");
            Paragraph("An orb’s colour tells you how fast it is:");
            SpeedItem(0, "Calm", "the starting speed");
            SpeedItem(1, "Quick", "1.2×");
            SpeedItem(2, "Fast", "1.4×");
            SpeedItem(3, "Blazing", "1.6×");
            Paragraph("Level 1 has a single calm orb. Level 2 adds a second one, level 3 speeds one of them up and level 4 " +
                "speeds up the other. Then a third orb joins and everyone calms down for a moment — a breather — before " +
                "they speed up again. Each round starts a little harder than the one before, and the Speed gauge always " +
                "shows your fastest orb.");
            Paragraph("You get one life more than there are orbs, and your lives refill at the start of every level.");

            Heading("Modes");
            Paragraph("<b>Ranked modes</b> have fixed rules, so every score compares fairly:");
            Term("Classic", "The standard game described above.");
            Term("Daily Challenge", "Classic rules on the same layout for everyone, new every day.");
            Term("Time Attack", "Each level has a countdown (30 seconds plus 15 per orb). Seconds left over become bonus points.");
            Term("Limited Walls", "A small wall budget per level (4 plus 2 per orb). Unused walls become bonus points.");
            Term("Hardcore", "One life for the whole run.");
            Paragraph("<b>Practice modes</b> are never ranked. <b>Zen</b> gives you unlimited lives, and <b>Custom</b> lets you " +
                "choose the orbs, their speed, lives, walls, timer and target area — start from the Easy, Normal, Hard or " +
                "Expert preset and adjust from there. Practice runs are saved at every level, so you can close the app and " +
                "<b>Continue</b> later.");

            Heading("Controls");
            Term("Tap", "Tap a free spot to build a wall in the current direction.");
            Term("Swipe", "Swipe from a free spot to build in the direction of your swipe.");
            Term("Buttons", "The ↕/↔ button next to Play switches between vertical and horizontal walls.");

            Heading("Rules");
            Bullet("A wall grows in both directions at once from the spot you pick, until each half reaches a wall or the border.");
            Bullet("Only one wall can be under construction at a time.");
            Bullet("If an orb touches a wall while it’s being built, that half breaks and you lose a life. The other half can " +
                "still finish. If both halves break at the same moment, you still lose only one life.");
            Bullet("When a wall finishes, every region with no orb inside is captured and turns mint. Walls count as captured area too.");
            Bullet("The run ends when you lose your last life, run out of time, or run out of walls.");

            Heading("Scoring");
            Row("Points for", "How much", isHead: true);
            Row("Capturing area", "10 per 1% of the field × level");
            Row("Territory bonus", "50 × each whole percent above the target × level");
            Row("Lives bonus", "100 × lives left × level");
            Row("Speed bonus", "5 × each second under par (or left on the clock) × level");
            Row("Unused walls", "50 × walls left × level (Limited Walls)");
            Paragraph("Bonuses are paid when you clear a level. Par time is 20 seconds plus 10 per orb: 30 seconds with one " +
                "orb, 40 with two, and so on.");

            Heading("High scores");
            Paragraph("Your best runs in the ranked modes are kept on this device — ten per mode. Open <b>High scores</b> " +
                "from the menu to see them.");

            Heading("Tips");
            Bullet("Build right behind an orb that’s moving away from your line. It can’t turn around in time.");
            Bullet("Short walls finish fast. A wall across a narrow corridor is much safer than one across the open field.");
            Bullet("Pen the orbs into small pockets: the less room they have, the more of the field you can claim.");
            Bullet("Save a big capture for last. Pushing well past the target in one move earns a bigger territory bonus.");
            Bullet("Keep an eye on the red and violet orbs — they close gaps much faster than the blue ones.");
        }

        private void Heading(string text) => Add(Ui.Text(text, "prose__heading"));

        private void Paragraph(string text) => Add(Ui.Text(text, "prose__paragraph"));

        private void Bullet(string text) =>
            Add(Ui.Div("prose__bullet").Children(Ui.Div("prose__marker"), Ui.Text(text, "prose__bullet-text")));

        private void SpeedItem(int tier, string name, string detail) =>
            Add(Ui.Div("prose__bullet", "prose__bullet--orb").Children(
                new OrbLineup(isSmall: true).Show(new[] { tier }),
                Ui.Text($"<b>{name}</b> — {detail}", "prose__bullet-text")));

        private void Term(string term, string description) =>
            Add(Ui.Div("prose__term").Children(Ui.Text(term, "prose__term-name"), Ui.Text(description, "prose__term-text")));

        private void Row(string label, string value, bool isHead = false) =>
            Add(Ui.Div("prose__row", isHead ? "prose__row--head" : null).Children(
                Ui.Text(label, "prose__row-label"), Ui.Text(value, "prose__row-value")));
    }
}

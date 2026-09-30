using System;

namespace TrapTheOrb.Engine
{
    public enum GameMode
    {
        Classic,
        Daily,
        TimeAttack,
        LimitedWalls,
        Hardcore,
        Zen,
        Custom,
    }

    /// <summary>Mode ids shared with the web game and the API ("timeAttack", …).</summary>
    public static class GameModeIds
    {
        private static readonly string[] Ids = { "classic", "daily", "timeAttack", "limitedWalls", "hardcore", "zen", "custom" };

        public static string Id(this GameMode mode) => Ids[(int)mode];

        public static bool TryParse(string id, out GameMode mode)
        {
            int index = Array.IndexOf(Ids, id);
            mode = index >= 0 ? (GameMode)index : GameMode.Classic;
            return index >= 0;
        }
    }
}

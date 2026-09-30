namespace TrapTheOrb.Engine
{
    /// <summary>State of one grid cell.</summary>
    public static class CellState
    {
        public const byte Free = 0;
        public const byte Wall = 1;
        public const byte Captured = 2;
    }

    public enum Orientation
    {
        Vertical,
        Horizontal,
    }

    /// <summary>Landscape is 300 × 150 cells; portrait is the same field turned on its side.</summary>
    public enum FieldOrientation
    {
        Landscape,
        Portrait,
    }

    public enum GameStatus
    {
        Ready,
        Playing,
        Paused,
        LevelComplete,
        GameOver,
    }

    public enum GameOverReason
    {
        Lives,
        Time,
        Walls,
    }

    /// <summary>Lives reset every level, last for the whole run, or never run out.</summary>
    public enum LivesPolicy
    {
        PerLevel,
        PerRun,
        Infinite,
    }

    /// <summary>What changed compared with the previous level — shown to the player.</summary>
    public enum LevelChange
    {
        First,
        NewOrb,
        SpeedUp,
        Breather,
        Repeat,
    }

    public enum WallRejectReason
    {
        NotPlaying,
        Busy,
        Solid,
        NoWalls,
    }
}

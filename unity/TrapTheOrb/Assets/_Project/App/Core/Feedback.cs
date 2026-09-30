namespace TrapTheOrb.App.Core
{
    /// <summary>The game's sound effects (audio/sfx.ts).</summary>
    public enum SoundName
    {
        Start,
        Build,
        Wall,
        Capture,
        Break,
        Blocked,
        Level,
        GameOver,
    }

    /// <summary>Sound plus haptics, both behind the same on/off switch, like the web game.</summary>
    public interface IFeedback
    {
        void Play(SoundName name);
    }

    /// <summary>For tests and for the moments before the app has audio.</summary>
    public sealed class SilentFeedback : IFeedback
    {
        public void Play(SoundName name)
        {
        }
    }
}

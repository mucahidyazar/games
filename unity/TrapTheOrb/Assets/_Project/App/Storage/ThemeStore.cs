using TrapTheOrb.App.Rendering;

namespace TrapTheOrb.App.Storage
{
    /// <summary>The chosen theme, stored like the web's "games.theme" ("navy" or "light", navy by default).</summary>
    public sealed class ThemeStore
    {
        private const string LightId = "light";
        private const string NavyId = "navy";
        private readonly IKeyValueStore storage;

        public ThemeStore(IKeyValueStore storage)
        {
            this.storage = storage;
        }

        public Theme Current { get; private set; } = Theme.Navy;

        public Theme Load()
        {
            Current = Parse(storage?.GetItem(StorageKeys.Theme));
            return Current;
        }

        public void Save(Theme theme)
        {
            Current = theme;
            storage?.SetItem(StorageKeys.Theme, theme == Theme.Light ? LightId : NavyId);
        }

        public static Theme Parse(string value) => value == LightId ? Theme.Light : Theme.Navy;
    }
}

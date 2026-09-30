using TrapTheOrb.App.Storage;
using UnityEngine;

namespace TrapTheOrb.App.Platform
{
    /// <summary>The device's key-value storage, flushed on every write so progress survives the app being killed.</summary>
    public sealed class PlayerPrefsStore : IKeyValueStore
    {
        public string GetItem(string key) => PlayerPrefs.HasKey(key) ? PlayerPrefs.GetString(key) : null;

        public void SetItem(string key, string value)
        {
            PlayerPrefs.SetString(key, value);
            PlayerPrefs.Save();
        }

        public void RemoveItem(string key)
        {
            PlayerPrefs.DeleteKey(key);
            PlayerPrefs.Save();
        }
    }
}

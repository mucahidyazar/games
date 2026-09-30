using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using UnityEngine;
using UnityEngine.UIElements;

namespace TrapTheOrb.App.Bootstrap
{
    /// <summary>The assets the code-built UI needs at runtime; filled by the project setup in the editor.</summary>
    [CreateAssetMenu(fileName = "AppAssets", menuName = "Trap The Orb/App Assets")]
    public sealed class AppAssets : ScriptableObject
    {
        [SerializeField] private StyleSheet[] styleSheets = Array.Empty<StyleSheet>();

        [Tooltip("Orb sprites by speed tier: calm, quick, fast, blazing.")]
        [SerializeField] private Texture2D[] orbTextures = Array.Empty<Texture2D>();

        [Tooltip("One clip per SoundName, in the enum's order.")]
        [SerializeField] private AudioClip[] sounds = Array.Empty<AudioClip>();

        public IReadOnlyList<StyleSheet> StyleSheets => styleSheets;
        public IReadOnlyList<Texture2D> OrbTextures => orbTextures;

        public IReadOnlyDictionary<SoundName, AudioClip> Sounds()
        {
            var clips = new Dictionary<SoundName, AudioClip>();
            foreach (SoundName name in Enum.GetValues(typeof(SoundName)))
            {
                int index = (int)name;
                if (index < sounds.Length && sounds[index] != null) clips[name] = sounds[index];
            }
            return clips;
        }

#if UNITY_EDITOR
        public void Assign(StyleSheet[] sheets, Texture2D[] orbs, AudioClip[] clips)
        {
            styleSheets = sheets;
            orbTextures = orbs;
            sounds = clips;
        }
#endif
    }
}

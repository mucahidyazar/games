using System;
using System.Collections.Generic;
using TrapTheOrb.App.Core;
using UnityEngine;

namespace TrapTheOrb.App.Platform
{
    /// <summary>
    /// Game feedback: the web game's sounds (baked from its Web Audio recipes, audio/sfx.ts) plus haptics. Each has
    /// its own switch: <see cref="IsEnabled"/> for sound, <see cref="Haptics.IsEnabled"/> for vibration.
    /// </summary>
    public sealed class SoundPlayer : IFeedback
    {
        /// <summary>The web's master gain.</summary>
        private const float Volume = 0.55f;

        private readonly AudioSource source;
        private readonly IReadOnlyDictionary<SoundName, AudioClip> clips;

        public SoundPlayer(AudioSource source, IReadOnlyDictionary<SoundName, AudioClip> clips)
        {
            this.source = source ? source : throw new ArgumentNullException(nameof(source));
            this.clips = clips ?? throw new ArgumentNullException(nameof(clips));
            source.playOnAwake = false;
            source.spatialBlend = 0;
            source.volume = Volume;
        }

        public bool IsEnabled { get; set; } = true;

        public void Play(SoundName name)
        {
            Haptics.Play(name);
            if (!IsEnabled) return;
            if (clips.TryGetValue(name, out AudioClip clip) && clip != null) source.PlayOneShot(clip);
        }
    }
}

using System;
using System.Collections.Generic;
using TrapTheOrb.Engine;

namespace TrapTheOrb.App.Storage
{
    /// <summary>Everything stored about the player, as one immutable value.</summary>
    public sealed record PlayerSnapshot(Settings Settings, IReadOnlyList<HighScore> HighScores, SavedRun SavedRun);

    /// <summary>
    /// Settings, high scores and the resumable run of the player on this device (state/playerStore.ts).
    /// The snapshot is replaced on every change and <see cref="Changed"/> fires.
    /// </summary>
    public sealed class PlayerStore
    {
        private const string DefaultPlayerName = "Player";

        private readonly IKeyValueStore storage;
        private readonly Func<double> nowMs;
        private readonly Func<string> createId;

        public PlayerStore(IKeyValueStore storage, Func<double> nowMs, Func<string> createId = null)
        {
            this.storage = storage;
            this.nowMs = nowMs ?? throw new ArgumentNullException(nameof(nowMs));
            this.createId = createId ?? (() => Guid.NewGuid().ToString());
            Snapshot = new PlayerSnapshot(SettingsStorage.Load(storage), HighScores.Load(storage), SavedRuns.Load(storage));
        }

        public event Action Changed;

        public PlayerSnapshot Snapshot { get; private set; }

        public void SetSoundEnabled(bool enabled) => UpdateSettings(Snapshot.Settings with { SoundEnabled = enabled });

        /// <summary>Remembers the mode the game should open with.</summary>
        public void SetLastMode(GameMode mode)
        {
            if (mode != Snapshot.Settings.LastMode) UpdateSettings(Snapshot.Settings with { LastMode = mode });
        }

        public void SetCustomSettings(CustomSettings custom) =>
            UpdateSettings(Snapshot.Settings with { Custom = Modes.SanitizeCustomSettings(custom) });

        /// <summary>Saves a finished run on this device; returns its 1-based rank in its mode, or null.</summary>
        public int? SubmitHighScore(string name, GameMode mode, long score, int level)
        {
            string cleanName = SettingsStorage.SanitizeNickname(name);
            if (cleanName.Length == 0) cleanName = DefaultPlayerName;
            var entry = new HighScore(createId(), cleanName, mode, score, level, nowMs());
            AddHighScoreResult result = HighScores.Add(Snapshot.HighScores, entry);
            if (cleanName != Snapshot.Settings.Nickname) UpdateSettings(Snapshot.Settings with { Nickname = cleanName });
            if (result.Rank == null) return null;

            HighScores.Save(storage, result.Scores);
            Replace(Snapshot with { HighScores = result.Scores });
            return result.Rank;
        }

        /// <summary>Remembers where an unfinished unranked game stands; level 1 needs no saving.</summary>
        public void SaveRun(GameMode mode, CustomSettings custom, int level, long score)
        {
            if (level < 2)
            {
                // A fresh start replaces the save of the same mode only.
                if (Snapshot.SavedRun?.Mode == mode) ClearRun();
                return;
            }
            var run = new SavedRun(mode, mode == GameMode.Custom ? custom : null, level, score, nowMs());
            SavedRuns.Save(storage, run);
            Replace(Snapshot with { SavedRun = run });
        }

        public void ClearRun()
        {
            if (Snapshot.SavedRun == null) return;
            SavedRuns.Clear(storage);
            Replace(Snapshot with { SavedRun = null });
        }

        public void ClearScores()
        {
            storage?.RemoveItem(StorageKeys.HighScores);
            Replace(Snapshot with { HighScores = new HighScore[0] });
        }

        private void UpdateSettings(Settings settings)
        {
            SettingsStorage.Save(storage, settings);
            Replace(Snapshot with { Settings = settings });
        }

        private void Replace(PlayerSnapshot next)
        {
            Snapshot = next;
            Changed?.Invoke();
        }
    }
}

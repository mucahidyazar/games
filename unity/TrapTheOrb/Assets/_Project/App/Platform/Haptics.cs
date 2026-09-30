using System;
using TrapTheOrb.App.Core;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace TrapTheOrb.App.Platform
{
    /// <summary>
    /// Short vibrations for the moments that matter: a broken wall, a cleared level and game over — the web's
    /// navigator.vibrate patterns on Android, the matching system feedback on iOS.
    /// </summary>
    public static class Haptics
    {
        private enum Kind
        {
            Break = 0,
            Level = 1,
            GameOver = 2,
        }

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void TTO_Haptic(int kind);
#endif

#if UNITY_ANDROID && !UNITY_EDITOR
        private static AndroidJavaObject vibrator;
        private static bool isVibratorResolved;
#endif

        public static void Play(SoundName name)
        {
            Kind? kind = name switch
            {
                SoundName.Break => Kind.Break,
                SoundName.Level => Kind.Level,
                SoundName.GameOver => Kind.GameOver,
                _ => null,
            };
            if (kind is Kind chosen) Play(chosen);
        }

        private static void Play(Kind kind)
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                TTO_Haptic((int)kind);
#elif UNITY_ANDROID && !UNITY_EDITOR
                Vibrate(kind switch
                {
                    Kind.Break => new long[] { 0, 45 },
                    Kind.Level => new long[] { 0, 30, 50, 30 },
                    _ => new long[] { 0, 90, 60, 140 },
                });
#endif
            }
            catch (Exception error)
            {
                // Haptics are a nicety; a device that refuses them must not break the game.
                Debug.LogWarning($"Haptics unavailable: {error.Message}");
            }
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private static void Vibrate(long[] pattern)
        {
            if (!isVibratorResolved)
            {
                isVibratorResolved = true;
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
            }
            if (vibrator == null || !vibrator.Call<bool>("hasVibrator")) return;
            using var effects = new AndroidJavaClass("android.os.VibrationEffect");
            using AndroidJavaObject effect = effects.CallStatic<AndroidJavaObject>("createWaveform", pattern, -1);
            vibrator.Call("vibrate", effect);
        }
#endif
    }
}

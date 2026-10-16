using System;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace TrapTheOrb.App.Platform
{
    /// <summary>
    /// The system's request for less motion: Reduce Motion on iOS, "Remove animations" (an animator duration
    /// scale of 0) on Android. The game honours it whatever its own setting says.
    /// </summary>
    public static class MotionPreference
    {
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern int TTO_ReduceMotion();
#endif

        /// <summary>Whether the player asked the system for less motion; false where the platform cannot tell.</summary>
        public static bool IsReducedBySystem()
        {
            bool isReduced = false;
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                isReduced = TTO_ReduceMotion() != 0;
#elif UNITY_ANDROID && !UNITY_EDITOR
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using AndroidJavaObject resolver = activity.Call<AndroidJavaObject>("getContentResolver");
                using var global = new AndroidJavaClass("android.provider.Settings$Global");
                isReduced = global.CallStatic<float>("getFloat", resolver, "animator_duration_scale", 1f) == 0f;
#endif
            }
            catch (Exception error)
            {
                Debug.LogWarning($"Reduce motion setting unavailable: {error.Message}");
            }
            return isReduced;
        }
    }
}

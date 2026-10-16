using System;
using UnityEngine;

namespace TrapTheOrb.App.Platform
{
    /// <summary>Leaving the app the way the platform expects.</summary>
    public static class AppLifecycle
    {
        /// <summary>
        /// Back on the first screen: Android apps go to the background and stay in memory rather than quit, so
        /// the next launch resumes at once. Nothing to do elsewhere.
        /// </summary>
        public static void MoveToBackground()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                activity.Call<bool>("moveTaskToBack", true);
            }
            catch (Exception error)
            {
                Debug.LogWarning($"Could not move the app to the background: {error.Message}");
            }
#endif
        }
    }
}

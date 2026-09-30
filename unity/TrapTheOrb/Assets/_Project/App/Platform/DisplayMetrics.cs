using System;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace TrapTheOrb.App.Platform
{
    /// <summary>
    /// Device pixels per UI unit — the browser's devicePixelRatio — so the UI has the web game's CSS-pixel sizes:
    /// UIScreen.nativeScale on iOS, DisplayMetrics.density on Android.
    /// </summary>
    public static class DisplayMetrics
    {
        /// <summary>Width of the phone the editor stands in for (an iPhone 15 Pro is 393 points wide).</summary>
        private const float EditorReferenceWidth = 393;

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern float TTO_ScreenScale();
#endif

        public static float Scale()
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                float scale = TTO_ScreenScale();
                if (scale > 0) return scale;
#elif UNITY_ANDROID && !UNITY_EDITOR
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using AndroidJavaObject resources = activity.Call<AndroidJavaObject>("getResources");
                using AndroidJavaObject metrics = resources.Call<AndroidJavaObject>("getDisplayMetrics");
                float density = metrics.Get<float>("density");
                if (density > 0) return density;
#endif
            }
            catch (Exception error)
            {
                Debug.LogWarning($"Screen scale unavailable, estimating: {error.Message}");
            }
            return Estimate();
        }

        /// <summary>Portrait screens are laid out as a 393-point phone; others from their DPI.</summary>
        private static float Estimate()
        {
            float shortSide = Math.Min(Screen.width, Screen.height);
            if (Application.isEditor || Screen.dpi <= 0) return Math.Max(1, shortSide / EditorReferenceWidth);
            return Math.Max(1, Screen.dpi / 160f);
        }
    }
}

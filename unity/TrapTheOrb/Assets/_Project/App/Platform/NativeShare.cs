using System;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace TrapTheOrb.App.Platform
{
    /// <summary>The system share sheet; the editor copies the text instead.</summary>
    public static class NativeShare
    {
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void TTO_Share(string text);
#endif

        public static void Share(string text)
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                TTO_Share(text);
#elif UNITY_ANDROID && !UNITY_EDITOR
                using var intent = new AndroidJavaObject("android.content.Intent", "android.intent.action.SEND");
                intent.Call<AndroidJavaObject>("setType", "text/plain");
                intent.Call<AndroidJavaObject>("putExtra", "android.intent.extra.TEXT", text);
                using var intents = new AndroidJavaClass("android.content.Intent");
                using AndroidJavaObject chooser = intents.CallStatic<AndroidJavaObject>("createChooser", intent, "Share your score");
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                activity.Call("startActivity", chooser);
#else
                GUIUtility.systemCopyBuffer = text;
#endif
            }
            catch (Exception error)
            {
                Debug.LogWarning($"Sharing failed: {error.Message}");
            }
        }
    }
}

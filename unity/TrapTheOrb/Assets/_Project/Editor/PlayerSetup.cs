using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace TrapTheOrb.EditorTools
{
    /// <summary>Identity, orientation, icons and platform options of the iOS and Android apps.</summary>
    public static class PlayerSetup
    {
        public const string BundleId = "dev.mucahid.traptheorb";
        private const string IconFolder = ProjectSetup.Root + "/Art/AppIcon";
        private static readonly Color Navy = new Color32(0x0b, 0x16, 0x30, 255);

        public static void Configure()
        {
            PlayerSettings.companyName = "mucahid.dev";
            PlayerSettings.productName = "Trap The Orb";
            PlayerSettings.bundleVersion = "1.0.0";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, BundleId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, BundleId);
            PlayerSettings.iOS.buildNumber = "1";
            PlayerSettings.Android.bundleVersionCode = 1;

            // The board is laid out for a tall field; the game runs upright only.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;
            PlayerSettings.statusBarHidden = true;
            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SplashScreen.backgroundColor = Navy;

            PlayerSettings.SetScriptingBackend(NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.iOS, ManagedStrippingLevel.Low);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Low);

            PlayerSettings.iOS.targetOSVersionString = "15.0";
            PlayerSettings.iOS.requiresFullScreen = true;
            PlayerSettings.iOS.appleEnableAutomaticSigning = true;
            PlayerSettings.iOS.simulatorSdkArchitecture = AppleMobileArchitectureSimulator.ARM64;

            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.renderOutsideSafeArea = true;

            ConfigureIcons();
        }

        private static void ConfigureIcons()
        {
            Texture2D icon = ProjectSetup.Load<Texture2D>($"{IconFolder}/app-icon-1024.png");
            // The default icon: Unity scales it to every size iOS and legacy Android launchers need.
            PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);

            Texture2D foreground = ProjectSetup.Load<Texture2D>($"{IconFolder}/adaptive-foreground.png");
            Texture2D background = ProjectSetup.Load<Texture2D>($"{IconFolder}/adaptive-background.png");
            PlatformIcon[] adaptive = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, UnityEditor.Android.AndroidPlatformIconKind.Adaptive);
            foreach (PlatformIcon slot in adaptive) slot.SetTextures(background, foreground);
            PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, UnityEditor.Android.AndroidPlatformIconKind.Adaptive, adaptive);
        }
    }
}

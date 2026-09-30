using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace TrapTheOrb.EditorTools
{
    /// <summary>
    /// Player builds for batch mode, e.g.
    /// Unity -batchmode -quit -projectPath unity/TrapTheOrb -buildTarget iOS -executeMethod TrapTheOrb.EditorTools.BuildScripts.IosSimulator
    /// Output goes to Builds/ in the project folder. A failed build throws, so batch mode exits with an error.
    /// </summary>
    public static class BuildScripts
    {
        private const string BuildFolder = "Builds";

        [MenuItem("Trap The Orb/Build/iOS Simulator (Xcode project)")]
        public static void IosSimulator() => BuildIos(iOSSdkVersion.SimulatorSDK, "iOS-Simulator");

        [MenuItem("Trap The Orb/Build/iOS Device (Xcode project)")]
        public static void IosDevice() => BuildIos(iOSSdkVersion.DeviceSDK, "iOS-Device");

        [MenuItem("Trap The Orb/Build/Android APK")]
        public static void AndroidApk()
        {
            EditorUserBuildSettings.buildAppBundle = false;
            Build(BuildTarget.Android, Path.Combine(BuildFolder, "Android", "TrapTheOrb.apk"), BuildOptions.None);
        }

        private static void BuildIos(iOSSdkVersion sdk, string folder)
        {
            PlayerSettings.iOS.sdkVersion = sdk;
            Build(BuildTarget.iOS, Path.Combine(BuildFolder, folder), BuildOptions.None);
        }

        private static void Build(BuildTarget target, string output, BuildOptions options)
        {
            string[] scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(scene => scene.path).ToArray();
            if (scenes.Length == 0) throw new InvalidOperationException("No scenes to build; run Trap The Orb > Set Up Project first.");

            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = output,
                target = target,
                options = options,
            });
            BuildSummary summary = report.summary;
            if (summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException($"{target} build {summary.result}: {summary.totalErrors} errors. See the log.");
            }
            Debug.Log($"{target} build succeeded: {summary.outputPath} ({summary.totalSize / (1024 * 1024)} MB, {summary.totalTime.TotalSeconds:0}s)");
        }
    }
}

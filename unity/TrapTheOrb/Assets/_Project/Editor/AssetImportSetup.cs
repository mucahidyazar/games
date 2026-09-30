using UnityEditor;
using UnityEngine;

namespace TrapTheOrb.EditorTools
{
    /// <summary>Import settings for the baked orb sprites, the orb dots and the app icons.</summary>
    public static class TextureSetup
    {
        public static void Configure()
        {
            for (int tier = 0; tier < 4; tier++)
            {
                // Orbs are drawn much smaller than baked, so they need mipmaps to stay smooth.
                Apply($"{ProjectSetup.Root}/Art/Orbs/orb-tier{tier}.png", mipmaps: true);
                Apply($"{ProjectSetup.Root}/Art/Orbs/lineup-tier{tier}.png", mipmaps: true);
            }
            foreach (string icon in new[] { "app-icon-1024", "adaptive-foreground", "adaptive-background" })
            {
                Apply($"{ProjectSetup.Root}/Art/AppIcon/{icon}.png", mipmaps: false);
            }
        }

        private static void Apply(string path, bool mipmaps)
        {
            if (!(AssetImporter.GetAtPath(path) is TextureImporter importer)) return;
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = true;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = mipmaps;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = mipmaps ? FilterMode.Trilinear : FilterMode.Bilinear;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.SaveAndReimport();
        }
    }

    /// <summary>The short effect sounds are decompressed on load so they play without delay.</summary>
    public static class AudioSetup
    {
        public static void Configure()
        {
            foreach (string guid in AssetDatabase.FindAssets("t:AudioClip", new[] { ProjectSetup.Root + "/Audio" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (!(AssetImporter.GetAtPath(path) is AudioImporter importer)) continue;
                importer.forceToMono = true;
                AudioImporterSampleSettings settings = importer.defaultSampleSettings;
                settings.loadType = AudioClipLoadType.DecompressOnLoad;
                settings.compressionFormat = AudioCompressionFormat.ADPCM;
                settings.preloadAudioData = true;
                importer.defaultSampleSettings = settings;
                importer.SaveAndReimport();
            }
        }
    }
}

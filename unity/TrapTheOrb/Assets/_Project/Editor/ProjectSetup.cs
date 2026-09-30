using System.IO;
using System.Linq;
using TrapTheOrb.App.Bootstrap;
using TrapTheOrb.App.Core;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;
using UnityEngine.TextCore.Text;
using UnityEngine.UIElements;

namespace TrapTheOrb.EditorTools
{
    /// <summary>
    /// Creates everything the code-built game needs that only the editor can make: font assets, the panel settings,
    /// the asset list, the scene and the player settings. Safe to run again; it updates what exists.
    /// </summary>
    public static class ProjectSetup
    {
        public const string Root = "Assets/_Project";
        private const string FontFolder = Root + "/UI/Fonts";
        private const string StyleFolder = Root + "/UI/Styles";
        private const string ThemePath = StyleFolder + "/RuntimeTheme.tss";
        private const string PanelSettingsPath = Root + "/UI/PanelSettings.asset";
        private const string AppAssetsPath = Root + "/AppAssets.asset";
        private const int FontSamplingSize = 90;

        /// <summary>Padding wide enough for the 2px outline of the "+120" capture text.</summary>
        private const int FontAtlasPadding = 12;
        private const int FontAtlasSize = 1024;

        private static readonly string[] FontWeights = { "Regular", "Medium", "SemiBold", "Bold", "ExtraBold" };
        private static readonly string[] StyleSheets = { "Tokens", "Base", "Game", "Panels", "Dialogs" };

        [MenuItem("Trap The Orb/Set Up Project")]
        public static void Run()
        {
            CreateFontAssets();
            TextureSetup.Configure();
            AudioSetup.Configure();
            AssetDatabase.Refresh();
            // Style sheets resolve the font assets when they import, so import them again now that the fonts exist.
            foreach (string sheet in StyleSheets) AssetDatabase.ImportAsset($"{StyleFolder}/{sheet}.uss", ImportAssetOptions.ForceUpdate);

            PanelSettings panel = CreatePanelSettings(CreateRuntimeTheme());
            AppAssets assets = CreateAppAssets();
            SceneSetup.Create(panel, assets);
            PlayerSetup.Configure();
            AssetDatabase.SaveAssets();
            Debug.Log("Trap The Orb: project set up.");
        }

        private static void CreateFontAssets()
        {
            FontAsset regular = null;
            FontAsset bold = null;
            foreach (string weight in FontWeights)
            {
                string path = $"{FontFolder}/PlusJakartaSans-{weight}-SDF.asset";
                FontAsset asset = AssetDatabase.LoadAssetAtPath<FontAsset>(path) ?? CreateFontAsset(weight, path);
                if (weight == "Regular") regular = asset;
                if (weight == "Bold") bold = asset;
            }

            // Rich text <b> in the regular font uses the real bold face instead of a synthesised one.
            if (regular != null && bold != null && regular.fontWeightTable.Length > 7)
            {
                regular.fontWeightTable[7].regularTypeface = bold;
                EditorUtility.SetDirty(regular);
            }
        }

        private static FontAsset CreateFontAsset(string weight, string path)
        {
            var font = AssetDatabase.LoadAssetAtPath<Font>($"{FontFolder}/PlusJakartaSans-{weight}.ttf");
            if (font == null) throw new FileNotFoundException($"Missing font PlusJakartaSans-{weight}.ttf");

            FontAsset asset = FontAsset.CreateFontAsset(font, FontSamplingSize, FontAtlasPadding, GlyphRenderMode.SDFAA,
                FontAtlasSize, FontAtlasSize, AtlasPopulationMode.Dynamic, enableMultiAtlasSupport: true);
            asset.name = Path.GetFileNameWithoutExtension(path);
            AssetDatabase.CreateAsset(asset, path);

            Texture2D atlas = asset.atlasTextures[0];
            atlas.name = asset.name + " Atlas";
            AssetDatabase.AddObjectToAsset(atlas, asset);
            asset.material.name = asset.name + " Material";
            AssetDatabase.AddObjectToAsset(asset.material, asset);
            EditorUtility.SetDirty(asset);
            AssetDatabase.SaveAssets();
            return asset;
        }

        private static ThemeStyleSheet CreateRuntimeTheme()
        {
            if (!File.Exists(ThemePath))
            {
                File.WriteAllText(ThemePath, "@import url(\"unity-theme://default\");\n");
                AssetDatabase.ImportAsset(ThemePath);
            }
            return AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(ThemePath);
        }

        private static PanelSettings CreatePanelSettings(ThemeStyleSheet theme)
        {
            PanelSettings panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelSettingsPath);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(panel, PanelSettingsPath);
            }
            panel.themeStyleSheet = theme;
            // The game sets the scale at start-up from the device's pixel density.
            panel.scaleMode = PanelScaleMode.ConstantPixelSize;
            panel.scale = 1;
            panel.referenceDpi = 160;
            panel.fallbackDpi = 160;
            panel.clearColor = false;
            EditorUtility.SetDirty(panel);
            return panel;
        }

        private static AppAssets CreateAppAssets()
        {
            AppAssets assets = AssetDatabase.LoadAssetAtPath<AppAssets>(AppAssetsPath);
            if (assets == null)
            {
                assets = ScriptableObject.CreateInstance<AppAssets>();
                AssetDatabase.CreateAsset(assets, AppAssetsPath);
            }

            StyleSheet[] sheets = StyleSheets.Select(name => Load<StyleSheet>($"{StyleFolder}/{name}.uss")).ToArray();
            Texture2D[] orbs = Enumerable.Range(0, 4).Select(tier => Load<Texture2D>($"{Root}/Art/Orbs/orb-tier{tier}.png")).ToArray();
            AudioClip[] clips = System.Enum.GetNames(typeof(SoundName))
                .Select(name => Load<AudioClip>($"{Root}/Audio/{char.ToLowerInvariant(name[0])}{name.Substring(1)}.wav"))
                .ToArray();
            assets.Assign(sheets, orbs, clips);
            EditorUtility.SetDirty(assets);
            return assets;
        }

        public static T Load<T>(string path) where T : Object
        {
            T asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset == null) throw new FileNotFoundException($"Missing asset {path}");
            return asset;
        }
    }
}

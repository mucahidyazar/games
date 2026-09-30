using TrapTheOrb.App.Bootstrap;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace TrapTheOrb.EditorTools
{
    /// <summary>The single scene: a camera that only clears, the event system for touch input and the game's UI document.</summary>
    public static class SceneSetup
    {
        public const string ScenePath = ProjectSetup.Root + "/Scenes/Main.unity";

        /// <summary>--color-page of the navy theme, shown for the frame before the UI draws.</summary>
        private static readonly Color PageColor = new Color32(0x0b, 0x16, 0x30, 255);

        public static void Create(PanelSettings panel, AppAssets assets)
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(ScenePath));
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var cameraObject = new GameObject("Main Camera") { tag = "MainCamera" };
            var camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = PageColor;
            camera.cullingMask = 0;
            camera.orthographic = true;
            cameraObject.AddComponent<AudioListener>();

            var events = new GameObject("EventSystem");
            events.AddComponent<EventSystem>();
            events.AddComponent<InputSystemUIInputModule>();

            var game = new GameObject("Game");
            var document = game.AddComponent<UIDocument>();
            document.panelSettings = panel;
            var app = game.AddComponent<GameApp>();
            var serialized = new SerializedObject(app);
            serialized.FindProperty("assets").objectReferenceValue = assets;
            serialized.ApplyModifiedPropertiesWithoutUndo();

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }
    }
}

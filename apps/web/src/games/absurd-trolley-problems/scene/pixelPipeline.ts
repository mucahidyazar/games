import {
  Color,
  DepthTexture,
  HalfFloatType,
  Mesh,
  MeshNormalMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { GPU_QUALITY, type RenderQuality } from './quality'

/**
 * Renders the scene the way pixel art is drawn: at a few hundred pixels
 * tall, with dark outlines where shapes overlap, a soft glow around lights,
 * colours pulled towards the key frame's palette, and every pixel blown up
 * into a crisp square on screen.
 */

/** Art pixels from top to bottom of the frame: the key frame is about 180. */
export const TARGET_ART_HEIGHT = 200

/** The key frame's colours (k-means over the scene) plus the cast's accents. */
export const PALETTE = [
  // From the key frame.
  '#394a6a', '#03253e', '#020d23', '#3f5378', '#556385', '#26304d', '#617697', '#061d37', '#293c60', '#03142e',
  '#847f8b', '#0e366b', '#0b2c5a', '#2c5193', '#0f2248', '#050306', '#060814', '#1e253a', '#393f53', '#f7ebd6',
  '#586161', '#a46f52', '#1c447f', '#1e1b27', '#0c3848', '#787968', '#402d2c', '#3b5d54', '#22494b', '#ddc9b3',
  '#825643', '#aa937c', '#5b433e', '#f4b580', '#2a1410', '#93a5c1', '#e79845', '#3b69b3', '#64301d', '#e3503b',
  // Lights, skin, clothes and greens the key frame only shows in tiny areas.
  '#ffe7a3', '#ffd36b', '#fff6dc', '#ffb347', '#f0c39c', '#d9a074', '#b97a55', '#8a5638', '#f27fa5', '#c95a82',
  '#3fb56b', '#2c7d4c', '#f2c14e', '#8c5bd6', '#5d3f99', '#2bb3a3', '#7fe3b8', '#7fd8ff', '#2f5fbf', '#c9ccd3',
  '#4f8a4f', '#6aa45a', '#2f4a3a', '#d94a44',
] as const

const MAX_PALETTE = 64

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const BRIGHT_FRAGMENT = /* glsl */ `
  uniform sampler2D tBack;
  uniform sampler2D tMain;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec4 main = texture2D(tMain, vUv);
    vec3 color = mix(texture2D(tBack, vUv).rgb, main.rgb, main.a);
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor = vec4(color * smoothstep(uThreshold, uThreshold + 0.6, luma), 1.0);
  }
`

const BLUR_FRAGMENT = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tInput, vUv).rgb * 0.2270270270;
    sum += texture2D(tInput, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(tInput, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(tInput, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
    sum += texture2D(tInput, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D tBack;
  uniform sampler2D tMain;
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform sampler2D tBloom;
  uniform sampler2D tOverlay;
  uniform vec2 uTexel;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uOutline;
  uniform float uPaletteMix;
  uniform float uDither;
  uniform vec3 uOutlineTint;
  uniform vec3 uPalette[${MAX_PALETTE}];
  uniform int uPaletteSize;
  varying vec2 vUv;

  float viewDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    if (texture2D(tMain, uv).a < 0.5) return uFar;
    return (uNear * uFar) / (uFar - d * (uFar - uNear));
  }

  vec3 viewNormal(vec2 uv) {
    return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);
  }

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  vec3 toSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[x + y * 4] + 0.5) / 16.0;
  }

  vec3 nearestColor(vec3 c) {
    float best = 1e9;
    vec3 result = c;
    for (int i = 0; i < ${MAX_PALETTE}; i++) {
      if (i >= uPaletteSize) break;
      vec3 p = uPalette[i];
      vec3 d = c - p;
      float r = (c.r + p.r) * 0.5;
      float dist = (2.0 + r) * d.r * d.r + 4.0 * d.g * d.g + (3.0 - r) * d.b * d.b;
      if (dist < best) {
        best = dist;
        result = p;
      }
    }
    return result;
  }

  void main() {
    vec4 main = texture2D(tMain, vUv);
    vec3 color = mix(texture2D(tBack, vUv).rgb, main.rgb, main.a);

    // Outlines: darken the nearer side of a depth step, and creases where normals turn.
    if (main.a > 0.5 && uOutline > 0.0) {
      float depth = viewDepth(vUv);
      float edge = 0.0;
      #if CREASES
      vec3 normal = viewNormal(vUv);
      float crease = 0.0;
      #endif
      vec2 offsets[4] = vec2[4](vec2(uTexel.x, 0.0), vec2(-uTexel.x, 0.0), vec2(0.0, uTexel.y), vec2(0.0, -uTexel.y));
      for (int i = 0; i < 4; i++) {
        float other = viewDepth(vUv + offsets[i]);
        float step = other - depth;
        edge = max(edge, smoothstep(0.06 * depth, 0.12 * depth, step));
        #if CREASES
        if (abs(step) < 0.05 * depth) {
          vec3 n = viewNormal(vUv + offsets[i]);
          crease = max(crease, smoothstep(0.55, 0.25, dot(normal, n)));
        }
        #endif
      }
      vec3 dark = color * uOutlineTint;
      color = mix(color, dark, edge * uOutline);
      #if CREASES
      color = mix(color, color * 0.78, crease * uOutline * (1.0 - edge));
      #endif
    }

    color += texture2D(tBloom, vUv).rgb * uBloom;
    vec4 overlay = texture2D(tOverlay, vUv);
    color = mix(color, overlay.rgb, overlay.a);

    color = toSrgb(aces(color * uExposure));

    // Pull towards the palette, with ordered dithering so gradients break into pixel steps.
    if (uPaletteMix > 0.0) {
      float threshold = bayer4(floor(vUv * uResolution)) - 0.5;
      vec3 dithered = clamp(color + threshold * uDither, 0.0, 1.0);
      color = mix(color, nearestColor(dithered), uPaletteMix);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`

const UPSCALE_FRAGMENT = /* glsl */ `
  uniform sampler2D tInput;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(tInput, vUv).rgb, 1.0);
  }
`

function target(width: number, height: number, options: { readonly float?: boolean; readonly depth?: boolean } = {}): WebGLRenderTarget {
  const rt = new WebGLRenderTarget(width, height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    format: RGBAFormat,
    type: options.float ? HalfFloatType : UnsignedByteType,
    depthBuffer: Boolean(options.depth),
    generateMipmaps: false,
  })
  if (options.depth) {
    rt.depthTexture = new DepthTexture(width, height, UnsignedIntType)
    rt.depthTexture.minFilter = NearestFilter
    rt.depthTexture.magFilter = NearestFilter
  }
  return rt
}

export interface PipelineFrame {
  readonly main: Scene
  readonly mainCamera: PerspectiveCamera
  readonly back: Scene
  readonly backCamera: Camera
  readonly overlay: Scene
}

export interface PipelineLook {
  bloom: number
  exposure: number
  outline: number
  paletteMix: number
  dither: number
}

export class PixelPipeline {
  readonly renderer: WebGLRenderer
  readonly look: PipelineLook = { bloom: 0.42, exposure: 1.1, outline: 1, paletteMix: 0.85, dither: 0.06 }
  /** Whether to draw the normals pass behind the crease lines (see quality.ts). */
  readonly creases: boolean
  width = 1
  height = 1
  pixelSize = 1

  private readonly back = target(1, 1, { float: true, depth: true })
  private readonly main = target(1, 1, { float: true, depth: true })
  private readonly normals = target(1, 1, { depth: true })
  private readonly overlay = target(1, 1, { float: true })
  private readonly bloomA = target(1, 1, { float: true })
  private readonly bloomB = target(1, 1, { float: true })
  private readonly composite = target(1, 1)
  private readonly quadScene = new Scene()
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quad: Mesh
  private readonly normalMaterial = new MeshNormalMaterial()
  private readonly bright: ShaderMaterial
  private readonly blur: ShaderMaterial
  private readonly compose: ShaderMaterial
  private readonly upscale: ShaderMaterial

  constructor(renderer: WebGLRenderer, { creases }: Pick<RenderQuality, 'creases'> = GPU_QUALITY) {
    this.renderer = renderer
    this.creases = creases
    renderer.autoClear = false
    // The main scene is drawn twice a frame, and only its colours need the shadows: render() asks for them once.
    renderer.shadowMap.autoUpdate = false
    this.quad = new Mesh(new PlaneGeometry(2, 2))
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)

    const palette = PALETTE.slice(0, MAX_PALETTE).map((hex) => new Color(hex))
    while (palette.length < MAX_PALETTE) palette.push(new Color(0, 0, 0))
    // Colours compare in display (sRGB) space, after tone mapping.
    const paletteSrgb = palette.map((color) => color.clone().convertLinearToSRGB())

    this.bright = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: BRIGHT_FRAGMENT,
      uniforms: { tBack: { value: null }, tMain: { value: null }, uThreshold: { value: 1.25 } },
      depthTest: false,
      depthWrite: false,
    })
    this.blur = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      uniforms: { tInput: { value: null }, uDirection: { value: new Vector2() } },
      depthTest: false,
      depthWrite: false,
    })
    this.compose = new ShaderMaterial({
      defines: { CREASES: Number(creases) },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tBack: { value: null },
        tMain: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        tBloom: { value: null },
        tOverlay: { value: null },
        uTexel: { value: new Vector2() },
        uResolution: { value: new Vector2() },
        uNear: { value: 0.5 },
        uFar: { value: 160 },
        uBloom: { value: this.look.bloom },
        uExposure: { value: this.look.exposure },
        uOutline: { value: this.look.outline },
        uPaletteMix: { value: this.look.paletteMix },
        uDither: { value: this.look.dither },
        // Outlines darken towards the night's navy instead of to grey.
        uOutlineTint: { value: new Vector3(0.3, 0.34, 0.52) },
        uPalette: { value: paletteSrgb },
        uPaletteSize: { value: Math.min(PALETTE.length, MAX_PALETTE) },
      },
      depthTest: false,
      depthWrite: false,
    })
    this.upscale = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: UPSCALE_FRAGMENT,
      uniforms: { tInput: { value: null } },
      depthTest: false,
      depthWrite: false,
    })
  }

  /** Picks the art-pixel size for a canvas shown at `cssWidth` × `cssHeight`. */
  setSize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    const deviceWidth = Math.max(1, Math.round(cssWidth * devicePixelRatio))
    const deviceHeight = Math.max(1, Math.round(cssHeight * devicePixelRatio))
    const pixelSize = Math.max(2, Math.round(deviceHeight / TARGET_ART_HEIGHT))
    const width = Math.max(16, Math.ceil(deviceWidth / pixelSize))
    const height = Math.max(16, Math.ceil(deviceHeight / pixelSize))
    if (width === this.width && height === this.height && pixelSize === this.pixelSize) return
    this.width = width
    this.height = height
    this.pixelSize = pixelSize
    // The canvas holds whole art pixels, each pixelSize device pixels wide; the
    // frame crops the fraction of a pixel that doesn't fit.
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width * pixelSize, height * pixelSize, false)
    const style = this.renderer.domElement.style
    style.width = `${(width * pixelSize) / devicePixelRatio}px`
    style.height = `${(height * pixelSize) / devicePixelRatio}px`
    for (const rt of [this.back, this.main, this.normals, this.overlay, this.composite]) rt.setSize(width, height)
    const bloomWidth = Math.max(8, Math.ceil(width / 2))
    const bloomHeight = Math.max(8, Math.ceil(height / 2))
    this.bloomA.setSize(bloomWidth, bloomHeight)
    this.bloomB.setSize(bloomWidth, bloomHeight)
    this.compose.uniforms.uTexel!.value.set(1 / width, 1 / height)
    this.compose.uniforms.uResolution!.value.set(width, height)
  }

  private pass(material: ShaderMaterial, output: WebGLRenderTarget | null): void {
    this.quad.material = material
    this.renderer.setRenderTarget(output)
    this.renderer.clear()
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  render(frame: PipelineFrame): void {
    const { renderer } = this
    const previousClear = renderer.getClearAlpha()

    renderer.setRenderTarget(this.back)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(frame.back, frame.backCamera)

    renderer.setRenderTarget(this.main)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.shadowMap.needsUpdate = true
    renderer.render(frame.main, frame.mainCamera)

    if (this.creases) {
      // Normals of solid geometry only: layer 1 (markers, particles) stays out of the outlines.
      frame.main.overrideMaterial = this.normalMaterial
      const background = frame.main.background
      const fog = frame.main.fog
      const layers = frame.mainCamera.layers.mask
      frame.main.background = null
      frame.main.fog = null
      frame.mainCamera.layers.set(0)
      renderer.setRenderTarget(this.normals)
      renderer.setClearColor(0x8080ff, 1)
      renderer.clear()
      renderer.render(frame.main, frame.mainCamera)
      frame.mainCamera.layers.mask = layers
      frame.main.overrideMaterial = null
      frame.main.background = background
      frame.main.fog = fog
    }

    renderer.setRenderTarget(this.overlay)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(frame.overlay, frame.mainCamera)

    this.bright.uniforms.tBack!.value = this.back.texture
    this.bright.uniforms.tMain!.value = this.main.texture
    this.pass(this.bright, this.bloomA)
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.tInput!.value = this.bloomA.texture
      this.blur.uniforms.uDirection!.value.set(1 / this.bloomA.width, 0)
      this.pass(this.blur, this.bloomB)
      this.blur.uniforms.tInput!.value = this.bloomB.texture
      this.blur.uniforms.uDirection!.value.set(0, 1 / this.bloomA.height)
      this.pass(this.blur, this.bloomA)
    }

    const u = this.compose.uniforms
    u.tBack!.value = this.back.texture
    u.tMain!.value = this.main.texture
    u.tDepth!.value = this.main.depthTexture as Texture
    u.tNormal!.value = this.normals.texture
    u.tBloom!.value = this.bloomA.texture
    u.tOverlay!.value = this.overlay.texture
    u.uNear!.value = frame.mainCamera.near
    u.uFar!.value = frame.mainCamera.far
    u.uBloom!.value = this.look.bloom
    u.uExposure!.value = this.look.exposure
    u.uOutline!.value = this.look.outline
    u.uPaletteMix!.value = this.look.paletteMix
    u.uDither!.value = this.look.dither
    renderer.setClearColor(0x000000, 1)
    this.pass(this.compose, this.composite)

    this.upscale.uniforms.tInput!.value = this.composite.texture
    this.pass(this.upscale, null)
    renderer.setClearAlpha(previousClear)
  }

  /** The finished low-resolution frame, e.g. for a cover image. */
  readPixels(): { readonly width: number; readonly height: number; readonly pixels: Uint8Array } {
    const pixels = new Uint8Array(this.width * this.height * 4)
    this.renderer.readRenderTargetPixels(this.composite, 0, 0, this.width, this.height, pixels)
    return { width: this.width, height: this.height, pixels }
  }

  dispose(): void {
    for (const rt of [this.back, this.main, this.normals, this.overlay, this.bloomA, this.bloomB, this.composite]) {
      rt.depthTexture?.dispose()
      rt.dispose()
    }
    for (const material of [this.bright, this.blur, this.compose, this.upscale, this.normalMaterial]) material.dispose()
    this.quad.geometry.dispose()
  }
}

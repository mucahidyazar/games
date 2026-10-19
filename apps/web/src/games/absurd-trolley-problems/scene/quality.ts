/**
 * How much of the look the device can afford. With a GPU the scene gets all
 * of it. Without one (none present, or its driver blocked) the browser runs
 * WebGL on the CPU, where every triangle and pixel costs real time: there the
 * scene leaves out what it can do without and draws fewer frames.
 */

export interface RenderQuality {
  /** The moon's shadow map, this many texels square; 0 for no shadows. */
  readonly shadowMapSize: number
  /** Dark lines where surfaces fold, which take a second pass over every triangle. */
  readonly creases: boolean
  /**
   * Scattered grass, pebbles and flowers drawn as instanced meshes. Software
   * WebGL works through every instance much like a draw call of its own, so
   * there the copies are baked into one plain mesh instead.
   */
  readonly instancing: boolean
  /** Frames drawn per second at most; 0 for every frame the display shows. */
  readonly maxFps: number
  /** The most seconds of play one frame moves on: frames further apart than this play in slow motion. */
  readonly maxStep: number
}

export const GPU_QUALITY: RenderQuality = { shadowMapSize: 2048, creases: true, instancing: true, maxFps: 0, maxStep: 1 / 20 }

/**
 * The glow round the lights stays: at half size it costs software WebGL under
 * a millisecond. Slow machines may still fall well short of 30 frames a
 * second, so the game keeps its pace down to 10.
 */
export const SOFTWARE_QUALITY: RenderQuality = { shadowMapSize: 0, creases: false, instancing: false, maxFps: 30, maxStep: 1 / 10 }

/** Chromium's SwiftShader, Mesa's llvmpipe and softpipe, Windows' WARP, and anything else that says so. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|microsoft basic render|software/i

export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer)
}

/** What the browser says draws its WebGL. */
export function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  // Firefox names the GPU here (and warns about the debug extension); Chromium and Safari only through the extension.
  const plain = String(gl.getParameter(gl.RENDERER))
  if (plain !== 'WebKit WebGL') return plain
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : plain
}

export function renderQuality(gl: WebGLRenderingContext | WebGL2RenderingContext): RenderQuality {
  return isSoftwareRenderer(rendererName(gl)) ? SOFTWARE_QUALITY : GPU_QUALITY
}

/** Whether the display frame at `now` comes too soon after the last one drawn (at `last`; 0 for none yet) for the frame cap. */
export function tooSoon(quality: RenderQuality, now: number, last: number): boolean {
  if (quality.maxFps <= 0 || last === 0) return false
  // A little slack, so that 30 a second on a 60 Hz display draws every other frame rather than every third.
  return now - last < (1000 / quality.maxFps) * 0.9
}

import { describe, expect, it } from 'vitest'
import { GPU_QUALITY, isSoftwareRenderer, rendererName, renderQuality, SOFTWARE_QUALITY, tooSoon } from './quality'

const RENDERER = 0x1f01
const UNMASKED_RENDERER_WEBGL = 0x9246
const SWIFTSHADER = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)'

/** A WebGL context that only answers who draws it; `unmasked` null when it has no debug extension. */
function context(renderer: string, unmasked: string | null = null): WebGL2RenderingContext {
  return {
    RENDERER,
    getParameter: (name: number) => (name === RENDERER ? renderer : name === UNMASKED_RENDERER_WEBGL ? unmasked : null),
    getExtension: (name: string) => (name === 'WEBGL_debug_renderer_info' && unmasked !== null ? { UNMASKED_RENDERER_WEBGL } : null),
  } as unknown as WebGL2RenderingContext
}

describe('isSoftwareRenderer', () => {
  it.each([
    SWIFTSHADER,
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'softpipe',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple Software Renderer',
  ])('spots %s', (name) => {
    expect(isSoftwareRenderer(name)).toBe(true)
  })

  it.each([
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
    'Apple GPU',
    'Apple M1, or similar',
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Mali-G78',
    'WebKit WebGL',
    '',
  ])('takes %s for a GPU', (name) => {
    expect(isSoftwareRenderer(name)).toBe(false)
  })
})

describe('rendererName', () => {
  it('asks the debug extension when the browser only answers “WebKit WebGL”', () => {
    expect(rendererName(context('WebKit WebGL', SWIFTSHADER))).toBe(SWIFTSHADER)
  })

  it('takes a real answer as it comes, the way Firefox gives it', () => {
    expect(rendererName(context('llvmpipe, or similar', 'llvmpipe (LLVM 15.0.7, 256 bits)'))).toBe('llvmpipe, or similar')
  })

  it('makes do with the generic name when there is no extension', () => {
    expect(rendererName(context('WebKit WebGL'))).toBe('WebKit WebGL')
  })
})

describe('a lost context', () => {
  it('answers nothing, and gets the whole look', () => {
    const lost = { RENDERER, getParameter: () => null, getExtension: () => null } as unknown as WebGL2RenderingContext
    expect(renderQuality(lost)).toBe(GPU_QUALITY)
  })
})

describe('renderQuality', () => {
  it('gives a GPU the whole look', () => {
    expect(renderQuality(context('WebKit WebGL', 'Apple GPU'))).toBe(GPU_QUALITY)
    expect(renderQuality(context('WebKit WebGL'))).toBe(GPU_QUALITY)
    expect(GPU_QUALITY).toEqual({ shadowMapSize: 2048, creases: true, instancing: true, maxFps: 0, maxStep: 1 / 20 })
  })

  it('lightens the scene when WebGL runs on the CPU', () => {
    expect(renderQuality(context('WebKit WebGL', SWIFTSHADER))).toBe(SOFTWARE_QUALITY)
    expect(SOFTWARE_QUALITY).toEqual({ shadowMapSize: 0, creases: false, instancing: false, maxFps: 30, maxStep: 1 / 10 })
  })
})

describe('tooSoon', () => {
  it('never holds a frame back without a cap', () => {
    expect(tooSoon(GPU_QUALITY, 1001, 1000)).toBe(false)
  })

  it('draws the first frame straight away', () => {
    expect(tooSoon(SOFTWARE_QUALITY, 5, 0)).toBe(false)
  })

  it('draws every other frame of a 60 Hz display at 30 a second, even one a little early', () => {
    expect(tooSoon(SOFTWARE_QUALITY, 1016.7, 1000)).toBe(true)
    expect(tooSoon(SOFTWARE_QUALITY, 1031, 1000)).toBe(false)
    expect(tooSoon(SOFTWARE_QUALITY, 1033.3, 1000)).toBe(false)
  })

  it('draws every fourth frame of a 120 Hz display', () => {
    expect(tooSoon(SOFTWARE_QUALITY, 1025, 1000)).toBe(true)
    expect(tooSoon(SOFTWARE_QUALITY, 1033.3, 1000)).toBe(false)
  })
})

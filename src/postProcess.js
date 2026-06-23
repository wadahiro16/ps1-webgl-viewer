import * as THREE from 'three';

export const RESOLUTION_PRESETS = {
  '256 x 224': { width: 256, height: 224 },
  '320 x 240': { width: 320, height: 240 },
  '512 x 384': { width: 512, height: 384 },
  '640 x 480': { width: 640, height: 480 }
};

export class PS1PostProcess {
  constructor(renderer, settings) {
    this.renderer = renderer;
    this.settings = settings;
    this.renderTarget = this.createRenderTarget(settings.renderWidth, settings.renderHeight);
    this.screenScene = new THREE.Scene();
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.screenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: this.renderTarget.texture },
        uColorQuantize: { value: settings.colorQuantize },
        uColorLevels: { value: settings.colorLevels },
        uDither: { value: settings.dither },
        uDitherStrength: { value: settings.ditherStrength },
        uCanvasSize: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform sampler2D uTexture;
        uniform bool uColorQuantize;
        uniform float uColorLevels;
        uniform bool uDither;
        uniform float uDitherStrength;
        uniform vec2 uCanvasSize;

        varying vec2 vUv;

        float bayer4(vec2 coord) {
          int x = int(mod(coord.x, 4.0));
          int y = int(mod(coord.y, 4.0));
          int index = x + y * 4;

          if (index == 0) return 0.0 / 16.0;
          if (index == 1) return 8.0 / 16.0;
          if (index == 2) return 2.0 / 16.0;
          if (index == 3) return 10.0 / 16.0;
          if (index == 4) return 12.0 / 16.0;
          if (index == 5) return 4.0 / 16.0;
          if (index == 6) return 14.0 / 16.0;
          if (index == 7) return 6.0 / 16.0;
          if (index == 8) return 3.0 / 16.0;
          if (index == 9) return 11.0 / 16.0;
          if (index == 10) return 1.0 / 16.0;
          if (index == 11) return 9.0 / 16.0;
          if (index == 12) return 15.0 / 16.0;
          if (index == 13) return 7.0 / 16.0;
          if (index == 14) return 13.0 / 16.0;
          return 5.0 / 16.0;
        }

        void main() {
          vec4 color = texture2D(uTexture, vUv);
          vec3 rgb = color.rgb;
          float levels = max(uColorLevels, 2.0);

          if (uDither) {
            float threshold = bayer4(gl_FragCoord.xy) - 0.5;
            rgb += threshold * uDitherStrength / max(levels - 1.0, 1.0);
          }

          if (uColorQuantize) {
            rgb = floor(clamp(rgb, 0.0, 1.0) * (levels - 1.0) + 0.5) / (levels - 1.0);
          }

          gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
        }
      `
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.screenMaterial);
    this.screenScene.add(quad);
  }

  createRenderTarget(width, height) {
    const target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false
    });
    target.texture.generateMipmaps = false;
    if ('colorSpace' in target.texture) {
      target.texture.colorSpace = THREE.SRGBColorSpace;
    }
    return target;
  }

  setResolution(width, height) {
    this.renderTarget.setSize(width, height);
    this.screenMaterial.uniforms.uTexture.value = this.renderTarget.texture;
  }

  setCanvasSize(width, height) {
    this.screenMaterial.uniforms.uCanvasSize.value.set(width, height);
  }

  update(settings) {
    const uniforms = this.screenMaterial.uniforms;
    uniforms.uColorQuantize.value = settings.colorQuantize;
    uniforms.uColorLevels.value = settings.colorLevels;
    uniforms.uDither.value = settings.dither;
    uniforms.uDitherStrength.value = settings.ditherStrength;
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.screenScene, this.screenCamera);
  }

  dispose() {
    this.renderTarget.dispose();
    this.screenMaterial.dispose();
  }
}

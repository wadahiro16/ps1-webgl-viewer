import * as THREE from 'three';

const DEFAULT_SETTINGS = {
  vertexSnap: true,
  snapAmount: 2,
  textureWarp: true,
  warpStrength: 0.55,
  fog: true,
  fogNear: 5,
  fogFar: 14,
  fogColor: '#09090d',
  flatShading: true,
  wireframe: false,
  renderWidth: 320,
  renderHeight: 240
};

export function createCheckerTexture(options = {}) {
  const {
    size = 96,
    cells = 8,
    colorA = '#c7c0a6',
    colorB = '#4b6754',
    accent = '#8f2f2f'
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cellSize = size / cells;

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // Add a few low-res markings so texture warping is easy to see on a cube.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, size, Math.max(2, size / 32));
  ctx.fillRect(0, 0, Math.max(2, size / 32), size);
  ctx.fillRect(size * 0.55, size * 0.15, size * 0.25, size * 0.09);
  ctx.fillRect(size * 0.2, size * 0.68, size * 0.45, size * 0.08);

  const texture = new THREE.CanvasTexture(canvas);
  preparePS1Texture(texture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createBlobShadowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.48
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.46)');
  gradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  preparePS1Texture(texture);
  return texture;
}

export function preparePS1Texture(texture) {
  if (!texture) return null;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}

export function createPS1Material(options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const texture = preparePS1Texture(options.texture);
  const baseColor = new THREE.Color(options.color ?? '#ffffff');

  const material = new THREE.ShaderMaterial({
    name: 'PS1ShaderMaterial',
    transparent: false,
    wireframe: settings.wireframe,
    extensions: {
      derivatives: true
    },
    uniforms: {
      uTexture: { value: texture },
      uUseTexture: { value: Boolean(texture) },
      uBaseColor: { value: baseColor },
      uOpacity: { value: 1 },
      uAmbientColor: { value: new THREE.Color('#5a5a5a') },
      uDirectionalColor: { value: new THREE.Color('#ffffff') },
      uLightDirection: { value: new THREE.Vector3(0.45, 0.9, 0.35).normalize() },
      uLightIntensity: { value: 0.85 },
      uVertexSnapEnabled: { value: settings.vertexSnap },
      uVertexSnapAmount: { value: settings.snapAmount },
      uTextureWarpEnabled: { value: settings.textureWarp },
      uWarpStrength: { value: settings.warpStrength },
      uFlatShading: { value: settings.flatShading },
      uFogEnabled: { value: settings.fog },
      uFogNear: { value: settings.fogNear },
      uFogFar: { value: settings.fogFar },
      uFogColor: { value: new THREE.Color(settings.fogColor) },
      uRenderResolution: {
        value: new THREE.Vector2(settings.renderWidth, settings.renderHeight)
      }
    },
    vertexShader: `
      uniform bool uVertexSnapEnabled;
      uniform float uVertexSnapAmount;
      uniform vec2 uRenderResolution;

      varying vec2 vUv;
      varying vec2 vAffineUv;
      varying float vAffineW;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vFogDepth;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        vec4 clipPosition = projectionMatrix * viewPosition;

        vUv = uv;

        // Passing uv * w and w lets the fragment shader reconstruct a more
        // affine-looking UV, which intentionally fights normal perspective UVs.
        vAffineUv = uv * clipPosition.w;
        vAffineW = clipPosition.w;

        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vFogDepth = -viewPosition.z;

        if (uVertexSnapEnabled) {
          float snapSize = max(uVertexSnapAmount, 0.001);
          vec2 safeResolution = max(uRenderResolution, vec2(1.0));
          vec2 ndc = clipPosition.xy / clipPosition.w;
          vec2 pixelCoord = (ndc * 0.5 + 0.5) * safeResolution;
          pixelCoord = floor(pixelCoord / snapSize + 0.5) * snapSize;
          ndc = (pixelCoord / safeResolution) * 2.0 - 1.0;
          clipPosition.xy = ndc * clipPosition.w;
        }

        gl_Position = clipPosition;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D uTexture;
      uniform bool uUseTexture;
      uniform vec3 uBaseColor;
      uniform float uOpacity;
      uniform vec3 uAmbientColor;
      uniform vec3 uDirectionalColor;
      uniform vec3 uLightDirection;
      uniform float uLightIntensity;
      uniform bool uTextureWarpEnabled;
      uniform float uWarpStrength;
      uniform bool uFlatShading;
      uniform bool uFogEnabled;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uFogColor;

      varying vec2 vUv;
      varying vec2 vAffineUv;
      varying float vAffineW;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vFogDepth;

      vec3 getDebugNormal() {
        vec3 smoothNormal = normalize(vWorldNormal);

        if (!uFlatShading) {
          return smoothNormal;
        }

        vec3 faceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
        if (!gl_FrontFacing) {
          faceNormal = -faceNormal;
        }
        return faceNormal;
      }

      void main() {
        float affineW = max(vAffineW, 0.0001);
        vec2 affineUv = vAffineUv / affineW;
        float warpAmount = uTextureWarpEnabled ? clamp(uWarpStrength, 0.0, 1.35) : 0.0;
        vec2 sampleUv = mix(vUv, affineUv, warpAmount);

        vec4 texel = uUseTexture ? texture2D(uTexture, sampleUv) : vec4(1.0);
        if (texel.a < 0.05) {
          discard;
        }

        vec3 normal = getDebugNormal();
        float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);

        // Stepped diffuse keeps the lighting hard and old-console-like.
        diffuse = floor(diffuse * 3.0 + 0.15) / 3.0;
        vec3 litColor = texel.rgb * uBaseColor;
        litColor *= uAmbientColor + uDirectionalColor * diffuse * uLightIntensity;

        if (uFogEnabled) {
          float fogRange = max(uFogFar - uFogNear, 0.001);
          float fogFactor = clamp((vFogDepth - uFogNear) / fogRange, 0.0, 1.0);
          litColor = mix(litColor, uFogColor, fogFactor);
        }

        gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), texel.a * uOpacity);
      }
    `
  });

  material.userData.isPS1Material = true;
  return material;
}

export function applyPS1MaterialToObject(object, settings, fallbackTexture) {
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    child.geometry.computeVertexNormals();
    ensureGeometryUVs(child.geometry);

    const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
    const sourceTexture = preparePS1Texture(sourceMaterial?.map ?? fallbackTexture);
    const sourceColor = sourceMaterial?.color ?? new THREE.Color('#ffffff');

    child.material = createPS1Material({
      texture: sourceTexture,
      color: sourceColor,
      settings
    });
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

export function updatePS1Materials(object, settings) {
  if (!object) return;

  object.traverse((child) => {
    if (!child.isMesh || !child.material?.userData?.isPS1Material) return;

    const { material } = child;
    const uniforms = material.uniforms;

    uniforms.uVertexSnapEnabled.value = settings.vertexSnap;
    uniforms.uVertexSnapAmount.value = settings.snapAmount;
    uniforms.uTextureWarpEnabled.value = settings.textureWarp;
    uniforms.uWarpStrength.value = settings.warpStrength;
    uniforms.uFlatShading.value = settings.flatShading;
    uniforms.uFogEnabled.value = settings.fog;
    uniforms.uFogNear.value = settings.fogNear;
    uniforms.uFogFar.value = settings.fogFar;
    uniforms.uFogColor.value.set(settings.fogColor);
    uniforms.uRenderResolution.value.set(settings.renderWidth, settings.renderHeight);

    material.wireframe = settings.wireframe;
    material.needsUpdate = true;
  });
}

export function setObjectTexture(object, texture) {
  if (!object || !texture) return;

  preparePS1Texture(texture);
  object.traverse((child) => {
    if (!child.isMesh || !child.material?.userData?.isPS1Material) return;
    child.material.uniforms.uTexture.value = texture;
    child.material.uniforms.uUseTexture.value = true;
    child.material.needsUpdate = true;
  });
}

export function ensureGeometryUVs(geometry) {
  if (geometry.attributes.uv) return;

  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);

  const min = box.min;
  const safeSize = new THREE.Vector3(
    Math.max(size.x, 0.0001),
    Math.max(size.y, 0.0001),
    Math.max(size.z, 0.0001)
  );
  const uvs = [];

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u;
    let v;
    if (ny >= nx && ny >= nz) {
      u = (x - min.x) / safeSize.x;
      v = (z - min.z) / safeSize.z;
    } else if (nx >= ny && nx >= nz) {
      u = (z - min.z) / safeSize.z;
      v = (y - min.y) / safeSize.y;
    } else {
      u = (x - min.x) / safeSize.x;
      v = (y - min.y) / safeSize.y;
    }

    uvs.push(u, v);
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}

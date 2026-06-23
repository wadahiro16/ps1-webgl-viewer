import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  applyPS1MaterialToObject,
  createBlobShadowTexture,
  createCheckerTexture,
  createPS1Material,
  setObjectTexture,
  updatePS1Materials
} from './ps1Material.js';
import { RESOLUTION_PRESETS, PS1PostProcess } from './postProcess.js';
import { isModelFile, isTextureFile, loadModelFiles, loadTextureFile } from './modelLoader.js';
import { createUI } from './ui.js';

const canvas = document.querySelector('#viewer-canvas');
const frame = document.querySelector('#viewer-frame');
const dropOverlay = document.querySelector('#drop-overlay');
const statusLine = document.querySelector('#status-line');
const fpsReadout = document.querySelector('#fps-readout');
const modelReadout = document.querySelector('#model-readout');
const panel = document.querySelector('#ui-panel');

const settings = {
  activePreset: 'PS1 Horror',
  autoRotate: true,
  turntableSpeed: 0.65,
  resolutionLabel: '256 x 224',
  renderWidth: 256,
  renderHeight: 224,
  vertexSnap: true,
  snapAmount: 3.5,
  textureWarp: true,
  warpStrength: 0.78,
  colorQuantize: true,
  colorLevels: 8,
  dither: true,
  ditherStrength: 0.75,
  fog: true,
  fogNear: 3,
  fogFar: 10,
  fogColor: '#07070a',
  flatShading: true,
  wireframe: false,
  backgroundColor: '#040405'
};

const presets = {
  'PS1 Horror': {
    resolutionLabel: '256 x 224',
    vertexSnap: true,
    snapAmount: 3.5,
    textureWarp: true,
    warpStrength: 0.78,
    colorQuantize: true,
    colorLevels: 8,
    dither: true,
    ditherStrength: 0.75,
    fog: true,
    fogNear: 3,
    fogFar: 10,
    fogColor: '#07070a',
    backgroundColor: '#040405',
    flatShading: true,
    wireframe: false
  },
  'PS1 Bright': {
    resolutionLabel: '320 x 240',
    vertexSnap: true,
    snapAmount: 2,
    textureWarp: true,
    warpStrength: 0.45,
    colorQuantize: true,
    colorLevels: 16,
    dither: true,
    ditherStrength: 0.35,
    fog: false,
    fogNear: 8,
    fogFar: 24,
    fogColor: '#b8c6cf',
    backgroundColor: '#18232b',
    flatShading: true,
    wireframe: false
  },
  'PS1 Museum Viewer': {
    resolutionLabel: '512 x 384',
    vertexSnap: true,
    snapAmount: 1.25,
    textureWarp: true,
    warpStrength: 0.2,
    colorQuantize: true,
    colorLevels: 32,
    dither: true,
    ditherStrength: 0.16,
    fog: true,
    fogNear: 10,
    fogFar: 28,
    fogColor: '#20242b',
    backgroundColor: '#101318',
    flatShading: false,
    wireframe: false
  }
};

applyResolutionToSettings();

const scene = new THREE.Scene();
scene.background = new THREE.Color(settings.backgroundColor);

const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
camera.position.set(2.9, 2.05, 3.45);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(1);
renderer.setClearColor(settings.backgroundColor, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);

const postProcess = new PS1PostProcess(renderer, settings);
const modelPivot = new THREE.Group();
scene.add(modelPivot);
let lastFrameTime = performance.now();

const checkerTexture = createCheckerTexture();
let currentModel = null;
let currentModelName = 'Cube';

const ambientLight = new THREE.AmbientLight(0x888888, 0.6);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(2.5, 4, 2);
scene.add(ambientLight, directionalLight);

const grid = new THREE.GridHelper(7, 28, 0x2f7a5a, 0x1f3028);
grid.position.y = -1.15;
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const blobShadow = createBlobShadow();
scene.add(blobShadow);

const ui = createUI({
  panel,
  settings,
  resolutionPresets: RESOLUTION_PRESETS,
  presets,
  callbacks: {
    onLoadModel: handleModelFiles,
    onLoadTexture: handleTextureFile,
    onResetCube: resetToCube,
    onPreset: applyPreset,
    onSettingsChange: syncSettings,
    onScreenshot: saveScreenshot
  }
});

resetToCube();
setupDragAndDrop();
resizeRenderer();
window.addEventListener('resize', resizeRenderer);
requestAnimationFrame(animate);

function resetToCube() {
  const geometry = new THREE.BoxGeometry(1.65, 1.65, 1.65);
  const material = createPS1Material({
    texture: checkerTexture,
    color: '#ffffff',
    settings
  });
  const cube = new THREE.Mesh(geometry, material);
  setModel(cube, 'Cube');
  setStatus('Reset to the default checker cube.');
}

async function handleModelFiles(files) {
  const modelFiles = files.filter(isModelFile);
  if (!modelFiles.length) {
    setStatus('No supported model file in the selection.', true);
    return;
  }

  setStatus('Loading model...');
  try {
    const { object, fileName, extension } = await loadModelFiles(files);
    applyPS1MaterialToObject(object, settings, checkerTexture);
    setModel(object, fileName);
    setStatus(`Loaded ${fileName} (${extension.toUpperCase()}).`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleTextureFile(file) {
  if (!file) return;

  if (!isTextureFile(file)) {
    setStatus('Texture must be png, jpg, jpeg, or webp.', true);
    return;
  }

  setStatus('Loading texture...');
  try {
    const texture = await loadTextureFile(file);
    setObjectTexture(currentModel, texture);
    setStatus(`Applied texture: ${file.name}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function setModel(object, name) {
  if (currentModel) {
    modelPivot.remove(currentModel);
  }

  currentModel = object;
  currentModelName = name;
  modelPivot.rotation.set(0, 0, 0);
  modelPivot.add(currentModel);

  centerAndScaleModel(currentModel);
  updatePS1Materials(currentModel, settings);
  updateBlobShadow();
  frameCameraToObject(currentModel);
  modelReadout.textContent = name;
}

function centerAndScaleModel(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
  const scale = 2.15 / maxDimension;

  object.position.sub(center);
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);
}

function frameCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  camera.position.set(distance * 1.25, distance * 0.86, distance * 1.48);
  camera.near = Math.max(distance / 80, 0.01);
  camera.far = Math.max(distance * 18, 80);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

function createBlobShadow() {
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 24);
  const material = new THREE.MeshBasicMaterial({
    map: createBlobShadowTexture(),
    transparent: true,
    depthWrite: false,
    color: 0x000000
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

function updateBlobShadow() {
  if (!currentModel) return;

  const box = new THREE.Box3().setFromObject(currentModel);
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, 1.1) * 1.05;
  blobShadow.position.set(0, box.min.y - 0.015, 0);
  blobShadow.scale.set(radius, radius, 1);
  grid.position.y = box.min.y - 0.025;
}

function syncSettings() {
  applyResolutionToSettings();
  scene.background.set(settings.backgroundColor);
  renderer.setClearColor(settings.backgroundColor, 1);
  postProcess.setResolution(settings.renderWidth, settings.renderHeight);
  postProcess.update(settings);
  updatePS1Materials(currentModel, settings);

  scene.fog = settings.fog
    ? new THREE.Fog(settings.fogColor, settings.fogNear, settings.fogFar)
    : null;
}

function applyResolutionToSettings() {
  const resolution = RESOLUTION_PRESETS[settings.resolutionLabel] ?? RESOLUTION_PRESETS['320 x 240'];
  settings.renderWidth = resolution.width;
  settings.renderHeight = resolution.height;
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;

  Object.assign(settings, preset);
  settings.activePreset = name;
  syncSettings();
  setStatus(`Preset applied: ${name}`);
}

function resizeRenderer() {
  const { width, height } = frame.getBoundingClientRect();
  renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  postProcess.setCanvasSize(width, height);
}

function animate() {
  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;
  updateFps(delta);

  if (settings.autoRotate && currentModel) {
    modelPivot.rotation.y += delta * settings.turntableSpeed;
  }

  controls.update();
  postProcess.render(scene, camera);
  requestAnimationFrame(animate);
}

let fpsTimer = 0;
let frameCount = 0;
function updateFps(delta) {
  fpsTimer += delta;
  frameCount += 1;

  if (fpsTimer >= 0.5) {
    const fps = Math.round(frameCount / fpsTimer);
    fpsReadout.textContent = `FPS ${fps}`;
    fpsReadout.classList.toggle('warn', fps < 24);
    frameCount = 0;
    fpsTimer = 0;
  }
}

function setupDragAndDrop() {
  ['dragenter', 'dragover'].forEach((eventName) => {
    frame.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropOverlay.classList.add('is-active');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    frame.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropOverlay.classList.remove('is-active');
    });
  });

  frame.addEventListener('drop', (event) => {
    const files = Array.from(event.dataTransfer?.files ?? []);
    const texture = files.find(isTextureFile);
    const hasModel = files.some(isModelFile);

    if (hasModel) {
      handleModelFiles(files);
    } else if (texture) {
      handleTextureFile(texture);
    } else {
      setStatus('Drop .glb, .gltf, .obj, .fbx, or texture image files.', true);
    }
  });
}

function saveScreenshot() {
  postProcess.render(scene, camera);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `ps1-webgl-viewer-${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  setStatus('Screenshot saved.');
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', isError);
}

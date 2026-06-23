import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { preparePS1Texture } from './ps1Material.js';

const MODEL_PRIORITY = ['glb', 'gltf', 'obj', 'fbx'];
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function isModelFile(file) {
  return MODEL_PRIORITY.includes(getExtension(file.name));
}

export function isTextureFile(file) {
  return IMAGE_EXTENSIONS.has(getExtension(file.name));
}

export async function loadModelFiles(fileList) {
  const files = Array.from(fileList);
  const modelFile = chooseModelFile(files);

  if (!modelFile) {
    throw new Error('No supported model file found. Use .glb, .gltf, .obj, or .fbx.');
  }

  const extension = getExtension(modelFile.name);
  const urlStore = createObjectUrlStore(files);
  const manager = new THREE.LoadingManager();

  // Let GLTF/FBX loaders resolve sibling .bin and image files selected together.
  manager.setURLModifier((url) => {
    const cleanName = decodeURIComponent(url.split(/[\\/]/).pop().split('?')[0]);
    const matchingFile = files.find((file) => file.name === cleanName);
    return matchingFile ? urlStore.getUrl(matchingFile) : url;
  });

  const modelUrl = urlStore.getUrl(modelFile);

  try {
    let loaded;
    if (extension === 'glb' || extension === 'gltf') {
      const gltf = await loadWithLoader(new GLTFLoader(manager), modelUrl);
      loaded = gltf.scene || gltf.scenes?.[0];
    } else if (extension === 'obj') {
      loaded = await loadWithLoader(new OBJLoader(manager), modelUrl);
    } else if (extension === 'fbx') {
      loaded = await loadWithLoader(new FBXLoader(manager), modelUrl);
    }

    if (!loaded) {
      throw new Error(`Could not read ${modelFile.name}.`);
    }

    if (!containsMesh(loaded)) {
      throw new Error('The loaded file did not contain a renderable mesh.');
    }

    return {
      object: loaded,
      fileName: modelFile.name,
      extension
    };
  } catch (error) {
    const message =
      extension === 'fbx'
        ? `FBX load failed. Browser FBX support can be fragile: ${error.message}`
        : error.message;
    throw new Error(message);
  } finally {
    urlStore.revokeAll();
  }
}

export async function loadTextureFile(file) {
  if (!isTextureFile(file)) {
    throw new Error('Texture must be png, jpg, jpeg, or webp.');
  }

  const objectUrl = URL.createObjectURL(file);
  const loader = new THREE.TextureLoader();

  try {
    const texture = await loadWithLoader(loader, objectUrl);
    return preparePS1Texture(texture);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function chooseModelFile(files) {
  for (const extension of MODEL_PRIORITY) {
    const match = files.find((file) => getExtension(file.name) === extension);
    if (match) return match;
  }
  return null;
}

function loadWithLoader(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function containsMesh(object) {
  let found = false;
  object.traverse((child) => {
    if (child.isMesh) found = true;
  });
  return found;
}

function createObjectUrlStore(files) {
  const urls = new Map();

  return {
    getUrl(file) {
      if (!urls.has(file)) {
        urls.set(file, URL.createObjectURL(file));
      }
      return urls.get(file);
    },
    revokeAll() {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    }
  };
}

function getExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

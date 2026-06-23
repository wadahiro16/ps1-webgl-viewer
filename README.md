# PS1 WebGL Viewer

A browser-only Three.js model viewer that simulates a PlayStation 1 era look:
low resolution rendering, vertex snapping, affine-style texture wobble, nearest
textures, color quantization, dithering, fog, hard lighting, and turntable
rotation.

This is not a real PS1 emulator. It is a modern WebGL approximation designed to
make the visual traits easy to inspect and tweak.

## Requirements

- Node.js
- npm

## Setup

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Usage

- The app starts with a checker-textured cube.
- Use the mouse to orbit, zoom, and pan.
- Toggle `Auto Rotate` or adjust `Turntable Speed` for turntable display.
- Use `Load Model` for `.glb`, `.gltf`, `.obj`, or `.fbx`.
- For `.gltf` files with external `.bin` or image files, select the related
  files together. Drag and drop supports the same flow.
- Use `Load Texture` to apply a `.png`, `.jpg`, `.jpeg`, or `.webp` image to the
  current model.
- Use `Screenshot` to save the current pixelated render as a PNG.

## Supported Model Priority

When multiple files are selected, the viewer chooses the first matching model in
this priority order:

1. GLB / GLTF
2. OBJ
3. FBX

FBX loading can fail in browsers depending on the file. When it fails, the app
shows an error message in the status line.

## PS1 Controls

- `Render Resolution`: renders to a low-resolution target, then scales it up
  with nearest filtering.
- `Vertex Snap`: rounds projected vertex positions in screen space.
- `Texture Warp`: blends between perspective UVs and affine-style UVs.
- `Color Quantize`: reduces output color levels in the post pass.
- `Dither`: applies a small Bayer-pattern screen-space dither.
- `Fog`: adds distance fog in the shader.
- `Flat Shading`: uses face normals for a harder low-poly look.
- `Wireframe`: draws the current mesh in wireframe mode.

## File Structure

```text
ps1-webgl-viewer/
  package.json
  index.html
  src/
    main.js
    ps1Material.js
    postProcess.js
    modelLoader.js
    ui.js
    style.css
  README.md
```

## Notes

- Uploaded textures use `NearestFilter` and mipmaps are disabled.
- Models without UVs receive simple box-projected UVs so the checker texture can
  still show up.
- Complex materials are simplified into the custom PS1 shader material so the
  model remains visible even when source material features are unsupported.

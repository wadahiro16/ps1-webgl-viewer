export function createUI({ panel, settings, resolutionPresets, presets, callbacks }) {
  const controls = new Map();
  panel.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'panel-title';
  title.innerHTML = `
    <span>CONTROL ROM</span>
    <strong>PS1 Render Stack</strong>
  `;
  panel.append(title);

  const modelSection = createSection('Model');
  modelSection.append(
    createFileControl('Load Model', '.obj,.glb,.gltf,.fbx,.bin,.png,.jpg,.jpeg,.webp', true, (files) => {
      callbacks.onLoadModel(files);
    }),
    createFileControl('Load Texture', '.png,.jpg,.jpeg,.webp', false, (files) => {
      callbacks.onLoadTexture(files[0]);
    }),
    createButton('Reset to Cube', callbacks.onResetCube),
    createSelect('Preset', Object.keys(presets), settings.activePreset, (value) => {
      callbacks.onPreset(value);
      refresh();
    })
  );

  const turntableSection = createSection('Turntable');
  turntableSection.append(
    createToggle('Auto Rotate', 'autoRotate'),
    createRange('Turntable Speed', 'turntableSpeed', 0, 3, 0.01)
  );

  const renderSection = createSection('Low Resolution');
  renderSection.append(
    createSelect('Render Resolution', Object.keys(resolutionPresets), settings.resolutionLabel, (value) => {
      settings.resolutionLabel = value;
      callbacks.onSettingsChange();
      refresh();
    }),
    createToggle('Color Quantize', 'colorQuantize'),
    createSelect('Color Levels', ['4', '8', '16', '32'], String(settings.colorLevels), (value) => {
      settings.colorLevels = Number(value);
      callbacks.onSettingsChange();
      refresh();
    }),
    createToggle('Dither', 'dither'),
    createRange('Dither Strength', 'ditherStrength', 0, 1.5, 0.01)
  );

  const ps1Section = createSection('Geometry');
  ps1Section.append(
    createToggle('Vertex Snap', 'vertexSnap'),
    createRange('Snap Amount', 'snapAmount', 0.25, 12, 0.05),
    createToggle('Texture Warp', 'textureWarp'),
    createRange('Warp Strength', 'warpStrength', 0, 1.35, 0.01),
    createToggle('Flat Shading', 'flatShading'),
    createToggle('Wireframe', 'wireframe')
  );

  const fogSection = createSection('Fog and Color');
  fogSection.append(
    createToggle('Fog', 'fog'),
    createRange('Fog Near', 'fogNear', 0.5, 30, 0.1),
    createRange('Fog Far', 'fogFar', 1, 60, 0.1),
    createColor('Fog Color', 'fogColor'),
    createColor('Background Color', 'backgroundColor')
  );

  const outputSection = createSection('Output');
  outputSection.append(createButton('Screenshot', callbacks.onScreenshot));

  panel.append(modelSection, turntableSection, renderSection, ps1Section, fogSection, outputSection);

  function createSection(label) {
    const section = document.createElement('section');
    section.className = 'panel-section';
    const heading = document.createElement('h2');
    heading.textContent = label;
    section.append(heading);
    return section;
  }

  function createFileControl(label, accept, multiple, onChange) {
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => {
      if (input.files?.length) {
        onChange(Array.from(input.files));
        input.value = '';
      }
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-button';
    button.textContent = 'Choose';
    button.addEventListener('click', () => input.click());

    row.append(input, button);
    return row;
  }

  function createButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function createToggle(label, key) {
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      callbacks.onSettingsChange();
      refresh();
    });
    controls.set(key, input);
    row.append(input);
    return row;
  }

  function createRange(label, key, min, max, step) {
    const row = createRow(label);
    const value = document.createElement('span');
    value.className = 'control-value';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = settings[key];
    value.textContent = formatNumber(settings[key]);

    input.addEventListener('input', () => {
      settings[key] = Number(input.value);
      value.textContent = formatNumber(settings[key]);
      callbacks.onSettingsChange();
    });

    controls.set(key, { input, value });
    row.append(input, value);
    return row;
  }

  function createSelect(label, options, currentValue, onChange) {
    const row = createRow(label);
    const select = document.createElement('select');
    options.forEach((option) => {
      const item = document.createElement('option');
      item.value = option;
      item.textContent = option;
      select.append(item);
    });
    select.value = currentValue;
    select.addEventListener('change', () => onChange(select.value));
    controls.set(label, select);
    row.append(select);
    return row;
  }

  function createColor(label, key) {
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = settings[key];
    input.addEventListener('input', () => {
      settings[key] = input.value;
      callbacks.onSettingsChange();
    });
    controls.set(key, input);
    row.append(input);
    return row;
  }

  function createRow(label) {
    const row = document.createElement('label');
    row.className = 'control-row';
    const text = document.createElement('span');
    text.textContent = label;
    row.append(text);
    return row;
  }

  function refresh() {
    controls.forEach((control, key) => {
      if (key === 'Render Resolution') {
        control.value = settings.resolutionLabel;
      } else if (key === 'Color Levels') {
        control.value = String(settings.colorLevels);
      } else if (key === 'Preset') {
        control.value = settings.activePreset;
      } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        control.checked = settings[key];
      } else if (control instanceof HTMLInputElement && control.type === 'color') {
        control.value = settings[key];
      } else if (control?.input) {
        control.input.value = settings[key];
        control.value.textContent = formatNumber(settings[key]);
      }
    });
  }

  return { refresh };
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

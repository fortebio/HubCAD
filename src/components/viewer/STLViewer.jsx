import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { layoutInventory } from '@/lib/explodeLayout';
import { useThemeStore } from '@/stores/useThemeStore';

/**
 * Viewport palette per theme. The background keeps the same relationship to the
 * card it sits in as the light theme has — a shade off the card, so the model
 * reads against it — and the grid uses the app's own dark border greys.
 *
 * Exported PNGs are deliberately NOT themed: captureView keeps its white
 * background because those images go into drawings and PDFs.
 */
const VIEWPORT = {
  light: { bg: 0xf5f7fa, grid: [0xd1d5db, 0xe5e7eb], gridOpacity: 0.5 },
  dark: { bg: 0x12151a, grid: [0x3a4047, 0x2a2f37], gridOpacity: 0.65 },
};

// ──────────────────────────────────────────────────────────────────────────────
// Dimension overlay helpers — draw real engineering-drawing dimension lines on
// top of the captured Three.js render. Pure 2D-canvas, no extra dependencies.
// ──────────────────────────────────────────────────────────────────────────────

function drawArrow(ctx, x, y, size, dir) {
  ctx.beginPath();
  if (dir === 'right') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y - size / 2);
    ctx.lineTo(x - size, y + size / 2);
  } else if (dir === 'left') {
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y - size / 2);
    ctx.lineTo(x + size, y + size / 2);
  } else if (dir === 'down') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size / 2, y - size);
    ctx.lineTo(x + size / 2, y - size);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size / 2, y + size);
    ctx.lineTo(x + size / 2, y + size);
  }
  ctx.closePath();
  ctx.fill();
}

// Project the 8 corners of a 3D bounding box through the camera and return
// the encompassing 2D screen rectangle in pixels (within a `width × height` canvas).
function projectBBoxToScreen(bbox, camera, width, height) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  for (const x of [bbox.min.x, bbox.max.x]) {
    for (const y of [bbox.min.y, bbox.max.y]) {
      for (const z of [bbox.min.z, bbox.max.z]) {
        v.set(x, y, z).project(camera);
        const sx = ((v.x + 1) / 2) * width;
        const sy = ((-v.y + 1) / 2) * height;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

const COLOR_DIM = '#1a6ff5';
const COLOR_TEXT = '#1f2937';
const COLOR_MUTED = '#6b7280';

// Map view → which axes correspond to horizontal / vertical in the rendered
// projection, based on Three.js Y-up coordinate system.
//   FRONT (looking +Z): X horizontal, Y vertical
//   TOP   (looking -Y): X horizontal, Z vertical (depth)
//   RIGHT (looking +X): Z horizontal, Y vertical
const VIEW_AXIS_MAP = {
  front: { h: 'dimX', v: 'dimY', hLabel: 'X', vLabel: 'Y' },
  top:   { h: 'dimX', v: 'dimZ', hLabel: 'X', vLabel: 'Z' },
  right: { h: 'dimZ', v: 'dimY', hLabel: 'Z', vLabel: 'Y' },
};

// ISO-style dimension. Extension lines start with a gap (`EXT_GAP` from the
// part) and overshoot the dimension line by `EXT_OVER`. Dimension line ends
// with thin elongated arrows. Text sits ABOVE a horizontal line, or to the
// LEFT of a vertical line (rotated 90° CCW), following ISO 129.
const EXT_GAP = 2;
const EXT_OVER = 3;
const ARR_LEN = 6;

function drawHDim(ctx, x1, x2, y, label) {
  ctx.strokeStyle = COLOR_TEXT;
  ctx.fillStyle = COLOR_TEXT;
  ctx.lineWidth = 0.7;
  // dimension line
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  // arrows
  drawArrow(ctx, x1, y, ARR_LEN, 'left');
  drawArrow(ctx, x2, y, ARR_LEN, 'right');
  // label above the line (ISO 129)
  const cx = (x1 + x2) / 2;
  ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - tw / 2 - 3, y - 14, tw + 6, 12);
  ctx.fillStyle = COLOR_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, cx, y - 2);
}

function drawVDim(ctx, x, y1, y2, label) {
  ctx.strokeStyle = COLOR_TEXT;
  ctx.fillStyle = COLOR_TEXT;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  drawArrow(ctx, x, y1, ARR_LEN, 'up');
  drawArrow(ctx, x, y2, ARR_LEN, 'down');
  // rotated label (90° CCW) to the LEFT of the line
  ctx.save();
  const cy = (y1 + y2) / 2;
  ctx.translate(x - 3, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-tw / 2 - 3, -13, tw + 6, 12);
  ctx.fillStyle = COLOR_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, 0, -1);
  ctx.restore();
}

function drawExtLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = COLOR_TEXT;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCenterLines(ctx, minX, minY, maxX, maxY) {
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 0.5;
  // ISO long-dash short-dash pattern
  ctx.setLineDash([10, 2, 2, 2]);
  ctx.beginPath();
  ctx.moveTo(cx, minY - 8);
  ctx.lineTo(cx, maxY + 8);
  ctx.moveTo(minX - 8, cy);
  ctx.lineTo(maxX + 8, cy);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDimensions(ctx, viewKey, dim, bbox, canvasW, canvasH) {
  const { minX, minY, maxX, maxY } = bbox;
  const axes = VIEW_AXIS_MAP[viewKey];

  if (axes) {
    const hVal = dim[axes.h];
    const vVal = dim[axes.v];
    const hLabel = hVal.toFixed(2);
    const vLabel = vVal.toFixed(2);

    drawCenterLines(ctx, minX, minY, maxX, maxY);

    // Horizontal dimension below the part
    const yDim = Math.min(maxY + 24, canvasH - 18);
    drawExtLine(ctx, minX, maxY + EXT_GAP, minX, yDim + EXT_OVER);
    drawExtLine(ctx, maxX, maxY + EXT_GAP, maxX, yDim + EXT_OVER);
    drawHDim(ctx, minX, maxX, yDim, hLabel);

    // Vertical dimension to the right of the part
    const xDim = Math.min(maxX + 24, canvasW - 22);
    drawExtLine(ctx, maxX + EXT_GAP, minY, xDim + EXT_OVER, minY);
    drawExtLine(ctx, maxX + EXT_GAP, maxY, xDim + EXT_OVER, maxY);
    drawVDim(ctx, xDim, minY, maxY, vLabel);
  } else {
    // ISO/axonometric view: small dimension callout (no axis lines because
    // the projection isn't orthographic — true dimensions live on the
    // orthographic views).
    const pad = 8;
    const lines = [
      `X = ${dim.dimX.toFixed(2)}`,
      `Y = ${dim.dimY.toFixed(2)}`,
      `Z = ${dim.dimZ.toFixed(2)}`,
    ];
    ctx.font = 'bold 11px "JetBrains Mono", "Courier New", monospace';
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = maxW + pad * 2;
    const boxH = lines.length * 14 + pad * 2;
    const x0 = canvasW - boxW - 8;
    const y0 = 8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.5;
    ctx.fillRect(x0, y0, boxW, boxH);
    ctx.strokeRect(x0, y0, boxW, boxH);
    ctx.fillStyle = COLOR_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x0 + pad, y0 + pad + i * 14);
    }
  }

  // Discreet view tag (top-left)
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${viewKey.toUpperCase()} · ${axes ? `${axes.hLabel}/${axes.vLabel}` : 'X/Y/Z'}`, 8, 6);

  // Units footer (bottom-left)
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Units: mm · ISO 129', 8, canvasH - 4);
}

// ──────────────────────────────────────────────────────────────────────────────

const SELECT_EMISSIVE = new THREE.Color(0x1a6ff5);

// Extent of an axis-aligned box of `size` when projected on unit direction `d`.
function spanAlong(size, d) {
  return Math.abs(d.x) * size.x + Math.abs(d.y) * size.y + Math.abs(d.z) * size.z;
}

export const STLViewer = forwardRef(function STLViewer(
  {
    models,
    positions,
    color = '#1a6ff5',
    wireframe = false,
    view = 'iso',
    // 0 = assembled, 1 = every part on its own slot of the inventory sheet.
    explode = 0,
    selectedId = null,
    onPick,
    // Called with { id, x, y } (container pixels) for the part under the
    // pointer, or null when it leaves every part.
    onHover,
    // Order of the inventory blocks (system ids); unknown ids go last.
    groupOrder = [],
  },
  ref
) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const groupRef = useRef(null);
  const meshMapRef = useRef(new Map());
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const bboxRef = useRef(null);
  const gridRef = useRef(null);
  const axesRef = useRef(null);

  // The scene is built once; this ref lets that one-off setup see the theme,
  // and the effect below repaints it when the operator switches afterwards.
  const theme = useThemeStore((st) => st.effective);
  const themeRef = useRef(theme);
  themeRef.current = VIEWPORT[theme] ? theme : 'light';
  // Explosion state lives outside React so the render loop can ease toward
  // the requested amount without re-rendering the tree every frame.
  const amountRef = useRef(0);
  const targetAmountRef = useRef(0);
  // Camera basis the inventory sheet was laid out in; null while assembled.
  const sheetBasisRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  // Accepts either the multi-model API (`models`) or the original single
  // `positions` prop, so existing callers keep working unchanged.
  const normalized = useMemo(() => {
    if (Array.isArray(models)) return models.filter((m) => m?.positions?.length);
    if (positions?.length) return [{ id: '__single__', positions, color, visible: true }];
    return [];
  }, [models, positions, color]);

  // Geometry is rebuilt only when the SET of models changes — toggling a
  // colour or a visibility flag must not re-upload buffers or re-frame the camera.
  const geometryKey = normalized.map((m) => `${m.id}:${m.positions.length}`).join('|');

  function visibleMeshes() {
    return [...meshMapRef.current.values()].filter((m) => m.visible);
  }

  // Move every part to where it belongs at `amount` (0 = home, 1 = its slot).
  // Geometry stays in assembly coordinates, so the mesh position is the
  // displacement from the part's own centre — zero when assembled.
  function applyAmount(amount) {
    for (const mesh of meshMapRef.current.values()) {
      const { center, target } = mesh.userData;
      if (target && amount > 0) mesh.position.lerpVectors(center, target, amount).sub(center);
      else mesh.position.set(0, 0, 0);
    }
  }

  // Give each visible part a slot on a sheet facing the camera. The sheet's
  // orientation is frozen while exploded so toggling a system does not make
  // the parts jump to a new plane mid-view.
  function layoutSheet() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (!sheetBasisRef.current) {
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() < 1e-9) dir.copy(viewDir(view));
      dir.normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      // Looking straight down: the sheet lies flat, "up" on it is world -Z.
      if (Math.abs(dir.dot(worldUp)) > 0.98) worldUp.set(0, 0, -1);
      const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
      const up = new THREE.Vector3().crossVectors(dir, right).normalize();
      sheetBasisRef.current = { right, up };
    }
    const { right, up } = sheetBasisRef.current;
    const items = visibleMeshes().map((mesh) => ({
      id: mesh.userData.id,
      w: spanAlong(mesh.userData.size, right),
      h: spanAlong(mesh.userData.size, up),
      group: mesh.userData.layer || 'other',
    }));
    const slots = layoutInventory(items, { groupOrder });
    for (const mesh of meshMapRef.current.values()) {
      const slot = slots.get(mesh.userData.id);
      if (!slot) {
        mesh.userData.target = null;
        continue;
      }
      mesh.userData.target = new THREE.Vector3()
        .addScaledVector(right, slot[0])
        .addScaledVector(up, slot[1]);
    }
  }

  // Box around the visible parts at explosion `amount`, in scene space.
  function visibleBox(amount) {
    const box = new THREE.Box3();
    const group = groupRef.current;
    if (!group) return box;
    const tmp = new THREE.Vector3();
    const half = new THREE.Vector3();
    for (const mesh of visibleMeshes()) {
      const { center, target, size } = mesh.userData;
      if (target && amount > 0) tmp.lerpVectors(center, target, amount);
      else tmp.copy(center);
      tmp.add(group.position);
      half.copy(size).multiplyScalar(0.5);
      box.expandByPoint(new THREE.Vector3().subVectors(tmp, half));
      box.expandByPoint(new THREE.Vector3().addVectors(tmp, half));
    }
    return box;
  }

  // Put the camera on `dir` (unit vector from the target) so `box` fills the view.
  function frameBox(box, dir) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const worldUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(dir.dot(worldUp)) > 0.98) worldUp.set(0, 0, -1);
    const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    const f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
    const distance =
      Math.max(spanAlong(size, up) / 2 / f, spanAlong(size, right) / 2 / f / aspect) +
      spanAlong(size, dir) / 2;
    if (!Number.isFinite(distance)) return;
    // Extra margin leaves room for the control bars overlaid on the viewport.
    controls.target.copy(c);
    camera.position.copy(c).addScaledVector(dir, Math.max(1, distance * 1.35));
    camera.far = Math.max(camera.far, distance * 20);
    camera.updateProjectionMatrix();
    controls.update();
  }

  const VIEW_DIRS = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    iso: [0.7, 0.7, 0.7],
  };

  function viewDir(viewKey) {
    return new THREE.Vector3(...(VIEW_DIRS[viewKey] || VIEW_DIRS.iso)).normalize();
  }

  useImperativeHandle(ref, () => ({
    // Capture a view with optional dimension overlay. Returns a PNG Blob.
    // Default is `withDimensions: true` because that's what a real
    // engineering drawing needs. Always captured assembled — a drawing of
    // an exploded inventory is not a drawing.
    async captureView(viewKey, {
      width = 900,
      height = 700,
      background = '#ffffff',
      withDimensions = true,
    } = {}) {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!renderer || !scene || !camera) {
        throw new Error('Viewer not ready');
      }

      const PAD = withDimensions ? 70 : 0;
      const innerW = Math.max(100, width - PAD * 2);
      const innerH = Math.max(100, height - PAD * 2);

      const origBg = scene.background;
      const origSize = renderer.getSize(new THREE.Vector2());
      const origPos = camera.position.clone();
      const origTarget = controls.target.clone();
      const origAspect = camera.aspect;
      const origGrid = gridRef.current?.visible;
      const origAxes = axesRef.current?.visible;
      const origAmount = amountRef.current;
      const origEmissive = new Map();

      try {
        scene.background = new THREE.Color(background);
        if (gridRef.current) gridRef.current.visible = false;
        if (axesRef.current) axesRef.current.visible = false;
        applyAmount(0);
        for (const mesh of meshMapRef.current.values()) {
          origEmissive.set(mesh, mesh.material.emissiveIntensity);
          mesh.material.emissiveIntensity = 0;
        }

        renderer.setSize(innerW, innerH, false);
        camera.aspect = innerW / innerH;
        frameBox(visibleBox(0), viewDir(viewKey));
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);

        // Compose into a 2D canvas so we can draw the dimension overlay.
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(renderer.domElement, PAD, PAD, innerW, innerH);

        const box = visibleBox(0);
        if (withDimensions && !box.isEmpty()) {
          const screen = projectBBoxToScreen(box, camera, innerW, innerH);
          const offsetBbox = {
            minX: screen.minX + PAD,
            maxX: screen.maxX + PAD,
            minY: screen.minY + PAD,
            maxY: screen.maxY + PAD,
          };
          const sizeV = box.getSize(new THREE.Vector3());
          drawDimensions(
            ctx,
            viewKey,
            { dimX: sizeV.x, dimY: sizeV.y, dimZ: sizeV.z },
            offsetBbox,
            width,
            height,
          );
          // Page border
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
          ctx.strokeRect(2, 2, width - 4, height - 4);
        }

        const blob = await new Promise((resolve) => finalCanvas.toBlob(resolve, 'image/png'));
        return blob;
      } finally {
        scene.background = origBg;
        if (gridRef.current) gridRef.current.visible = origGrid;
        if (axesRef.current) axesRef.current.visible = origAxes;
        for (const [mesh, intensity] of origEmissive) mesh.material.emissiveIntensity = intensity;
        applyAmount(origAmount);
        renderer.setSize(origSize.x, origSize.y, false);
        camera.aspect = origAspect;
        camera.position.copy(origPos);
        camera.updateProjectionMatrix();
        controls.target.copy(origTarget);
        controls.update();
        renderer.render(scene, camera);
      }
    },
    getModelInfo() {
      const bbox = bboxRef.current;
      if (!bbox) return null;
      const size = new THREE.Vector3();
      bbox.getSize(size);
      return {
        dimX: size.x,
        dimY: size.y,
        dimZ: size.z,
        triangles: normalized
          .filter((m) => m.visible !== false)
          .reduce((n, m) => n + m.positions.length / 9, 0),
      };
    },
    // Frame whatever is visible, from the direction the camera already looks.
    fitVisible() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      // A camera sitting on its target (or a poisoned one) has no direction;
      // fall back to the selected preset instead of propagating NaN.
      const usable = Number.isFinite(dir.lengthSq()) && dir.lengthSq() > 1e-9;
      frameBox(visibleBox(targetAmountRef.current), usable ? dir.normalize() : viewDir(view));
    },
  }), [normalized]);

  // Init scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(VIEWPORT[themeRef.current].bg);

    const camera = new THREE.PerspectiveCamera(45, width && height ? width / height : 1, 0.1, 10000);
    camera.position.set(100, 100, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // three r155+ uses physical light units, so intensities sit around 1–3.
    // Sky/ground fill keeps every face readable; the key light gives form.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 2.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(100, 200, 150);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dir2.position.set(-100, -50, -100);
    scene.add(dir2);

    const palette = VIEWPORT[themeRef.current];
    const grid = new THREE.GridHelper(500, 50, palette.grid[0], palette.grid[1]);
    grid.material.opacity = palette.gridOpacity;
    grid.material.transparent = true;
    scene.add(grid);
    gridRef.current = grid;

    const axes = new THREE.AxesHelper(50);
    scene.add(axes);
    axesRef.current = axes;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    // Click-to-inspect. A click is a press and release within a few pixels;
    // anything longer is an orbit drag and must not change the selection.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(visibleMeshes(), false);
      return {
        id: hits.length ? hits[0].object.userData.id : null,
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };
    let pressAt = null;
    const onDown = (e) => {
      if (e.button !== 0) return;
      pressAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      if (!pressAt || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y);
      pressAt = null;
      if (moved > 5 || !onPickRef.current) return;
      onPickRef.current(hitAt(e.clientX, e.clientY).id);
    };
    // Hover is raycast at most once per frame and never while orbiting, so a
    // thousand-part assembly still drags smoothly.
    let hoverPending = null;
    let hoverRaf = 0;
    let hoveredId = null;
    const flushHover = () => {
      hoverRaf = 0;
      if (!hoverPending || !onHoverRef.current) return;
      const hit = hitAt(hoverPending.x, hoverPending.y);
      hoverPending = null;
      renderer.domElement.style.cursor = hit.id ? 'pointer' : '';
      if (hit.id || hoveredId) onHoverRef.current(hit.id ? hit : null);
      hoveredId = hit.id;
    };
    const onMove = (e) => {
      if (pressAt) return;
      hoverPending = { x: e.clientX, y: e.clientY };
      if (!hoverRaf) hoverRaf = requestAnimationFrame(flushHover);
    };
    const onLeave = () => {
      hoverPending = null;
      renderer.domElement.style.cursor = '';
      if (hoveredId && onHoverRef.current) onHoverRef.current(null);
      hoveredId = null;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    let raf;
    const loop = () => {
      // Ease toward the requested explosion so a slider drag reads as motion,
      // not as parts teleporting between two layouts.
      const target = targetAmountRef.current;
      const current = amountRef.current;
      if (Math.abs(target - current) > 0.0005) {
        amountRef.current = current + (target - current) * 0.18;
        applyAmount(amountRef.current);
      } else if (current !== target) {
        amountRef.current = target;
        applyAmount(target);
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      // A hidden or collapsing container reports 0×0; an aspect of NaN or
      // Infinity would poison the camera and every position derived from it.
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build one mesh per model and hold them in a single group.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (groupRef.current) {
      scene.remove(groupRef.current);
      for (const mesh of meshMapRef.current.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      meshMapRef.current.clear();
      groupRef.current = null;
    }
    sheetBasisRef.current = null;

    if (!normalized.length) {
      bboxRef.current = null;
      return;
    }

    const group = new THREE.Group();
    const combined = new THREE.Box3();

    for (const m of normalized) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      combined.union(geometry.boundingBox);

      // The geometry keeps its real assembly coordinates and is never
      // translated: BufferAttribute shares `m.positions` with page state and
      // the saved session, so a geometry.translate() here would silently
      // re-centre every part on the next rebuild (StrictMode, added file,
      // restored session) and collapse the assembly onto the origin.
      // Explosion instead moves the mesh by an offset from the part's centre.
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      const size = geometry.boundingBox.getSize(new THREE.Vector3());

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(m.color || color),
          wireframe,
          metalness: 0.1,
          roughness: 0.6,
          side: THREE.DoubleSide,
          emissive: SELECT_EMISSIVE,
          emissiveIntensity: 0,
        })
      );
      // Position is an offset: (0,0,0) is the part's home in the assembly.
      mesh.position.set(0, 0, 0);
      mesh.visible = m.visible !== false;
      mesh.userData = { id: m.id, layer: m.layer, center, size, target: null };
      group.add(mesh);
      meshMapRef.current.set(m.id, mesh);
    }

    // Centre the assembly as a whole, keeping parts in their relative places.
    const center = combined.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -center.y, -center.z);
    scene.add(group);
    groupRef.current = group;

    // Bounding box in the same (centred) space the camera and the dimension
    // overlay work in.
    bboxRef.current = combined.clone().translate(center.clone().negate());

    if (targetAmountRef.current > 0) layoutSheet();
    applyAmount(amountRef.current);

    const size = combined.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const cam = cameraRef.current;
    cam.far = Math.max(cam.far, maxDim * 40);
    frameBox(visibleBox(targetAmountRef.current), viewDir(view));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geometryKey is the
    // intended trigger; colour/visibility are applied by the effect below.
  }, [geometryKey]);

  // Cheap per-model updates that must not rebuild geometry.
  useEffect(() => {
    let visibilityChanged = false;
    for (const m of normalized) {
      const mesh = meshMapRef.current.get(m.id);
      if (!mesh) continue;
      const nextVisible = m.visible !== false;
      if (mesh.visible !== nextVisible) visibilityChanged = true;
      mesh.visible = nextVisible;
      mesh.userData.layer = m.layer;
      mesh.material.color = new THREE.Color(m.color || color);
      mesh.material.wireframe = wireframe;
      mesh.material.needsUpdate = true;
    }
    // The sheet only holds visible parts, so it is re-packed when the set changes.
    if (visibilityChanged && targetAmountRef.current > 0) {
      layoutSheet();
      applyAmount(amountRef.current);
    }
  }, [normalized, color, wireframe]);

  useEffect(() => {
    for (const mesh of meshMapRef.current.values()) {
      mesh.material.emissiveIntensity = mesh.userData.id === selectedId ? 0.35 : 0;
    }
  }, [selectedId, geometryKey]);

  // Explosion amount: lay the sheet out on the first move away from zero and
  // forget its orientation once fully home again.
  useEffect(() => {
    const amount = Math.min(1, Math.max(0, Number(explode) || 0));
    const wasHome = targetAmountRef.current === 0;
    targetAmountRef.current = amount;
    if (amount > 0 && (wasHome || !sheetBasisRef.current)) layoutSheet();
    if (amount === 0) sheetBasisRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutSheet reads refs only.
  }, [explode]);

  useEffect(() => {
    if (!cameraRef.current || !bboxRef.current) return;
    frameBox(visibleBox(targetAmountRef.current), viewDir(view));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view is the trigger.
  }, [view]);

  // Repaint the viewport when the theme changes under a scene that already
  // exists. Only the background and grid move; the lights stay put, because
  // they decide how a surface reads and that must not depend on the theme.
  useEffect(() => {
    const palette = VIEWPORT[theme] || VIEWPORT.light;
    if (sceneRef.current) sceneRef.current.background = new THREE.Color(palette.bg);
    const grid = gridRef.current;
    if (grid) {
      const next = new THREE.GridHelper(500, 50, palette.grid[0], palette.grid[1]);
      grid.material.colors = next.material.colors;
      grid.geometry.setAttribute('color', next.geometry.getAttribute('color'));
      grid.material.opacity = palette.gridOpacity;
      grid.material.needsUpdate = true;
      next.geometry.dispose();
      next.material.dispose();
    }
  }, [theme]);

  return <div ref={containerRef} className="w-full h-full" />;
});

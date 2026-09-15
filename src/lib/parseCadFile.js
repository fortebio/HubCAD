import { parseSTL } from '@/lib/stlParser';
import { parseOBJ } from '@/lib/objParser';
import {
  parseSTEP,
  parseIGES,
  parseBREP,
  parseSTEPParts,
  parseIGESParts,
  parseBREPParts,
} from '@/lib/stepParser';

/** Formats the viewer and the cost estimator both accept. */
export const CAD_ACCEPT = '.stl,.obj,.step,.stp,.iges,.igs,.brep';

function extOf(file) {
  return (file.name.split('.').pop() || '').toLowerCase();
}

function baseName(file) {
  return file.name.replace(/\.[^.]+$/, '');
}

/** Parse one CAD file into a Float32Array of triangle positions. */
export async function parseCadFile(file) {
  const ext = extOf(file);
  if (ext === 'stl') return parseSTL(await file.arrayBuffer());
  if (ext === 'obj') return parseOBJ(await file.text());
  if (ext === 'step' || ext === 'stp') return parseSTEP(await file.arrayBuffer());
  if (ext === 'iges' || ext === 'igs') return parseIGES(await file.arrayBuffer());
  if (ext === 'brep') return parseBREP(await file.arrayBuffer());
  throw new Error(`Unsupported format: .${ext}`);
}

/**
 * Parse one CAD file into its placed bodies. A STEP/IGES/BREP assembly yields
 * one entry per body with the assembly path it sits under; a mesh file (STL,
 * OBJ) is a single unnamed body and yields one entry named after the file.
 *
 * Returns `[{ name, path: string[], positions: Float32Array, color: string|null }]`.
 */
export async function parseCadParts(file) {
  const ext = extOf(file);
  const single = (positions) => [{ name: baseName(file), path: [], positions, color: null }];
  if (ext === 'stl') return single(parseSTL(await file.arrayBuffer()));
  if (ext === 'obj') return single(parseOBJ(await file.text()));
  if (ext === 'step' || ext === 'stp') return parseSTEPParts(await file.arrayBuffer());
  if (ext === 'iges' || ext === 'igs') return parseIGESParts(await file.arrayBuffer());
  if (ext === 'brep') return parseBREPParts(await file.arrayBuffer());
  throw new Error(`Unsupported format: .${ext}`);
}

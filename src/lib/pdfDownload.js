// Utility: trigger backend exports (PDF / DOCX / HTML / Markdown) using the
// current auth token. PDF + HTML open inline in a new tab; DOCX + Markdown
// download as a file. Excel export is BOM-specific and uses a separate path.

const INLINE_FORMATS = new Set(['pdf', 'html']);

export async function downloadExport(format, kind, documentId, opts = {}) {
  if (!documentId) {
    alert('Pick a document first / Chọn tài liệu trước');
    return;
  }
  const params = new URLSearchParams();
  if (opts.watermark) params.set('watermark', opts.watermark);
  if (opts.checklistType) params.set('checklistType', opts.checklistType);
  const url = `/api/export/${format}/${kind}/${documentId}` + (params.toString() ? `?${params}` : '');
  const token = localStorage.getItem('auth_token');
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  if (INLINE_FORMATS.has(format)) {
    window.open(blobUrl, '_blank');
  } else {
    // server's Content-Disposition gives us the filename; reuse it
    const disp = res.headers.get('content-disposition') || '';
    const m = /filename="([^"]+)"/.exec(disp);
    const fileName = m ? m[1] : `export.${format}`;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

// Backwards-compatible aliases — all existing callers used downloadPdf().
export function downloadPdf(kind, documentId, opts = {}) {
  return downloadExport('pdf', kind, documentId, opts);
}

export async function downloadBomExcel(bomId, fileName) {
  const token = localStorage.getItem('auth_token');
  const url = `/api/bom/${bomId}/export-excel`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Excel export failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName || 'bom.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function uploadBomExcel(bomId, file) {
  const token = localStorage.getItem('auth_token');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/bom/${bomId}/import-excel`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
  return data;
}

/**
 * Exports that are generated from what is on screen rather than from a saved
 * record: the payload is POSTed and the response is opened or downloaded.
 */
export async function postDownload(path, body, { inline = false, fileName } = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const ctype = res.headers.get('content-type') || '';
    const detail = ctype.includes('application/json')
      ? (await res.json())?.error
      : await res.text();
    throw new Error(detail || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  if (inline) {
    window.open(blobUrl, '_blank');
  } else {
    const disp = res.headers.get('content-disposition') || '';
    const m = /filename="([^"]+)"/.exec(disp);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || (m ? m[1] : 'export');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

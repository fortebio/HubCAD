const BASE = '/api';

function getToken() {
  return localStorage.getItem('auth_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const ctype = res.headers.get('content-type') || '';
  const data = ctype.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof data === 'object' ? data?.error || JSON.stringify(data) : data;
    throw new Error(message || `${res.status} ${res.statusText}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
  /**
   * Binary GET. `request` decodes every non-JSON response as text, which would
   * corrupt a STEP or STL, so this one stays raw.
   */
  blob: async (path) => {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        message = (await res.json())?.error || message;
      } catch {
        /* keep the status line */
      }
      throw new Error(message);
    }
    return res.blob();
  },
};

export const apiPaths = {
  // cad source (CAD_ROOT browser + Python introspection)
  cadCapabilities: '/cad-source/capabilities',
  cadTree: (rel = '') => `/cad-source/tree?path=${encodeURIComponent(rel)}`,
  cadResolveFolder: '/cad-source/resolve-folder',
  cadFile: (rel) => `/cad-source/file?path=${encodeURIComponent(rel)}`,
  cadRaw: (rel) => `/cad-source/raw?path=${encodeURIComponent(rel)}`,
  cadIntrospect: (rel) => `/cad-source/introspect?path=${encodeURIComponent(rel)}`,
  cadPreview: '/cad-source/preview',
  cadWrite: '/cad-source/write',
  cadRebuild: '/cad-source/rebuild',
  cadAllowRebuild: '/cad-source/allow-rebuild',
  cadRebuildStatus: (rel) => `/cad-source/rebuild-status?path=${encodeURIComponent(rel)}`,
  // auth
  login: '/auth/login',
  me: '/auth/me',
  // documents
  documents: '/documents',
  documentStats: '/documents/stats',
  document: (id) => `/documents/${id}`,
  documentWorkflow: (id) => `/documents/${id}/workflow`,
  documentStatus: (id) => `/documents/${id}/status`,
  // bom
  bomByDoc: (id) => `/bom/by-document/${id}`,
  bom: (id) => `/bom/${id}`,
  bomItems: (id) => `/bom/${id}/items`,
  bomCost: (id) => `/bom/${id}/cost`,
  // ecr
  ecrs: '/ecr',
  ecr: (id) => `/ecr/${id}`,
  ecrApprove: (id) => `/ecr/${id}/approve`,
  ecrNotify: (id) => `/ecr/${id}/notify`,
  ecrStats: '/ecr/stats/summary',
  // files
  upload: (kind) => `/files/upload/${kind}`,
  modelsByDoc: (id) => `/files/models/by-document/${id}`,
  // checklists
  checklistsByDoc: (id) => `/checklists/by-document/${id}`,
  checklists: '/checklists',
  // pdf
  pdf: (kind, id, qs = '') => `/pdf/${kind}/${id}${qs ? '?' + qs : ''}`,
  // wi / catalog content
  wiByDoc: (id) => `/wi/by-document/${id}`,
  catalogByDoc: (id) => `/catalog/by-document/${id}`,
  // bom excel + compare
  bomExportExcel: (id) => `/bom/${id}/export-excel`,
  bomImportExcel: (id) => `/bom/${id}/import-excel`,
  bomSnapshot: (id) => `/bom/${id}/snapshot`,
  bomSnapshots: (id) => `/bom/${id}/snapshots`,
  bomCompare: (id, base, target) => `/bom/${id}/compare?base=${base}&target=${target}`,
  // users
  users: '/users',
  user: (id) => `/users/${id}`,
  // audit
  audit: (qs = '') => `/audit${qs ? '?' + qs : ''}`,
  auditStats: '/audit/stats',
  // drawing templates
  drawingTemplates: '/drawing-templates',
  drawingTemplate: (id) => `/drawing-templates/${id}`,
  // cost rates + quotations
  costSettings: '/cost-settings',
  quotes: '/quotes',
  quote: (id) => `/quotes/${id}`,
  quoteNextNumber: '/quotes/next-number',
  quoteExport: (format) => `/quotes/export/${format}`,
};

// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// THE WIRE — the only file that talks to DATABASE.server.BIM. Every failure
// becomes an ApiError whose message is a sentence (logic.describeError).

import { describeError, partUrl } from './logic.js';

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function createApi(base, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const cache = new Map();

  async function request(method, path, body) {
    const url = /^https?:/i.test(path) ? path : base + path;
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch {
      throw new ApiError(0, describeError(0, null, method), null);
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new ApiError(res.status, describeError(res.status, data, method), data);
    return data;
  }

  /** GET, remembered for the page's life unless `fresh` (the library changes rarely). */
  function get(path, { fresh = false } = {}) {
    if (!fresh && cache.has(path)) return cache.get(path);
    const p = request('GET', path);
    cache.set(path, p);
    p.catch(() => cache.delete(path));
    return p;
  }

  return {
    base,
    get,
    stats: () => get('/stats'),
    schema: () => get('/schema'),
    facets: (query) => get(query),
    parts: (query) => get(query),
    makers: () => get('/makers'),
    maker: (slug) => get(`/makers/${encodeURIComponent(slug)}`),
    part: (id, opts) => get(partUrl('', id), opts),
    async save(id, part) {
      const saved = await request('PUT', partUrl('', id), part);
      cache.clear();
      return saved;
    },
    async remove(id) {
      const out = await request('DELETE', partUrl('', id));
      cache.clear();
      return out;
    },
    url: (id, ext) => partUrl(base, id, ext),
  };
}

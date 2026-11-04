// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApi, ApiError } from '../js/api.js';

function fakeFetch(routes, calls = []) {
  return async (url, init) => {
    calls.push([init.method, url, init.body]);
    const [status, body] = routes[`${init.method} ${url}`] || [404, { error: 'no such route' }];
    return { ok: status < 400, status, text: async () => (body == null ? '' : JSON.stringify(body)) };
  };
}

test('reads go to base + path and are remembered', async () => {
  const calls = [];
  const api = createApi('http://h/api/bim', fakeFetch({ 'GET http://h/api/bim/stats': [200, { parts: 3 }] }, calls));
  assert.deepEqual(await api.stats(), { parts: 3 });
  await api.stats();
  assert.equal(calls.length, 1);
  assert.equal(api.url('a/b', '.ifc'), 'http://h/api/bim/parts/a/b.ifc');
});

test('a refused write (401) says the gateway wants the bench credential', async () => {
  const api = createApi('/api/bim', fakeFetch({ 'PUT /api/bim/parts/a/b': [401, null] }));
  await assert.rejects(api.save('a/b', { id: 'a/b' }), (err) => err instanceof ApiError && err.status === 401 && /bench credential/.test(err.message));
});

test('a failed read is not cached; an unreachable server is status 0', async () => {
  let n = 0;
  const api = createApi('/api/bim', async () => { n++; throw new TypeError('offline'); });
  await assert.rejects(api.part('a/b'), (err) => err.status === 0);
  await assert.rejects(api.part('a/b'), (err) => err.status === 0);
  assert.equal(n, 2);
});

test('saving clears the read cache so the page shows the saved part', async () => {
  const calls = [];
  const api = createApi('/api/bim', fakeFetch({
    'GET /api/bim/parts/a/b': [200, { id: 'a/b' }],
    'PUT /api/bim/parts/a/b': [200, { id: 'a/b', model: 'B' }],
  }, calls));
  await api.part('a/b');
  await api.save('a/b', { id: 'a/b', model: 'B' });
  await api.part('a/b');
  assert.deepEqual(calls.map((c) => c[0]), ['GET', 'PUT', 'GET']);
  assert.equal(calls[1][2], JSON.stringify({ id: 'a/b', model: 'B' }));
});

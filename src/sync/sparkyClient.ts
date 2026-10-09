import type { SparkyRecord } from './sparkyMapping';

/** "my-server.com/", "https://host/api" and "https://host" all become "https://host". */
export function normalizeServerUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${url.origin}${path}`;
}

export type SparkyOutcome =
  /** The server took the batch. `errors` lists records it rejected (it still saved the rest). */
  | { kind: 'ok'; processed: number; errors: string[] }
  | { kind: 'unauthorized' } // 401: missing, invalid or inactive key
  | { kind: 'forbidden' } // 403: key lacks health_data_write
  | { kind: 'rejected'; message: string } // 400: the body was malformed
  | { kind: 'failed'; message: string }; // network error, 5xx, anything unexpected

function describeError(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const msg = o.error ?? o.message ?? o.reason;
    if (typeof msg === 'string') return o.type ? `${String(o.type)}: ${msg}` : msg;
  }
  return JSON.stringify(e);
}

/**
 * POST /api/health-data. The server answers 200 even when some records fail, so success is read
 * from the `errors` array, not the status.
 */
export async function postHealthData(
  serverUrl: string,
  apiKey: string,
  records: readonly SparkyRecord[],
  fetchImpl: typeof fetch = fetch,
): Promise<SparkyOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(`${serverUrl}/api/health-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(records),
    });
  } catch (e) {
    return { kind: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
  if (res.status === 401) return { kind: 'unauthorized' };
  if (res.status === 403) return { kind: 'forbidden' };

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (res.status === 400) {
    return { kind: 'rejected', message: typeof obj.error === 'string' ? obj.error : 'The server rejected the request.' };
  }
  if (!res.ok) {
    return { kind: 'failed', message: typeof obj.error === 'string' ? obj.error : `Server returned ${res.status}.` };
  }
  const errors = Array.isArray(obj.errors) ? obj.errors.map(describeError) : [];
  const processed = Array.isArray(obj.processed) ? obj.processed.length : typeof obj.processed === 'number' ? obj.processed : 0;
  return { kind: 'ok', processed, errors };
}

export type ConnectionCheck = { ok: true } | { ok: false; message: string };

/**
 * Checks the URL and key by posting an empty batch. The key is checked before the body, so a 401 or
 * 403 means a bad key or missing permission, while 200 or 400 both mean we got past authentication.
 */
export async function checkConnection(serverUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ConnectionCheck> {
  const out = await postHealthData(serverUrl, apiKey, [], fetchImpl);
  switch (out.kind) {
    case 'ok':
    case 'rejected':
      return { ok: true };
    case 'unauthorized':
      return { ok: false, message: 'The server did not accept that API key.' };
    case 'forbidden':
      return { ok: false, message: 'That API key does not have the health_data_write permission.' };
    case 'failed':
      return { ok: false, message: `Could not reach the server: ${out.message}` };
  }
}

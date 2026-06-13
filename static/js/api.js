/* ─── API helpers ────────────────────────────────────────── */
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, data });
  return data;
}
const apiGet  = url       => apiFetch(url);
const apiPost = (url, b)  => apiFetch(url, { method: 'POST',   body: JSON.stringify(b) });
const apiPut  = (url, b)  => apiFetch(url, { method: 'PUT',    body: JSON.stringify(b) });
const apiDel  = url       => apiFetch(url, { method: 'DELETE' });


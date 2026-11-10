/** Browser-side helpers for the admin screens. */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function adminFetch<T = unknown>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) throw new Error('Your session has expired. Sign in again in another tab, then retry.');
  if (!res.ok) throw new Error(data.error || `The request failed (${res.status}).`);
  return data as T;
}

export type UploadedImage = { url: string; width: number | null; height: number | null };

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is larger than 4 MB. Resize or compress it and try again.');
  }
  let res: Response;
  try {
    res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
      body: file,
    });
  } catch {
    throw new Error('The upload did not reach the server. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as Partial<UploadedImage> & { error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || `The upload failed (${res.status}).`);
  return { url: data.url, width: data.width ?? null, height: data.height ?? null };
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value of <input type="datetime-local"> → ISO timestamp, or null when empty/invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface FERResponse {
  pos: number;
  neu: number;
  fru: number;
}

const DEFAULT_FER_BASE = "http://127.0.0.1:8000";

export async function postFER(imageBlob: Blob, base: string | undefined = process.env.NEXT_PUBLIC_FER_BASE): Promise<FERResponse> {
  const apiBase = (base && base.length > 0) ? base : DEFAULT_FER_BASE;
  const endpoint = `${apiBase.replace(/\/$/, '')}/fer`;
  const form = new FormData();
  form.append('file', imageBlob, 'face.jpg');
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`FER request failed (${res.status}): ${text || res.statusText}`);
    // Attach status for callers
    (err as any).status = res.status;
    throw err;
  }
  const json = await res.json();
  return json as FERResponse;
}












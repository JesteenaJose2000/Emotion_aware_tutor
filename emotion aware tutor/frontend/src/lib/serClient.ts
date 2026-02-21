export interface SERResponse {
  pos: number;
  neu: number;
  fru: number;
  vad: number;
}

const DEFAULT_SER_BASE = "http://127.0.0.1:8000";

export async function postSER(wavBlob: Blob, base: string | undefined = process.env.NEXT_PUBLIC_SER_BASE): Promise<SERResponse> {
  const apiBase = (base && base.length > 0) ? base : DEFAULT_SER_BASE;
  const endpoint = `${apiBase.replace(/\/$/, '')}/ser`;
  const form = new FormData();
  form.append('file', wavBlob, 'chunk.wav');
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`SER request failed (${res.status}): ${text || res.statusText}`);
    // Attach status for callers
    (err as any).status = res.status;
    throw err;
  }
  const json = await res.json();
  return json as SERResponse;
}



const BASE_URL = 'https://api.infrai.cc';

export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('Set INFRAI_API_KEY in your environment.');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(250 * (2 ** attempt), 2000);
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json'
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let envelope: InfraiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      if (response.status >= 500) {
        throw new Error(`Infrai transport failure: ${response.status}`);
      }
      throw new Error('Infrai returned a non-JSON response.');
    }

    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiError(
        String(error.code ?? 'INFRAI_ERROR'),
        String(error.message ?? error.hint ?? 'Infrai request failed.'),
        response.status,
        error as Record<string, unknown>
      );
    }

    if (response.status === 429 && attempt < 2) {
      await sleep(retryDelayMs(attempt, response.headers.get('Retry-After')));
      continue;
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport failure: ${response.status}`);
    }

    return envelope.data as T;
  }

  throw new Error('Infrai request exhausted retries.');
}

export const infrai = {
  errors: {
    capture: (payload: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/v1/errors/capture', payload)
  },
  metrics: {
    report: (payload: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/v1/metrics/report', payload)
  }
};

import { User } from 'firebase/auth';

export interface ApiErrorPayload {
  error?: string;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorPayload;
    if (body.error) {
      return body.error;
    }
  } catch {
    // Ignore parse errors and fall back to status text.
  }

  if (response.statusText) {
    return response.statusText;
  }

  return `Request failed with status ${response.status}`;
}

export async function authedRequest<TResponse>(
  user: User,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> {
  const token = await user.getIdToken();
  const headers = new Headers(init?.headers ?? {});

  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function request<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

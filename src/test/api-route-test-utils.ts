import type { NextApiRequest, NextApiResponse } from 'next';

interface CreateRouteRequestOptions {
  method: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface MockApiResponse<T = any> {
  statusCode: number;
  jsonBody: T | null;
  headers: Record<string, string | string[]>;
  status: (code: number) => MockApiResponse<T>;
  json: (body: T) => MockApiResponse<T>;
  setHeader: (name: string, value: string | string[]) => void;
}

export function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
    body: undefined,
    ...overrides,
  } as NextApiRequest;
}

export function createMockRes<T = any>(): NextApiResponse<T> & MockApiResponse<T> {
  const res: MockApiResponse<T> = {
    statusCode: 200,
    jsonBody: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: T) {
      this.jsonBody = body;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      this.headers[name] = value;
    },
  };

  return res as NextApiResponse<T> & MockApiResponse<T>;
}

export function createRouteRequest(options: CreateRouteRequestOptions): Request {
  const headers = new Headers(options.headers ?? {});
  let body: string | undefined;

  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new Request(options.url ?? 'http://localhost/api/test', {
    method: options.method,
    headers,
    body,
  });
}

export async function readJson<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function createRouteContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

import type { NextApiRequest, NextApiResponse } from 'next';

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

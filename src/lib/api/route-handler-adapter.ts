import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type QueryValue = string | string[];

class MockApiResponse {
  statusCode = 200;
  headers: Record<string, string | string[]> = {};
  payload: unknown;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string | string[]) {
    this.headers[name] = value;
    return this;
  }

  json(body: unknown) {
    this.payload = body;
    return this;
  }

  send(body: unknown) {
    this.payload = body;
    return this;
  }

  end(body?: unknown) {
    if (body !== undefined) {
      this.payload = body;
    }
    return this;
  }
}

function addHeader(headers: Headers, name: string, value: string | string[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      headers.append(name, item);
    }
    return;
  }

  headers.set(name, value);
}

function getRequestHeaders(request: NextRequest): NextApiRequest['headers'] {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  return headers;
}

function getRequestQuery(
  request: NextRequest,
  params: Record<string, QueryValue>
): NextApiRequest['query'] {
  const query: Record<string, QueryValue> = { ...params };
  const url = new URL(request.url);

  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      query[key] = [...existing, value];
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

async function getRequestBody(request: NextRequest): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return undefined;
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  try {
    return await request.text();
  } catch {
    return undefined;
  }
}

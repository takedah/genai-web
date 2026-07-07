import { fetchAuthSession } from 'aws-amplify/auth';

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

interface ApiClientOptions {
  withAuth?: boolean;
}

const buildUrl = (base: string, path: string, params?: RequestOptions['params']): string => {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

const parseResponseBody = async <T>(res: Response): Promise<T> => {
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
};

const getRequestHeaders = async (
  hasBody: boolean,
  withAuth: boolean,
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (withAuth) {
    const token = (await fetchAuthSession()).tokens?.idToken?.toString();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
};

const createApiClient = (baseURL: string, options: ApiClientOptions = {}) => {
  const withAuth = options.withAuth ?? true;
  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> => {
    const url = buildUrl(baseURL, path, options?.params);
    const requestHeaders = await getRequestHeaders(body !== undefined, withAuth);

    const res = await fetch(url, {
      method,
      headers: { ...requestHeaders, ...options?.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorData = await parseResponseBody<unknown>(res);
      throw new ApiError(res.status, errorData);
    }

    const data = await parseResponseBody<T>(res);
    return { data, status: res.status };
  };

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PUT', path, body, options),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>('DELETE', path, undefined, options),
  };
};

export const teamApi = createApiClient(import.meta.env.VITE_APP_TEAM_ACCESS_CONTROL_API_ENDPOINT);

export const genUApi = createApiClient(import.meta.env.VITE_APP_API_ENDPOINT);

export const genUPublicApi = createApiClient(import.meta.env.VITE_APP_API_ENDPOINT, {
  withAuth: false,
});

export const teamApiFetcher = <T>(url: string): Promise<T> =>
  teamApi.get<T>(url).then((res) => res.data);

export const genUApiFetcher = <T>(url: string): Promise<T> =>
  genUApi.get<T>(url).then((res) => res.data);

export const uploadToSignedUrl = async (
  url: string,
  data: File | Blob,
  contentType: string,
): Promise<Response> => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: data,
  });
  if (!res.ok) {
    throw new ApiError(res.status, undefined);
  }
  return res;
};

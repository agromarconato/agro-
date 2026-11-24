export async function apiFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string | null;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error || `Erro na requisição (${response.status}).`
    ) as Error & {
      status?: number;
      code?: string;
      whatsappUrl?: string;
    };
    error.status = response.status;
    error.code = payload?.code;
    error.whatsappUrl = payload?.whatsappUrl;
    throw error;
  }

  return payload as T;
}

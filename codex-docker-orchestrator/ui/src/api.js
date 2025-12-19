const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

export function apiUrl(path) {
  if (!apiBaseUrl) return path;
  return new URL(path, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`).toString();
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

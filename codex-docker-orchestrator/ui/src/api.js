export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
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

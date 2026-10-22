export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : '')).replace(/\/$/, '');

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Crucial for HttpOnly cookies
  });

  if (response.status === 401) {
    // Optionally trigger a global logout event or redirect here if desired,
    // but typically individual pages or an AuthProvider will handle the redirect.
    throw new Error('Unauthorized');
  }

  // If the response is not ok (4xx, 5xx), attempt to parse error message
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    let rawDetail = null;
    try {
      const errorData = await response.json();
      rawDetail = errorData.detail;
      errorMessage = typeof errorData.detail === 'string' ? errorData.detail : (errorData.message || errorMessage);
    } catch {
      // Not JSON
    }
    const error = new Error(errorMessage);
    (error as any).detail = rawDetail;
    throw error;
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }
  
  // Try to parse JSON, fallback to blob/text if it fails
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
      return response.json();
  }
  return response;
}

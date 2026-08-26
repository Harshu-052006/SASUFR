// Shared frontend API + auth utilities (same-origin)
// Exposed as window.Api for inline scripts.

(function () {
    const baseUrl = window.location.origin;

    function isFileProtocol() {
        return window.location.protocol === 'file:';
    }

    function ensureHttp(pageHint) {
        if (!isFileProtocol()) return true;
        const hint = pageHint || 'http://127.0.0.1:8000/static/...';
        alert(`Please open this page via the FastAPI server (${hint}). File:// mode cannot call the API.`);
        return false;
    }

    function getToken() {
        return "cookie-auth"; // No longer used, handled by HttpOnly cookie
    }

    function setToken(token) {
        // No longer used, backend sets HttpOnly cookie
    }

    function authHeaders() {
        return {}; // No longer used
    }

    async function apiFetch(path, options = {}) {
        const headers = { ...(options.headers || {}) };

        // Default JSON unless caller explicitly sets Content-Type or uses FormData.
        const body = options.body;
        const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);

        if (!isFormData && body && typeof body === 'object' && !(body instanceof Blob) && !(typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer)) {
            if (!('Content-Type' in headers)) headers['Content-Type'] = 'application/json';
            options = { ...options, body: JSON.stringify(body) };
        }

        // Always include credentials (cookies) for API requests
        options.credentials = 'include';

        const resp = await fetch(`${baseUrl}${path}`, { ...options, headers });
        const contentType = resp.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
            data = await resp.json().catch(() => ({}));
        } else {
            data = await resp.text().catch(() => '');
        }
        return { resp, data };
    }

    async function requireAuth({ redirectTo = 'login.html' } = {}) {

        try {
            const { resp, data } = await apiFetch('/users/me', { method: 'GET' });
            if (!resp.ok) {
                // If unauthorized, backend cookie is missing or invalid
                window.location.href = redirectTo;
                return null;
            }
            return data;
        } catch {
            // If backend is temporarily unreachable, keep the user on the page.
            return null;
        }
    }

    async function requireAdmin({ redirectUserTo = 'user_dashboard.html', redirectTo = 'login.html' } = {}) {
        const user = await requireAuth({ redirectTo });
        if (!user) return null;
        if (!user.is_admin) {
            alert('Access Denied: Admins only.');
            window.location.href = redirectUserTo;
            return null;
        }
        return user;
    }

    async function downloadFile(path, filename) {
        const resp = await fetch(`${baseUrl}${path}`, {
            credentials: 'include'
        });
        if (!resp.ok) {
            const contentType = resp.headers.get('content-type') || '';
            let message = 'Download failed';
            if (contentType.includes('application/json')) {
                const data = await resp.json().catch(() => ({}));
                message = data.detail || message;
            }
            throw new Error(message);
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function logout() {
        await apiFetch('/logout', { method: 'POST', credentials: 'include' });
        window.location.href = 'login.html';
    }

    window.Api = {
        baseUrl,
        isFileProtocol,
        ensureHttp,
        getToken,
        setToken,
        authHeaders,
        apiFetch,
        requireAuth,
        requireAdmin,
        downloadFile,
        logout,
    };
})();

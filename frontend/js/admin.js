const API_BASE_URL = window.location.origin;

async function fetchAPI(endpoint, options = {}) {
    const { resp, data } = await window.Api.apiFetch(endpoint, options);
    if (!resp.ok) {
        throw new Error(data?.detail || data?.message || 'API Request failed');
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const openDomainModalBtn = document.getElementById('openDomainModalBtn');
    const openImportModalBtn = document.getElementById('openImportModalBtn');
    const openPendingModalBtn = document.getElementById('openPendingModalBtn');
    
    if (openDomainModalBtn) {
        openDomainModalBtn.addEventListener('click', () => {
            document.getElementById('domainConfigModal').classList.add('active');
            fetchAPI('/admin/config').then(data => {
                if(data && data.official_domain) {
                    document.getElementById('domainInput').value = data.official_domain;
                }
            }).catch(console.error);
        });
    }

    if (openImportModalBtn) {
        openImportModalBtn.addEventListener('click', () => document.getElementById('importStudentsModal').classList.add('active'));
    }

    if (openPendingModalBtn) {
        openPendingModalBtn.addEventListener('click', () => {
            document.getElementById('pendingApprovalsModal').classList.add('active');
            loadPendingApprovals();
        });
    }

    // Domain Config Submit
    const domainConfigForm = document.getElementById('domainConfigForm');
    if (domainConfigForm) {
        domainConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const domain = document.getElementById('domainInput').value;
            const password = document.getElementById('domainAdminPassword').value;
            try {
                await fetchAPI('/admin/config', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        official_domain: domain,
                        admin_password: password
                    })
                });
                alert('Domain configuration updated successfully');
                document.getElementById('domainConfigModal').classList.remove('active');
            } catch (err) {
                alert(err.message || 'Failed to update domain config');
            }
        });
    }

    // Import Students Submit
    const importStudentsForm = document.getElementById('importStudentsForm');
    if (importStudentsForm) {
        importStudentsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('csvFile');
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            const progressContainer = document.getElementById('uploadProgressContainer');
            const progressBar = document.getElementById('uploadProgressBar');
            const progressText = document.getElementById('uploadProgressText');
            const submitBtn = document.getElementById('uploadSubmitBtn');

            if (progressContainer) progressContainer.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'UPLOADING...';
                submitBtn.style.opacity = '0.7';
            }

            const token = localStorage.getItem('token');
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/admin/import_students`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    if (progressBar) progressBar.style.width = percentComplete + '%';
                    if (progressText) progressText.textContent = percentComplete + '%';
                }
            };

            xhr.onload = () => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'UPLOAD DATASET';
                    submitBtn.style.opacity = '1';
                }
                
                let data;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (err) {
                    data = { detail: 'Invalid response from server' };
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    // Hide progress container on success
                    if (progressContainer) progressContainer.style.display = 'none';
                    alert(data.message || 'Import successful');
                    document.getElementById('importStudentsModal').classList.remove('active');
                    if (typeof loadUsersDirectory === 'function') {
                        loadUsersDirectory();
                    }
                } else {
                    alert(data.detail || data.message || 'Import failed');
                }
            };

            xhr.onerror = () => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'UPLOAD DATASET';
                    submitBtn.style.opacity = '1';
                }
                alert('Network error occurred during upload.');
            };

            xhr.send(formData);
        });
    }

    // Load Pending Approvals on start to update badge
    loadPendingBadge();
    
    // Fallback load users to avoid empty table is removed because admin_users.html handles it natively with filters
});

async function loadPendingBadge() {
    try {
        const data = await fetchAPI('/admin/pending_approvals');
        const badge = document.getElementById('pendingBadge');
        if (data && data.length > 0) {
            badge.textContent = data.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        console.error("Failed to load pending approvals badge", e);
    }
}

async function loadPendingApprovals() {
    const tbody = document.getElementById('pendingTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Loading...</td></tr>';
    try {
        const data = await fetchAPI('/admin/pending_approvals');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No pending approvals</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        data.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px; color: #fff;">
                    <div>${user.full_name || 'N/A'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${user.email}</div>
                </td>
                <td style="padding: 12px; color: var(--text-dim);">${user.role} ${user.designation ? `(${user.designation})` : ''}</td>
                <td style="padding: 12px;">
                    ${user.id_card_image ? `<a href="${user.id_card_image}" target="_blank" style="color: var(--accent); text-decoration: underline;">View ID</a>` : '<span style="color: var(--text-dim);">N/A</span>'}
                </td>
                <td style="padding: 12px; text-align: right;">
                    <button onclick="approveUser(${user.id})" class="btn-premium" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 6px; margin-right: 8px;">APPROVE</button>
                    <button onclick="rejectUser(${user.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 6px;">REJECT</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Error: ${e.message}</td></tr>`;
    }
}

window.approveUser = async function(userId) {
    const pwd = prompt("Enter admin password to approve:");
    if (!pwd) return;
    try {
        await fetchAPI('/admin/approve', {
            method: 'POST',
            body: { user_id: userId, admin_password: pwd }
        });
        alert('User approved successfully');
        loadPendingApprovals();
        loadPendingBadge();
        if (typeof loadUsersDirectory === 'function') loadUsersDirectory();
    } catch (e) {
        alert('Failed to approve: ' + e.message);
    }
};

window.rejectUser = async function(userId) {
    const pwd = prompt("Enter admin password to reject:");
    if (!pwd) return;
    try {
        await fetchAPI('/admin/reject', {
            method: 'POST',
            body: { user_id: userId, admin_password: pwd }
        });
        alert('User rejected successfully');
        loadPendingApprovals();
        loadPendingBadge();
        if (typeof loadUsersDirectory === 'function') loadUsersDirectory();
    } catch (e) {
        alert('Failed to reject: ' + e.message);
    }
};

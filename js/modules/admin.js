// Módulo de Administración de Usuarios (Solo Admin)

async function openUserAdmin() {
    // Verificar permisos
    if (!currentUser || currentUser.rol !== 'ADMIN') {
        alert("Acceso denegado. Solo administradores.");
        return;
    }

    const modal = document.getElementById('userAdminModal');
    const overlay = document.getElementById('userAdminOverlay');
    if (modal) {
        modal.style.display = 'flex';
        if (overlay) overlay.style.display = 'block';
        loadUsersList();
    }
}

function closeUserAdmin() {
    const modal = document.getElementById('userAdminModal');
    const overlay = document.getElementById('userAdminOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

async function loadUsersList() {
    const listContainer = document.getElementById('userListContainer');
    listContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios...</div>';

    try {
        const formData = new FormData();
        formData.append('action', 'getUsers');
        formData.append('token', sessionStorage.getItem('token') || '');

        const response = await fetch(API_URL_POST, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            renderUserTable(result.users);
        } else {
            listContainer.innerHTML = `<div class="error-msg">${result.message}</div>`;
        }

    } catch (error) {
        console.error("Error cargando usuarios:", error);
        listContainer.innerHTML = '<div class="error-msg">Error de conexión al cargar usuarios.</div>';
    }
}

function renderUserTable(users) {
    const listContainer = document.getElementById('userListContainer');

    if (!users || users.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No hay usuarios registrados.</div>';
        return;
    }

    let html = `<div class="user-cards-grid">`;

    users.forEach(user => {
        let roleIcon = '';
        const role = user.rol.toUpperCase();

        if (role === 'ADMIN') {
            roleIcon = '<i class="fa-solid fa-user-shield"></i>';
        } else if (role === 'MODERATOR') {
            roleIcon = '<i class="fa-solid fa-user-gear"></i>';
        } else if (role === 'USER' || role === 'DELIVERY') {
            roleIcon = '<i class="fa-solid fa-user"></i>';
        } else if (role === 'GUEST') {
            roleIcon = '<i class="fa-solid fa-user-secret"></i>';
        } else {
            roleIcon = '<i class="fa-solid fa-user"></i>';
        }

        html += `
        <div class="user-card">
            <div class="user-card-header">
                <div class="user-info-primary">
                    <span class="user-name-title">${user.nombre}</span>
                    <span class="user-id-subtitle"><i class="fas fa-id-card"></i> ${user.id}</span>
                </div>
                <div class="user-role-container">
                    <span class="role-badge role-${user.rol.toLowerCase()}">
                        ${roleIcon} ${user.rol}
                    </span>
                </div>
            </div>
            <div class="user-card-body">
                <div class="user-detail-item">
                    <i class="fas fa-envelope"></i> <span>${user.email || 'No email registrado'}</span>
                </div>
                ${user.phone ? `<div class="user-detail-item"><i class="fas fa-phone"></i> <span>${user.phone}</span></div>` : ''}
            </div>
            <div class="user-card-footer">
                <button class="action-btn edit-btn" onclick="editUser('${user.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteUser('${user.id}', '${user.nombre}')" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
        `;
    });

    html += '</div>';
    listContainer.innerHTML = html;

    // Guardar usuarios en memoria para edición
    window.currentUsersList = users;
}

function openCreateUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userFormTitle').textContent = "Nuevo Usuario";
    document.getElementById('userId').readOnly = false;
    document.getElementById('userModalOverlay').style.display = 'flex';
}

function editUser(userId) {
    const user = window.currentUsersList.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userId').value = user.id;
    document.getElementById('userId').readOnly = true; // No permitir cambiar ID al editar
    document.getElementById('userName').value = user.nombre;
    document.getElementById('userRole').value = user.rol;
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userPassword').value = user.password; // Mostrar contraseña actual (seguridad baja pero solicitado)

    document.getElementById('userFormTitle').textContent = "Editar Usuario";
    document.getElementById('userModalOverlay').style.display = 'flex';
}

function closeUserFormModal() {
    document.getElementById('userModalOverlay').style.display = 'none';
}

async function saveUser(e) {
    e.preventDefault();

    const saveBtn = document.getElementById('saveUserBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    const userData = {
        id: document.getElementById('userId').value.trim(),
        nombre: document.getElementById('userName').value.trim(),
        rol: document.getElementById('userRole').value,
        email: document.getElementById('userEmail').value.trim(),
        phone: document.getElementById('userPhone').value.trim(),
        password: document.getElementById('userPassword').value.trim()
    };

    try {
        const formData = new FormData();
        formData.append('action', 'saveUser');
        formData.append('userData', JSON.stringify(userData));
        formData.append('token', sessionStorage.getItem('token') || '');

        const response = await fetch(API_URL_POST, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert("Usuario guardado correctamente");
            closeUserFormModal();
            loadUsersList();
        } else {
            alert("Error: " + result.message);
        }

    } catch (error) {
        console.error("Error guardando usuario:", error);
        alert("Error de conexión");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function deleteUser(userId, userName) {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${userName}?`)) return;

    try {
        const formData = new FormData();
        formData.append('action', 'deleteUser');
        formData.append('id', userId);
        formData.append('token', sessionStorage.getItem('token') || '');

        const response = await fetch(API_URL_POST, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            loadUsersList();
        } else {
            alert("Error al eliminar: " + result.message);
        }

    } catch (error) {
        console.error("Error eliminando usuario:", error);
        alert("Error de conexión");
    }
}

// Inicialización de Listeners
document.addEventListener('DOMContentLoaded', () => {
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', saveUser);
});

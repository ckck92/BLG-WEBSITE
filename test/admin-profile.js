import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    setupBackButton();
    await loadUserProfile();
    setupProfileToggle();
    setupEditModal();
});

function setupBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
}

async function loadUserProfile() {
    try {
        // Get current authenticated user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        // Get user profile from tbl_users
        const { data: profile, error: profileError } = await supabase
            .from('tbl_users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profileError) throw profileError;

        currentUser = profile;
        displayUserProfile(profile);

    } catch (error) {
        console.error('Error loading user profile:', error);
        displayError();
    }
}

function displayUserProfile(user) {
    // Update greeting
    const greeting = document.querySelector('.user-greeting');
    if (greeting) {
        greeting.textContent = `Hi, ${user.first_name}!`;
    }

    // Update profile details
    const detailsContainer = document.getElementById('details');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="info-group">
                <span class="label">Email</span>
                <span class="value">${user.email || 'N/A'}</span>
            </div>
            <div class="info-group">
                <span class="label">Birth Date</span>
                <span class="value">${formatDate(user.birth_date) || 'N/A'}</span>
            </div>
            <div class="info-group">
                <span class="label">Contact Number</span>
                <span class="value">${user.contact_number || 'N/A'}</span>
            </div>
        `;
    }

    // Re-setup edit modal button
    setupEditModal();
}

function displayError() {
    const detailsContainer = document.getElementById('details');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <p style="text-align: center; color: #ef4444; padding: 20px;">
                Error loading profile. Please try again later.
            </p>
        `;
    }
}

function formatDate(dateString) {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
}

function setupProfileToggle() {
    const profileHeader = document.getElementById('profileHeader');
    const detailsContent = document.getElementById('details');
    const arrow = document.getElementById('arrow');

    if (profileHeader && detailsContent && arrow) {
        profileHeader.addEventListener('click', () => {
            const isOpen = detailsContent.style.display !== 'none';
            
            if (isOpen) {
                detailsContent.style.display = 'none';
                arrow.textContent = '▼';
            } else {
                detailsContent.style.display = 'block';
                arrow.textContent = '▲';
            }
        });
    }
}

function setupEditModal() {
    const openModalBtn = document.getElementById('openEditModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const editForm = document.getElementById('editForm');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            if (modalOverlay && currentUser) {
                // Populate form with current data
                populateEditForm();
                modalOverlay.style.display = 'flex';
            }
        });
    }

    if (closeModalBtn && modalOverlay) {
        closeModalBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateProfile();
        });
    }
}

function populateEditForm() {
    const form = document.getElementById('editForm');
    if (!form || !currentUser) return;

    const inputs = form.querySelectorAll('input');
    if (inputs.length >= 5) {
        inputs[0].value = `${currentUser.first_name} ${currentUser.last_name}`.trim();
        inputs[1].value = currentUser.email || '';
        inputs[2].value = formatDate(currentUser.birth_date) || '';
        inputs[4].value = currentUser.contact_number || '';
    }
}

async function updateProfile() {
    const form = document.getElementById('editForm');
    if (!form || !currentUser) return;

    const inputs = form.querySelectorAll('input');
    
    // Parse full name
    const fullName = inputs[0].value.trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || currentUser.first_name;
    const lastName = nameParts.slice(1).join(' ') || currentUser.last_name;

    const updates = {
        first_name: firstName,
        last_name: lastName,
        email: inputs[1].value.trim(),
        birth_date: parseDateString(inputs[2].value),
        contact_number: inputs[4].value.trim()
    };

    try {
        const { error } = await supabase
            .from('tbl_users')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) throw error;

        alert('Profile updated successfully!');
        
        // Reload profile
        await loadUserProfile();
        
        // Close modal
        document.getElementById('modalOverlay').style.display = 'none';

    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

function parseDateString(dateStr) {
    if (!dateStr) return null;
    
    // Expecting format: MM/DD/YYYY
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    
    // Return in YYYY-MM-DD format
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
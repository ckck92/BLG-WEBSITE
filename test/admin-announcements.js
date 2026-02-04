import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
});

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (profile.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    currentUser = profile;
    document.getElementById('userName').textContent = `Hi, ${currentUser.first_name}`;
}

window.createAnnouncement = async function(audience) {
    const textareaId = audience === 'general' ? 'generalMsg' : audience === 'client' ? 'clientMsg' : 'barberMsg';
    const textarea = document.getElementById(textareaId);
    const message = textarea.value.trim();

    if (!message) {
        alert('Please enter a message');
        return;
    }

    const { error } = await supabase
        .from('tbl_announcements')
        .insert({
            title: `${audience.charAt(0).toUpperCase() + audience.slice(1)} Announcement`,
            message: message,
            audience: audience,
            is_active: true
        });

    if (error) {
        alert('Failed to create announcement: ' + error.message);
        return;
    }

    alert('Announcement created successfully!');
    textarea.value = '';
};

function setupDropdown() {
    const userIcon = document.getElementById('userIcon');
    const dropdown = document.getElementById('userDropdown');

    userIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
            dropdown.classList.remove('show');
        }
    });
}

function setupSignOut() {
    document.getElementById('signOutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
}
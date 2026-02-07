import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    loadRecentAnnouncements();
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

window.createAnnouncement = async function() {
    const title = document.getElementById('announcementTitle').value.trim();
    const message = document.getElementById('announcementMessage').value.trim();

    if (!title || !message) {
        alert('Please fill in both title and message');
        return;
    }

    try {
        const { error } = await supabase
            .from('tbl_announcements')
            .insert({
                title: title,
                message: message,
                audience: 'client',
                is_active: true
            });

        if (error) throw error;

        alert('Announcement posted successfully!');
        document.getElementById('announcementTitle').value = '';
        document.getElementById('announcementMessage').value = '';
        loadRecentAnnouncements();

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create announcement: ' + error.message);
    }
};

async function loadRecentAnnouncements() {
    const { data: announcements, error } = await supabase
        .from('tbl_announcements')
        .select('*')
        .eq('audience', 'client')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error loading announcements:', error);
        return;
    }

    displayAnnouncements(announcements);
}

function displayAnnouncements(announcements) {
    const container = document.getElementById('recentAnnouncementsList');
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No announcements yet</p>';
        return;
    }

    container.innerHTML = announcements.map(ann => {
        const date = new Date(ann.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        return `
            <div class="announcement-card ${ann.is_active ? 'active' : 'inactive'}">
                <div class="announcement-header">
                    <h3>${ann.title}</h3>
                    <button class="btn-toggle" onclick="toggleAnnouncement(${ann.id}, ${ann.is_active})">
                        ${ann.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
                <p>${ann.message}</p>
                <div class="announcement-meta">
                    <span class="date">${date}</span>
                    <span class="status-badge ${ann.is_active ? 'active' : 'inactive'}">
                        ${ann.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleAnnouncement = async function(announcementId, currentStatus) {
    try {
        const { error } = await supabase
            .from('tbl_announcements')
            .update({ is_active: !currentStatus })
            .eq('id', announcementId);

        if (error) throw error;

        loadRecentAnnouncements();
    } catch (error) {
        alert('Failed to update: ' + error.message);
    }
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
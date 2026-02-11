import { supabase } from './supabaseclient.js';

let currentUser = null;
let allAnnouncements = [];
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadAnnouncements();
    setupForm();
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
        alert('Access denied. Admin only.');
        window.location.href = 'dashboard.html';
        return;
    }

    currentUser = profile;
    document.getElementById('userName').textContent = `Hi, ${currentUser.first_name}`;
    console.log('Admin authenticated:', currentUser.first_name);
}

async function loadAnnouncements() {
    try {
        const { data: announcements, error } = await supabase
            .from('tbl_announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allAnnouncements = announcements || [];
        console.log('Loaded announcements:', allAnnouncements.length);
        displayCurrentPage();

    } catch (error) {
        console.error('Error loading announcements:', error);
        const tbody = document.getElementById('announcementsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 40px; color: #ef4444;">
                    Error loading announcements: ${error.message}
                </td>
            </tr>
        `;
    }
}

function displayCurrentPage() {
    const tbody = document.getElementById('announcementsTableBody');
    
    if (allAnnouncements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 40px; color: #999;">
                    No announcements yet. Create your first one above!
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(allAnnouncements.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allAnnouncements.length);
    const pageData = allAnnouncements.slice(startIndex, endIndex);

    // Render table rows
    tbody.innerHTML = pageData.map(announcement => {
        const createdDate = new Date(announcement.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Generate a title from the first few words of the message if no title
        const displayTitle = announcement.title || 
            announcement.message.substring(0, 50) + (announcement.message.length > 50 ? '...' : '');

        return `
            <tr>
                <td><strong>${displayTitle}</strong></td>
                <td>${announcement.message}</td>
                <td>${createdDate}</td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(allAnnouncements.length / itemsPerPage) || 1;
    const pageInfo = document.getElementById('pageInfo');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    }
}

window.changePage = function(direction) {
    const totalPages = Math.ceil(allAnnouncements.length / itemsPerPage) || 1;
    
    switch(direction) {
        case 'first':
            currentPage = 1;
            break;
        case 'prev':
            if (currentPage > 1) currentPage--;
            break;
        case 'next':
            if (currentPage < totalPages) currentPage++;
            break;
        case 'last':
            currentPage = totalPages;
            break;
    }
    
    displayCurrentPage();
};

function setupForm() {
    const form = document.getElementById('announcementForm');
    
    if (!form) {
        console.error('Form not found');
        return;
    }
    
    console.log('Form found, setting up submit handler');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('🚀 Form submitted');
        
        const messageInput = document.getElementById('announcementMessage');
        const message = messageInput.value.trim();
        
        console.log('📝 Message:', message);

        // Validation
        if (!message) {
            alert('Please enter a message');
            return;
        }
        
        if (message.length < 10) {
            alert('Message must be at least 10 characters long');
            return;
        }
        
        if (message.length > 500) {
            alert('Message is too long (max 500 characters)');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';

        try {
            console.log('📤 Inserting announcement...');
            
            // Generate title from message
            const title = message.substring(0, 50);
            
            const { data, error } = await supabase
                .from('tbl_announcements')
                .insert([{
                    title: title,
                    message: message,
                    is_active: true
                }])
                .select();

            if (error) {
                console.error('Insert error:', error);
                throw error;
            }

            console.log('Announcement posted:', data);

            // Try to log the action (don't fail if logging fails)
            try {
                await supabase.rpc('insert_admin_log', {
                    p_admin_id: currentUser.id,
                    p_action: 'POST_ANNOUNCEMENT',
                    p_target_table: 'tbl_announcements',
                    p_target_id: data[0].id,
                    p_details: { title: title }
                });
            } catch (logError) {
                console.warn('Failed to log action:', logError.message);
            }

            alert('Announcement posted successfully!');
            form.reset();
            await loadAnnouncements();

        } catch (error) {
            console.error('Error posting announcement:', error);
            alert('Failed to post announcement: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-bullhorn"></i> Post Announcement';
        }
    });
}

function setupDropdown() {
    const userIcon = document.getElementById('userIcon');
    const dropdown = document.getElementById('userDropdown');

    if (userIcon && dropdown) {
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
}

function setupSignOut() {
    const signOutLink = document.getElementById('signOutLink');
    if (signOutLink) {
        signOutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }
}
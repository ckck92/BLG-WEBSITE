import { supabase } from './supabaseclient.js';

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 5;
let allLogs = [];
let filteredLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadLogs();
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

async function loadLogs() {
    try {
        const { data: logs, error } = await supabase
            .from('tbl_admin_logs')
            .select(`
                *,
                tbl_users (first_name, last_name, role)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading logs:', error);
            document.getElementById('logsContainer').innerHTML = 
                '<p style="text-align: center; padding: 40px; color: #ef4444;">Error loading logs: ' + error.message + '</p>';
            return;
        }

        allLogs = logs || [];
        filteredLogs = [...allLogs];
        currentPage = 1;
        updatePagination();
        displayCurrentPage();
        
    } catch (error) {
        console.error('Load logs exception:', error);
        document.getElementById('logsContainer').innerHTML = 
            '<p style="text-align: center; padding: 40px; color: #ef4444;">Failed to load logs</p>';
    }
}

window.applyFilters = function() {
    const actionFilter = document.getElementById('actionFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    filteredLogs = allLogs.filter(log => {
        if (actionFilter && log.action !== actionFilter) return false;
        
        if (dateFilter) {
            const logDate = new Date(log.created_at).toISOString().split('T')[0];
            if (logDate !== dateFilter) return false;
        }
        
        return true;
    });

    currentPage = 1;
    updatePagination();
    displayCurrentPage();
};

window.resetFilters = function() {
    document.getElementById('actionFilter').value = '';
    document.getElementById('dateFilter').value = '';
    
    filteredLogs = [...allLogs];
    currentPage = 1;
    updatePagination();
    displayCurrentPage();
};

function updatePagination() {
    totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} / ${totalPages}`;
}

window.changePage = function(direction) {
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
    updatePagination();
};

function displayCurrentPage() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredLogs.slice(start, end);
    
    const container = document.getElementById('logsContainer');
    
    if (pageData.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No logs found</p>';
        return;
    }

    container.innerHTML = pageData.map(log => {
        const actorName = log.tbl_users 
            ? `${log.tbl_users.first_name} ${log.tbl_users.last_name} (${log.tbl_users.role})`
            : 'System';

        const timestamp = new Date(log.created_at);
        const timeStr = timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const { icon, iconClass, actionText, detailsHtml } = formatLogEntry(log);

        return `
            <div class="log-entry">
                <div class="log-header">
                    <div class="log-action">
                        <div class="log-icon ${iconClass}">
                            <i class="fa-solid fa-${icon}"></i>
                        </div>
                        <span>${actionText}</span>
                    </div>
                    <div class="log-time">${timeStr}</div>
                </div>
                <div class="log-actor">By: ${actorName}</div>
                <div class="log-details">${detailsHtml}</div>
            </div>
        `;
    }).join('');
}

function formatLogEntry(log) {
    const details = log.details || {};
    
    switch (log.action) {
        case 'reservation_created':
            return {
                icon: 'calendar-plus',
                iconClass: 'icon-create',
                actionText: 'Reservation Created',
                detailsHtml: `
                    <span class="detail-badge">Recipient: ${details.service_recipient || 'N/A'}</span>
                    <span class="detail-badge">Seat: ${details.seat_id || 'N/A'}</span>
                    <span class="detail-badge">Total: ₱${details.total_price || '0'}</span>
                `
            };
            
        case 'reservation_status_changed':
            const statusColors = {
                pending: '#ffc107',
                accepted: '#4caf50',
                on_hold: '#2196f3',
                ongoing: '#ff9800',
                completed: '#9e9e9e',
                cancelled: '#ef4444'
            };
            return {
                icon: 'arrows-rotate',
                iconClass: 'icon-update',
                actionText: 'Reservation Status Updated',
                detailsHtml: `
                    <span class="detail-badge">Recipient: ${details.service_recipient || 'N/A'}</span>
                    <span class="detail-badge" style="background: ${statusColors[details.old_status] || '#999'}; color: white;">
                        Old: ${details.old_status || 'N/A'}
                    </span>
                    <span class="detail-badge" style="background: ${statusColors[details.new_status] || '#999'}; color: white;">
                        New: ${details.new_status || 'N/A'}
                    </span>
                `
            };
            
        case 'barber_created':
            return {
                icon: 'user-plus',
                iconClass: 'icon-create',
                actionText: 'New Barber Account Created',
                detailsHtml: `
                    <span class="detail-badge">Barber ID: ${details.barber_id || 'N/A'}</span>
                    <span class="detail-badge">Experience: ${details.years_of_experience || 'N/A'} years</span>
                `
            };
            
        case 'announcement_created':
            return {
                icon: 'bullhorn',
                iconClass: 'icon-create',
                actionText: 'Announcement Posted',
                detailsHtml: `
                    <span class="detail-badge">Title: ${details.title || 'N/A'}</span>
                    <span class="detail-badge">Audience: ${details.audience || 'N/A'}</span>
                `
            };
            
        default:
            return {
                icon: 'circle-info',
                iconClass: 'icon-update',
                actionText: log.action.replace(/_/g, ' ').toUpperCase(),
                detailsHtml: `<span class="detail-badge">Action performed</span>`
            };
    }
}

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
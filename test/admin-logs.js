import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    loadLogs();
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

window.loadLogs = async function() {
    const actionFilter = document.getElementById('actionFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    let query = supabase
        .from('tbl_admin_logs')
        .select(`
            *,
            tbl_users (first_name, last_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

    if (actionFilter) {
        query = query.eq('action', actionFilter);
    }

    if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());
    }

    const { data: logs, error } = await query;

    if (error) {
        console.error('Error loading logs:', error);
        return;
    }

    displayLogs(logs);
};

function displayLogs(logs) {
    const container = document.getElementById('logsContainer');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No logs found</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
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
                        ${actionText}
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
                    <span class="detail-badge">Recipient: ${details.service_recipient}</span>
                    <span class="detail-badge">Seat: ${details.seat_id}</span>
                    <span class="detail-badge">Total: ₱${details.total_price}</span>
                `
            };
            
        case 'reservation_status_changed':
            const statusColors = {
                pending: '#ffc107',
                accepted: '#4caf50',
                on_hold: '#2196f3',
                ongoing: '#ff9800',
                completed: '#9e9e9e'
            };
            return {
                icon: 'arrows-rotate',
                iconClass: 'icon-update',
                actionText: 'Reservation Status Updated',
                detailsHtml: `
                    <span class="detail-badge">Recipient: ${details.service_recipient}</span>
                    <span class="detail-badge" style="background: ${statusColors[details.old_status]}; color: white;">
                        Old: ${details.old_status}
                    </span>
                    <span class="detail-badge" style="background: ${statusColors[details.new_status]}; color: white;">
                        New: ${details.new_status}
                    </span>
                    <span class="detail-badge">Seat: ${details.seat_id}</span>
                `
            };
            
        case 'barber_created':
            return {
                icon: 'user-plus',
                iconClass: 'icon-create',
                actionText: 'New Barber Account Created',
                detailsHtml: `
                    <span class="detail-badge">Barber ID: ${details.barber_id}</span>
                    <span class="detail-badge">Experience: ${details.years_of_experience} years</span>
                `
            };
            
        case 'announcement_created':
            return {
                icon: 'bullhorn',
                iconClass: 'icon-create',
                actionText: 'Announcement Posted',
                detailsHtml: `
                    <span class="detail-badge">Title: ${details.title}</span>
                    <span class="detail-badge">Audience: ${details.audience}</span>
                    <span class="detail-badge">${details.is_active ? 'Active' : 'Inactive'}</span>
                `
            };
            
        default:
            return {
                icon: 'circle-info',
                iconClass: 'icon-update',
                actionText: log.action.replace(/_/g, ' ').toUpperCase(),
                detailsHtml: `<pre>${JSON.stringify(details, null, 2)}</pre>`
            };
    }
}

window.resetFilters = function() {
    document.getElementById('actionFilter').value = '';
    document.getElementById('dateFilter').value = '';
    loadLogs();
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
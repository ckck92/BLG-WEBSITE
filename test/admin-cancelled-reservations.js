import { supabase } from './supabaseclient.js';

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 5;
let allCancelled = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadCancelledReservations();
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

async function loadCancelledReservations() {
    const { data: reservations, error } = await supabase
        .from('tbl_reservations')
        .select(`
            id,
            service_recipient,
            user_id,
            seat_id,
            barber_id,
            reserved_date,
            reserved_time,
            reserved_datetime,
            status,
            total_price,
            cancellation_reason,
            cancelled_by,
            tbl_users!tbl_reservations_user_id_fkey (first_name, last_name),
            tbl_barbers!tbl_reservations_barber_id_fkey (
                user_id,
                tbl_users (first_name, last_name)
            ),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .eq('status', 'cancelled')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error loading cancelled reservations:', error);
        return;
    }

    allCancelled = reservations || [];
    updatePagination();
    displayCurrentPage();
}

function updatePagination() {
    totalPages = Math.ceil(allCancelled.length / itemsPerPage) || 1;
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
    const pageData = allCancelled.slice(start, end);
    
    const tbody = document.querySelector('#cancelledTable tbody');
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No cancelled reservations</td></tr>';
        return;
    }

    tbody.innerHTML = pageData.map(res => {
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        const clientName = res.tbl_users 
            ? `${res.tbl_users.first_name} ${res.tbl_users.last_name}`
            : 'Unknown User';

        const barberName = res.tbl_barbers?.tbl_users
            ? `${res.tbl_barbers.tbl_users.first_name} ${res.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';

        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
            
        const dateStr = dateTime.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Determine who cancelled - check if cancelled_by matches user_id
        const cancelledBy = res.cancelled_by === res.user_id ? 'Client' : 'Admin';

        return `
            <tr>
                <td><strong>${res.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td>${barberName}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${res.total_price}</strong></td>
                <td>${dateStr}<br><small style="color: #666;">${timeStr}</small></td>
                <td style="max-width: 200px;">${res.cancellation_reason || 'No reason provided'}</td>
                <td><strong style="color: ${cancelledBy === 'Admin' ? '#ef4444' : '#ff9800'};">${cancelledBy}</strong></td>
            </tr>
        `;
    }).join('');
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
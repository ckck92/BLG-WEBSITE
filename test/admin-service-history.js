import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    loadServiceHistory();
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

async function loadServiceHistory() {
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
            completed_at,
            status,
            total_price,
            tbl_users!tbl_reservations_user_id_fkey (first_name, last_name),
            tbl_seats (seat_number),
            tbl_barbers!tbl_reservations_barber_id_fkey (
                user_id,
                tbl_users (first_name, last_name)
            ),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

    if (error) {
        console.error('Error loading history:', error);
        return;
    }

    const tbody = document.querySelector('#historyTable tbody');
    
    if (!reservations || reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No completed services yet</td></tr>';
        return;
    }

    tbody.innerHTML = reservations.map(res => {
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        const dateTime = res.completed_at 
            ? new Date(res.completed_at) 
            : (res.reserved_datetime 
                ? new Date(res.reserved_datetime) 
                : new Date(`${res.reserved_date}T${res.reserved_time}`));
            
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

        const clientName = res.tbl_users 
            ? `${res.tbl_users.first_name} ${res.tbl_users.last_name}`
            : 'Unknown User';

        const barberName = res.tbl_barbers?.tbl_users
            ? `${res.tbl_barbers.tbl_users.first_name} ${res.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';

        return `
            <tr>
                <td><strong>${res.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td>Seat ${res.tbl_seats.seat_number}</td>
                <td><strong>${barberName}</strong></td>
                <td>${serviceDetails}</td>
                <td><strong>₱${res.total_price}</strong></td>
                <td>${dateStr}<br><small style="color: #666;">${timeStr}</small></td>
                <td>
                    <span class="status-badge status-completed">
                        <i class="fa-solid fa-circle-check"></i> Complete
                    </span>
                </td>
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
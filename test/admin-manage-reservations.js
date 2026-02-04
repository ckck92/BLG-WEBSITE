import { supabase } from './supabaseclient.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    loadReservations();
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

async function loadReservations() {
    const { data: reservations, error } = await supabase
        .from('tbl_reservations')
        .select(`
            id,
            service_recipient,
            user_id,
            seat_id,
            reserved_date,
            reserved_time,
            reserved_datetime,
            status,
            total_price,
            tbl_users!tbl_reservations_user_id_fkey (first_name, last_name),
            tbl_seats (seat_number),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .in('status', ['pending', 'accepted', 'on_hold', 'ongoing'])
        .order('reserved_datetime', { ascending: true });

    if (error) {
        console.error('Error loading reservations:', error);
        return;
    }

    const tbody = document.querySelector('#reservationsTable tbody');
    
    if (!reservations || reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #999;">No pending reservations</td></tr>';
        return;
    }

    tbody.innerHTML = reservations.map(res => {
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

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

        const clientName = res.tbl_users 
            ? `${res.tbl_users.first_name} ${res.tbl_users.last_name}`
            : 'Unknown User';

        return `
            <tr>
                <td><strong>${res.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td>Seat ${res.tbl_seats.seat_number}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${res.total_price}</strong></td>
                <td>${dateStr}<br><small style="color: #666;">${timeStr}</small></td>
                <td>
                    <select 
                        class="status-dropdown status-${res.status}" 
                        onchange="updateReservationStatus(${res.id}, this.value, this)"
                        data-current-status="${res.status}">
                        <option value="pending" ${res.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="accepted" ${res.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                        <option value="on_hold" ${res.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        <option value="ongoing" ${res.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                        <option value="completed" ${res.status === 'completed' ? 'selected' : ''}>Complete</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

window.updateReservationStatus = async function(reservationId, newStatus, selectElement) {
    const oldStatus = selectElement.dataset.currentStatus;
    
    // Prevent accidental changes with confirmation for Complete
    if (newStatus === 'completed') {
        if (!confirm('Mark this reservation as Complete? It will be moved to Service History.')) {
            selectElement.value = oldStatus; // Revert
            return;
        }
    }

    try {
        const updateData = { status: newStatus };
        
        // If completing, set completed timestamp
        if (newStatus === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const { error } = await supabase
            .from('tbl_reservations')
            .update(updateData)
            .eq('id', reservationId);

        if (error) throw error;

        // Update dropdown styling
        selectElement.className = `status-dropdown status-${newStatus}`;
        selectElement.dataset.currentStatus = newStatus;

        // If completed, remove from list
        if (newStatus === 'completed') {
            selectElement.closest('tr').style.opacity = '0.5';
            setTimeout(() => {
                loadReservations(); // Refresh list
                alert('Reservation moved to Service History');
            }, 500);
        } else {
            alert(`Status updated to: ${newStatus}`);
        }

    } catch (error) {
        alert('Failed to update: ' + error.message);
        selectElement.value = oldStatus; // Revert on error
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
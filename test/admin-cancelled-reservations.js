import { supabase } from './supabaseclient.js';

let currentUser = null;
let allReservations = [];
let filteredReservations = [];
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    await loadCancelledReservations();
    await autoCancelPassedRescheduled();

    setupDropdown();
    setupSignOut();
    setupFilters(); // setup filters AFTER loading data

    // runs auto-cancel every 5 mins
    setInterval(autoCancelPassedRescheduled, 5 * 60 * 1000);
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
            cancelled_at,
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
        .order('cancelled_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error loading cancelled reservations:', error);
        return;
    }

    allReservations = reservations || [];
    filteredReservations = [...allReservations]; // Initialize filtered data
    displayCurrentPage();
}

async function autoCancelPassedRescheduled() {
    try {
        const now = new Date();
        
        // Get all 'accepted' reservations with reserved_datetime in the past
        const { data: passedReservations, error } = await supabase
            .from('tbl_reservations')
            .select('id, reserved_datetime, service_recipient')
            .eq('status', 'accepted')
            .lt('reserved_datetime', now.toISOString());

        if (error) throw error;

        if (!passedReservations || passedReservations.length === 0) {
            console.log('No passed rescheduled reservations to cancel');
            return;
        }

        console.log(`Found ${passedReservations.length} passed reservations to cancel`);

        // Cancel each passed reservation
        for (const reservation of passedReservations) {
            await supabase
                .from('tbl_reservations')
                .update({
                    status: 'cancelled',
                    cancellation_reason: 'Time passed (system)',
                    cancelled_by: 'system',
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', reservation.id);

            // Log the auto-cancellation
            await supabase.from('tbl_admin_logs').insert({
                admin_id: null, // System action
                action: 'reservation_cancelled',
                target_table: 'tbl_reservations',
                target_id: reservation.id,
                details: {
                    service_recipient: reservation.service_recipient,
                    reason: 'Time passed (system)',
                    cancelled_by: 'system',
                    auto_cancelled: true
                }
            });

            console.log(`Auto-cancelled reservation ${reservation.id}`);
        }

        // Reload the reservations table after auto-cancellation
        await loadReservations();

    } catch (error) {
        console.error('Error auto-cancelling passed reservations:', error);
    }
}

function setupFilters() {
    const reservedByFilter = document.getElementById('filterReservedBy');
    const cancelledWhenFilter = document.getElementById('filterCancelledWhen');
    const resetBtn = document.getElementById('resetFilters');

    // Auto-filter on input change
    if (reservedByFilter) {
        reservedByFilter.addEventListener('input', applyFilters);
    }

    if (cancelledWhenFilter) {
        cancelledWhenFilter.addEventListener('change', applyFilters);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
}

function applyFilters() {
    const reservedByValue = document.getElementById('filterReservedBy')?.value.toLowerCase().trim() || '';
    const cancelledWhenValue = document.getElementById('filterCancelledWhen')?.value || '';

    filteredReservations = allReservations.filter(res => {
        // Filter by Reserved By (client name)
        const clientName = res.tbl_users 
            ? `${res.tbl_users.first_name} ${res.tbl_users.last_name}`.toLowerCase()
            : '';
        const reservedByMatch = !reservedByValue || clientName.includes(reservedByValue);

        // Filter by Cancelled When (date)
        let cancelledWhenMatch = true;
        if (cancelledWhenValue && res.cancelled_at) {
            const cancelledDate = new Date(res.cancelled_at).toISOString().split('T')[0];
            cancelledWhenMatch = cancelledDate === cancelledWhenValue;
        } else if (cancelledWhenValue && !res.cancelled_at) {
            cancelledWhenMatch = false;
        }

        return reservedByMatch && cancelledWhenMatch;
    });

    currentPage = 1;
    displayCurrentPage();
}

function resetFilters() {
    document.getElementById('filterReservedBy').value = '';
    document.getElementById('filterCancelledWhen').value = '';
    
    filteredReservations = [...allReservations];
    currentPage = 1;
    displayCurrentPage();
}

function displayCurrentPage() {
    const tbody = document.querySelector('#cancelledTable tbody');
    
    if (filteredReservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No cancelled reservations found</td></tr>';
        updatePagination();
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReservations.length);
    const pageData = filteredReservations.slice(startIndex, endIndex);

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

        // FIXED: Cancelled By (who cancelled - client or admin or system)
        let cancelledBy = 'N/A';
        if (res.cancelled_by) {
            if (res.cancelled_by === 'system') {
                cancelledBy = 'System';
            } else if (res.cancelled_by === res.user_id) {
                cancelledBy = 'Client';
            } else {
                cancelledBy = 'Admin';
            }
        }

        // FIXED: Cancellation Reason (the actual reason)
        const cancellationReason = res.cancellation_reason || 'No reason provided';

        return `
            <tr>
                <td><strong>${res.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td>${barberName}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${res.total_price}</strong></td>
                <td>
                    ${dateStr}<br>
                    <small style="color: #666;">${timeStr}</small>
                </td>
                <td>${cancellationReason}</td>
                <td><strong>${cancelledBy}</strong></td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredReservations.length / itemsPerPage) || 1;
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    }
}

window.changePage = function(direction) {
    const totalPages = Math.ceil(filteredReservations.length / itemsPerPage) || 1;
    
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

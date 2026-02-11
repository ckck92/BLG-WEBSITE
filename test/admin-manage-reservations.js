import { supabase } from './supabaseclient.js';

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 5;
let allReservations = [];
let filteredReservations = [];
let countdownIntervals = []; // Store interval IDs for cleanup

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadReservations();
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
            barber_id,
            reserved_date,
            reserved_time,
            reserved_datetime,
            status,
            is_rescheduled,
            total_price,
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
        .in('status', ['pending', 'accepted', 'on_hold', 'ongoing'])
        .order('reserved_datetime', { ascending: true });

    if (error) {
        console.error('Error loading reservations:', error);
        return;
    }

    allReservations = reservations || [];
    filteredReservations = [...allReservations];
    updatePagination();
    displayCurrentPage();
}

window.filterByStatus = function(status) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (status === 'all') {
        filteredReservations = [...allReservations];
    } else {
        filteredReservations = allReservations.filter(r => r.status === status);
    }
    
    currentPage = 1;
    updatePagination();
    displayCurrentPage();
};

function updatePagination() {
    totalPages = Math.ceil(filteredReservations.length / itemsPerPage) || 1;
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
    // Clear existing countdown intervals
    countdownIntervals.forEach(interval => clearInterval(interval));
    countdownIntervals = [];

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredReservations.slice(start, end);
    
    const tbody = document.querySelector('#reservationsTable tbody');
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No reservations found</td></tr>';
        return;
    }

    tbody.innerHTML = pageData.map((res, index) => {
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

        // Create unique ID for countdown
        const countdownId = `admin-countdown-${index}`;

        // On Hold warning
        const onHoldWarning = res.status === 'on_hold' 
            ? '<div class="on-hold-warning"><i class="fa-solid fa-exclamation-triangle"></i> Reach out to client for possible reschedule</div>'
            : '';

        // Reschedule button only for On Hold status
        const rescheduleBtn = res.status === 'on_hold'
            ? `<button class="btn-reschedule" onclick="openRescheduleModal(${res.id}, '${res.service_recipient}', '${dateStr}', '${timeStr}', '${res.user_id}')" title="Reschedule Appointment">
                <i class="fa-solid fa-calendar-days"></i>
               </button>`
            : '';

        // Status display - show "Accepted (Rescheduled)" if rescheduled
        const statusLabel = res.is_rescheduled && res.status === 'accepted'
            ? 'Accepted (Rescheduled)'
            : res.status.replace('_', ' ');

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
                    ${onHoldWarning}
                </td>
                <td>
                    <div id="${countdownId}" class="time-left-cell">Calculating...</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <select 
                            class="status-dropdown status-${res.status}" 
                            onchange="updateReservationStatus(${res.id}, this.value, this, '${res.user_id}')"
                            data-current-status="${res.status}"
                            ${res.is_rescheduled && res.status === 'accepted' ? 'disabled' : ''}>
                            <option value="pending" ${res.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="accepted" ${res.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="on_hold" ${res.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                            <option value="ongoing" ${res.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                            <option value="completed" ${res.status === 'completed' ? 'selected' : ''}>Complete</option>
                            <option value="cancelled">Cancel</option>
                        </select>
                        ${rescheduleBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Start countdown timers for each reservation
    pageData.forEach((res, index) => {
        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
        
        const countdownId = `admin-countdown-${index}`;
        startCountdown(countdownId, dateTime);
    });
}

function startCountdown(elementId, targetDateTime) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Update immediately
    updateCountdown(element, targetDateTime);

    // Then update every second
    const interval = setInterval(() => {
        updateCountdown(element, targetDateTime);
    }, 1000);

    // Store interval ID for cleanup
    countdownIntervals.push(interval);
}

function updateCountdown(element, targetDateTime) {
    const now = new Date();
    const diff = targetDateTime - now;

    if (diff <= 0) {
        element.textContent = 'Time passed';
        element.style.color = '#ef4444';
        element.style.fontWeight = '700';
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Format as HH:MM:SS
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    element.textContent = formattedTime;

    // Color coding based on time remaining
    if (hours === 0 && minutes < 30) {
        element.style.color = '#ef4444'; // Red - less than 30 minutes
        element.style.fontWeight = '700';
    } else if (hours < 2) {
        element.style.color = '#f59e0b'; // Orange - less than 2 hours
        element.style.fontWeight = '700';
    } else {
        element.style.color = '#10b981'; // Green - plenty of time
        element.style.fontWeight = '600';
    }
}

window.updateReservationStatus = async function(reservationId, newStatus, selectElement, userId) {
    const oldStatus = selectElement.dataset.currentStatus;
    
    if (newStatus === 'completed') {
        if (!confirm('Mark this reservation as Complete? It will be moved to Service History.')) {
            selectElement.value = oldStatus;
            return;
        }
    }
    
    if (newStatus === 'cancelled') {
        const reason = prompt('Reason for cancellation:');
        if (!reason) {
            selectElement.value = oldStatus;
            return;
        }
        
        try {
            const { error } = await supabase
                .from('tbl_reservations')
                .update({ 
                    status: 'cancelled',
                    cancellation_reason: reason,
                    cancelled_by: currentUser.id
                })
                .eq('id', reservationId);

            if (error) throw error;

            // Create notification for client
            await supabase.from('tbl_notifications').insert({
                user_id: userId,
                message: `Your reservation has been cancelled. Reason: ${reason}`,
                type: 'reservation_cancelled'
            });

            alert('Reservation cancelled. Client will be notified.');
            await loadReservations();
        } catch (error) {
            console.error('Cancel error:', error);
            alert('Failed to cancel: ' + error.message);
            selectElement.value = oldStatus;
        }
        return;
    }

    try {
        const updateData = { status: newStatus };
        
        if (newStatus === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const { error } = await supabase
            .from('tbl_reservations')
            .update(updateData)
            .eq('id', reservationId);

        if (error) throw error;

        if (newStatus === 'completed') {
            alert('Reservation moved to Service History');
            await loadReservations();
        } else {
            selectElement.className = `status-dropdown status-${newStatus}`;
            selectElement.dataset.currentStatus = newStatus;
            alert(`Status updated to: ${newStatus}`);
            await loadReservations();
        }

    } catch (error) {
        alert('Failed to update: ' + error.message);
        selectElement.value = oldStatus;
    }
};

window.openRescheduleModal = function(reservationId, recipient, oldDate, oldTime, userId) {
    const modal = document.createElement('div');
    modal.id = 'rescheduleModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Reschedule Reservation</h2>
                <button class="btn-close" onclick="closeRescheduleModal()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p><strong>Service Recipient:</strong> ${recipient}</p>
                <p><strong>Current:</strong> ${oldDate}, ${oldTime}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
                <div class="form-group">
                    <label>New Date *</label>
                    <input type="date" id="newDate" class="form-input" required>
                </div>
                <div class="form-group">
                    <label>New Time *</label>
                    <input type="time" id="newTime" class="form-input" required>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-confirm" onclick="confirmReschedule(${reservationId}, '${userId}')">
                    <i class="fa-solid fa-check"></i> Confirm Reschedule
                </button>
                <button class="btn-cancel-modal" onclick="closeRescheduleModal()">
                    <i class="fa-solid fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

window.closeRescheduleModal = function() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) modal.remove();
};

window.confirmReschedule = async function(reservationId, userId) {
    const newDate = document.getElementById('newDate').value;
    const newTime = document.getElementById('newTime').value;
    
    if (!newDate || !newTime) {
        alert('Please select both date and time');
        return;
    }
    
    try {
        const newDateTime = new Date(`${newDate}T${newTime}`).toISOString();
        
        const { error } = await supabase
            .from('tbl_reservations')
            .update({
                reserved_date: newDate,
                reserved_time: newTime,
                reserved_datetime: newDateTime,
                status: 'accepted',
                is_rescheduled: true,
                rescheduled_at: new Date().toISOString(),
                rescheduled_by: currentUser.id
            })
            .eq('id', reservationId);

        if (error) throw error;

        // Create notification for client
        const dateStr = new Date(`${newDate}T${newTime}`).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = new Date(`${newDate}T${newTime}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        await supabase.from('tbl_notifications').insert({
            user_id: userId,
            message: `Your reservation has been rescheduled to ${dateStr} at ${timeStr}`,
            type: 'reservation_rescheduled'
        });

        alert('Reservation rescheduled successfully! Client will be notified.');
        closeRescheduleModal();
        await loadReservations();

    } catch (error) {
        console.error('Reschedule error:', error);
        alert('Failed to reschedule: ' + error.message);
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
        
        // Clear countdown intervals
        countdownIntervals.forEach(interval => clearInterval(interval));
        countdownIntervals = [];
        
        await supabase.auth.signOut();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
}

// Cleanup intervals when page unloads
window.addEventListener('beforeunload', () => {
    countdownIntervals.forEach(interval => clearInterval(interval));
});
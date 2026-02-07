import { supabase } from './supabaseclient.js';

let currentUser = null;
let selectedReservationId = null;
let countdownIntervals = []; // Store interval IDs for cleanup

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
    loadReservations();
});

async function checkAuth() {
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
    
    currentUser = profile;
    document.getElementById('userName').textContent = `Hi, ${currentUser.first_name}`;
}

async function loadReservations() {
    // Clear existing countdown intervals
    countdownIntervals.forEach(interval => clearInterval(interval));
    countdownIntervals = [];

    const { data: reservations, error } = await supabase
        .from('tbl_reservations')
        .select(`
            id,
            service_recipient,
            seat_id,
            barber_id,
            reserved_date,
            reserved_time,
            reserved_datetime,
            status,
            total_price,
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
        .eq('user_id', currentUser.id)
        .in('status', ['pending', 'accepted', 'on_hold', 'ongoing'])
        .order('reserved_datetime', { ascending: true });

    if (error) {
        console.error('Error loading reservations:', error);
        return;
    }

    displayReservations(reservations);
}

function displayReservations(reservations) {
    const container = document.getElementById('reservationsContainer');
    
    if (!reservations || reservations.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No active reservations. <a href="reservations.html" style="color: #4a2c0a; font-weight: 600;">Make one now!</a></p>';
        return;
    }

    container.innerHTML = reservations.map((res, index) => {
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        const serviceTitle = baseService?.tbl_services.name || 'Service';
        const addonsList = addons.length > 0 
            ? '+ ' + addons.map(a => a.tbl_services.name).join(', ')
            : '';

        const barberName = res.tbl_barbers?.tbl_users
            ? `${res.tbl_barbers.tbl_users.first_name} ${res.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';

        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
        
        const dateStr = dateTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        
        const timeStr = dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Create unique ID for countdown element
        const countdownId = `countdown-${index}`;

        return `
            <div class="reservation-card">
                <div class="card-header">
                    <div>
                        <i class="fa-solid fa-bell" style="color: #ffc107; font-size: 1.5rem;"></i>
                        <h2 class="service-title">${serviceTitle}</h2>
                        ${addonsList ? `<div class="service-addons">${addonsList}</div>` : ''}
                    </div>
                    <div class="status-section">
                        <span class="status-badge status-${res.status}">
                            Status: ${res.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <div class="time-left" id="${countdownId}">Calculating...</div>
                    </div>
                </div>

                <div class="card-details">
                    <div class="detail-item">
                        <span class="detail-label">Service Recipient</span>
                        <span class="detail-value">${res.service_recipient}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Seat</span>
                        <span class="detail-value">Seat ${res.tbl_seats.seat_number}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Barber</span>
                        <span class="detail-value">${barberName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total</span>
                        <span class="detail-value">₱${res.total_price}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Reserved Date</span>
                        <span class="detail-value">${dateStr}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Reserved Time</span>
                        <span class="detail-value">${timeStr}</span>
                    </div>
                </div>

                <button class="btn-cancel" onclick="openCancelModal(${res.id})">
                    <i class="fa-solid fa-times-circle"></i> Cancel Reservation
                </button>
            </div>
        `;
    }).join('');

    // Start countdown timers for each reservation
    reservations.forEach((res, index) => {
        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
        
        const countdownId = `countdown-${index}`;
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
        element.textContent = 'Time has passed';
        element.style.color = '#ef4444';
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
    } else if (hours < 2) {
        element.style.color = '#f59e0b'; // Orange - less than 2 hours
    } else {
        element.style.color = '#10b981'; // Green - plenty of time
    }
}

window.openCancelModal = function(reservationId) {
    selectedReservationId = reservationId;
    document.getElementById('cancelModal').style.display = 'flex';
};

window.closeCancelModal = function() {
    document.getElementById('cancelModal').style.display = 'none';
    document.getElementById('cancelReason').value = '';
    selectedReservationId = null;
};

window.confirmCancel = async function() {
    const reason = document.getElementById('cancelReason').value.trim();
    
    try {
        // Get current user to set cancelled_by
        const { data: { user } } = await supabase.auth.getUser();

        const { error: updateError } = await supabase
            .from('tbl_reservations')
            .update({ 
                status: 'cancelled',
                cancellation_reason: reason || 'No reason provided',
                cancelled_by: user.id
            })
            .eq('id', selectedReservationId);

        if (updateError) throw updateError;

        // Log the cancellation
        const { error: logError } = await supabase
            .from('tbl_admin_logs')
            .insert({
                admin_id: user.id,
                action: 'reservation_cancelled',
                target_table: 'tbl_reservations',
                target_id: selectedReservationId,
                details: {
                    cancelled_by: 'client',
                    reason: reason || 'No reason provided'
                }
            });

        if (logError) console.error('Log error:', logError);

        alert('Reservation cancelled successfully');
        closeCancelModal();
        loadReservations();

    } catch (error) {
        alert('Failed to cancel: ' + error.message);
    }
};

function setupEventListeners() {
    document.getElementById('userIcon').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('userDropdown').classList.toggle('show');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
            document.getElementById('userDropdown').classList.remove('show');
        }
    });
    
    document.getElementById('signOutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// Cleanup intervals when page unloads
window.addEventListener('beforeunload', () => {
    countdownIntervals.forEach(interval => clearInterval(interval));
});
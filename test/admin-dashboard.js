import { supabase } from './supabaseclient.js';

let currentUser = null;
let countdownIntervals = []; // Store interval IDs for cleanup

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    await loadRevenueData();
    setupDropdown();
    setupSignOut();
    loadDashboardData();
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

async function loadDashboardData() {
    await loadStatistics();
    await loadRecentReservations();
}

async function loadStatistics() {
    const { data: allReservations, error } = await supabase
        .from('tbl_reservations')
        .select('status, total_price');

    if (error) {
        console.error('Error loading statistics:', error);
        return;
    }

    const counts = {
        pending: 0,
        accepted: 0,
        on_hold: 0,
        completed: 0,
        cancelled: 0
    };

    let totalRevenue = 0;

    allReservations.forEach(res => {
        if (counts.hasOwnProperty(res.status)) {
            counts[res.status]++;
        }
        
        if (res.status === 'completed') {
            totalRevenue += parseFloat(res.total_price || 0);
        }
    });

    document.getElementById('statPending').textContent = counts.pending;
    document.getElementById('statAccepted').textContent = counts.accepted;
    document.getElementById('statOnHold').textContent = counts.on_hold;
    document.getElementById('statCompleted').textContent = counts.completed;
    document.getElementById('statCancelled').textContent = counts.cancelled;
    document.getElementById('statRevenue').textContent = `₱${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

async function loadRecentReservations() {
    try {
        const { data: reservations, error } = await supabase
            .from('tbl_reservations')
            .select(`
                id,
                service_recipient,
                reserved_datetime,
                status,
                total_price,
                tbl_users!tbl_reservations_user_id_fkey (
                    first_name,
                    last_name
                ),
                tbl_barbers!tbl_reservations_barber_id_fkey (
                    user_id,
                    tbl_users (first_name, last_name)
                ),
                tbl_reservation_services (
                    is_base_service,
                    tbl_services (name)
                )
            `)
            .in('status', ['pending', 'accepted', 'on_hold'])
            .order('created_at', { ascending: false })
            .limit(1); // ← SHOW ONLY 1 MOST RECENT

        if (error) throw error;

        const container = document.getElementById('recentReservations');
        if (!container) return;

        if (!reservations || reservations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; color: #ddd; margin-bottom: 10px;"></i>
                    <p>No client has made a reservation yet</p>
                </div>
            `;
            return;
        }

        // Display the single most recent reservation
        const reservation = reservations[0];
        
        const clientName = reservation.tbl_users
            ? `${reservation.tbl_users.first_name} ${reservation.tbl_users.last_name}`
            : 'Unknown';

        const barberName = reservation.tbl_barbers?.tbl_users
            ? `${reservation.tbl_barbers.tbl_users.first_name} ${reservation.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';

        const baseService = reservation.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = reservation.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services?.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        const dateTime = new Date(reservation.reserved_datetime);
        const dateStr = dateTime.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Status badge
        let statusClass = '';
        let statusText = '';
        switch(reservation.status) {
            case 'pending':
                statusClass = 'status-pending';
                statusText = 'Pending';
                break;
            case 'accepted':
                statusClass = 'status-accepted';
                statusText = 'Accepted';
                break;
            case 'on_hold':
                statusClass = 'status-on-hold';
                statusText = 'On Hold';
                break;
        }

        container.innerHTML = `
            <div class="reservation-item">
                <div class="reservation-header">
                    <h3>${reservation.service_recipient}</h3>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="reservation-details">
                    <div>
                        <i class="fa-solid fa-user"></i>
                        <span>Reserved by: ${clientName}</span>
                    </div>
                    <div>
                        <i class="fa-solid fa-scissors"></i>
                        <span>Barber: ${barberName}</span>
                    </div>
                    <div>
                        <i class="fa-solid fa-calendar"></i>
                        <span>${dateStr} at ${timeStr}</span>
                    </div>
                    <div>
                        <i class="fa-solid fa-cut"></i>
                        <span>${serviceDetails}</span>
                    </div>
                    <div>
                        <i class="fa-solid fa-peso-sign"></i>
                        <span>₱${reservation.total_price}</span>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading recent reservations:', error);
        const container = document.getElementById('recentReservations');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p style="color: #ef4444;">Error loading reservations</p>
                </div>
            `;
        }
    }
}
    

async function loadRevenueData() {
    try {
        const { data: completedServices, error } = await supabase
            .from('tbl_reservations')
            .select('total_price, completed_at')
            .eq('status', 'completed');

        if (error) throw error;

        const allServices = completedServices || [];
        
        // Setup filter change listener
        const periodFilter = document.getElementById('revenuePeriod');
        if (periodFilter) {
            periodFilter.addEventListener('change', (e) => {
                updateRevenue(allServices, e.target.value);
            });
        }

        // Initial load - show today's revenue
        updateRevenue(allServices, 'today');

    } catch (error) {
        console.error('Error loading revenue:', error);
        document.getElementById('totalRevenue').textContent = '₱0';
    }
}

function updateRevenue(services, period) {
    const now = new Date();
    let filteredServices = [];
    
    switch(period) {
        case 'today':
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            filteredServices = services.filter(s => 
                new Date(s.completed_at) >= todayStart
            );
            break;
            
        case 'weekly':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            filteredServices = services.filter(s => 
                new Date(s.completed_at) >= weekStart
            );
            break;
            
        case 'monthly':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            filteredServices = services.filter(s => 
                new Date(s.completed_at) >= monthStart
            );
            break;
    }
    
    const totalRevenue = filteredServices.reduce((sum, s) => sum + s.total_price, 0);
    
    document.getElementById('totalRevenue').textContent = `₱${totalRevenue.toLocaleString()}`;
    document.getElementById('revenueCount').textContent = `${filteredServices.length} completed service${filteredServices.length !== 1 ? 's' : ''}`;
}

function displayRecentReservations(reservations) {
    const container = document.getElementById('recentReservations');
    
    if (!reservations || reservations.length === 0) {
        container.innerHTML = '<p class="empty-state">No client has made a reservation yet</p>';
        return;
    }

    container.innerHTML = reservations.map((res, index) => {
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        const clientName = res.tbl_users 
            ? `${res.tbl_users.first_name} ${res.tbl_users.last_name}`
            : 'Unknown';

        const barberName = res.tbl_barbers?.tbl_users
            ? `${res.tbl_barbers.tbl_users.first_name} ${res.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';

        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
        
        const dateStr = dateTime.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        
        const timeStr = dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Create unique ID for countdown
        const countdownId = `dashboard-recent-countdown-${index}`;

        return `
            <div class="reservation-item">
                <div>
                    <div class="res-label">Recipient</div>
                    <div class="res-value">${res.service_recipient}</div>
                </div>
                <div>
                    <div class="res-label">Reserved By</div>
                    <div class="res-value">${clientName}</div>
                </div>
                <div>
                    <div class="res-label">Barber</div>
                    <div class="res-value">${barberName}</div>
                </div>
                <div>
                    <div class="res-label">Service</div>
                    <div class="res-value">${serviceDetails}</div>
                </div>
                <div>
                    <div class="res-label">Total</div>
                    <div class="res-value">₱${res.total_price}</div>
                </div>
                <div>
                    <div class="res-label">Date & Time</div>
                    <div class="res-value">${dateStr}, ${timeStr}</div>
                </div>
                <div>
                    <div class="res-label">Time Left</div>
                    <div class="res-value" id="${countdownId}">Calculating...</div>
                </div>
                <div>
                    <span class="status-badge status-${res.status}">
                        ${res.status.replace('_', ' ')}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    // Start countdown timers for each reservation
    reservations.forEach((res, index) => {
        const dateTime = res.reserved_datetime 
            ? new Date(res.reserved_datetime) 
            : new Date(`${res.reserved_date}T${res.reserved_time}`);
        
        const countdownId = `dashboard-recent-countdown-${index}`;
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
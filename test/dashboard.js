import { supabase } from './supabaseclient.js';

console.log('Dashboard.js loaded');

let currentUser = null;
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard DOM loaded');
    await checkAuth();
});

async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            console.log('No session, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('Session found:', session.user.email);
        
        const { data: profile, error: profileError } = await supabase
            .from('tbl_users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) throw profileError;
        
        currentUser = profile;
        console.log('User profile loaded:', currentUser);
        
        displayUserInfo();
        renderForRole();
        setupSignOut();
        setupDropdown();
        setupNavigationCards(); // NEW: Setup click handlers for info cards
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'login.html';
    }
}

function displayUserInfo() {
    const userSpan = document.querySelector('#userProfileContainer span');
    if (userSpan) {
        userSpan.textContent = `Hi, ${currentUser.first_name}`;
    }
}

function renderForRole() {
    const nav = document.getElementById('mainNav');
    // Client Nav
    nav.innerHTML = `
        <ul>
            <li><a href="dashboard.html" class="active">Home</a></li>
            <li><a href="reservations-list.html">Reservations</a></li>
            <li><a href="seats.html">Live Seats</a></li>
            <li><a href="history.html">Service History</a></li>
        </ul>
    `;

    // Show client UI
    document.getElementById('clientDashboard').style.display = 'block';

    // Load client data
    loadClientReservations();
    loadAnnouncements('client');
}

// NEW: Setup click handlers for navigation cards
function setupNavigationCards() {
    // Shop Schedule Card
    const scheduleCard = document.getElementById('scheduleCard');
    if (scheduleCard) {
        scheduleCard.addEventListener('click', () => {
            window.location.href = 'shop-schedule.html';
        });
    }

    // Meet The Crew Card
    const crewCard = document.getElementById('crewCard');
    if (crewCard) {
        crewCard.addEventListener('click', () => {
            window.location.href = 'crew.html';
        });
    }

    // Our Services Card
    const servicesCard = document.getElementById('servicesCard');
    if (servicesCard) {
        servicesCard.addEventListener('click', () => {
            window.location.href = 'services.html';
        });
    }

    // Recommended Haircuts / The Shop Card
    const haircutsCard = document.getElementById('haircutsCard');
    if (haircutsCard) {
        haircutsCard.addEventListener('click', () => {
            window.location.href = 'haircuts.html';
        });
    }
}

//DATA 

async function loadClientReservations() {
    try {
        // Clear existing countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const now = new Date().toISOString();
        
        const { data: reservations, error } = await supabase
            .from('tbl_reservations')
            .select(`
                *,
                tbl_seats (seat_number),
                tbl_reservation_services (
                    id,
                    is_base_service,
                    tbl_services (name)
                )
            `)
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'accepted'])
            .gte('reserved_datetime', now)
            .order('reserved_datetime', { ascending: true })
            .limit(1);
        
        const card = document.querySelector('#clientDashboard .reservation-card');
        
        if (!reservations || reservations.length === 0) {
            card.innerHTML = `
                <div class="card-top">
                    <span class="title-text">No Upcoming Reservations</span>
                </div>
                <div class="description-text">
                    <span class="text" style="color: #8b5a2b;">
                        <a href="reservations.html" style="color: #4a2c0a; font-weight: 600;">Make a reservation now!</a>
                    </span>
                </div>
            `;
            return;
        }
        
        const res = reservations[0];
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const serviceName = baseService?.tbl_services?.name || 'Service';
        
        const reservedDateTime = new Date(res.reserved_datetime);
        const dateStr = reservedDateTime.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = reservedDateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        card.innerHTML = `
            <div class="card-top">
                <span class="title-text">${serviceName}</span>
                <span class="time-left" id="dashboardCountdown">Calculating...</span>
            </div>
            <div class="description-text">
                ${dateStr} at ${timeStr} - Seat ${res.tbl_seats.seat_number}
            </div>
        `;

        // Start live countdown
        startDashboardCountdown(reservedDateTime);
        
    } catch (error) {
        console.error('❌ Error loading client reservations:', error);
    }
}

function startDashboardCountdown(targetDateTime) {
    const element = document.getElementById('dashboardCountdown');
    if (!element) return;

    // Update immediately
    updateDashboardCountdown(element, targetDateTime);

    // Then update every second
    countdownInterval = setInterval(() => {
        updateDashboardCountdown(element, targetDateTime);
    }, 1000);
}

function updateDashboardCountdown(element, targetDateTime) {
    const now = new Date();
    const diff = targetDateTime - now;

    if (diff <= 0) {
        element.textContent = 'Time has passed';
        element.style.color = '#ef4444';
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
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

// ===================== SHARED =====================

async function loadAnnouncements(role) {
    try {
        const { data: announcements, error } = await supabase
            .from('tbl_announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Announcements loaded:', announcements);
        
        const selector = role === 'admin' ? '#adminAnnouncementCard' : '#clientDashboard .announcement-card';
        const card = document.querySelector(selector);
        
        if (!announcements || announcements.length === 0) {
            card.innerHTML = `
                <i class="fa-solid fa-bullhorn" style="margin-right: 10px; color: #8b5a2b;"></i>
                No announcements at this time.
            `;
            return;
        }
        
        card.innerHTML = `
            <i class="fa-solid fa-bullhorn" style="margin-right: 10px; color: #8b5a2b;"></i>
            ${announcements[0].message}
        `;
        
    } catch (error) {
        console.error('❌ Error loading announcements:', error);
    }
}

function setupSignOut() {
    const signOutLink = document.getElementById('signOutLink');
    if (signOutLink) {
        signOutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Clear countdown interval
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            await supabase.auth.signOut();
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }
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

// Cleanup interval when page unloads
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});
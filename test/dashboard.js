import { supabase } from './supabaseclient.js';

console.log('Dashboard.js loaded');

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log(' Dashboard DOM loaded');
    await checkAuth();

});

async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            console.log(' No session, redirecting to login');
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

    if (currentUser.role === 'admin') {
        console.log('🔄 Rendering admin dashboard');

        // Admin Nav
        nav.innerHTML = `
            <ul>
                <li><a href="dashboard.html" class="active">Home</a></li>
                <li><a href="admin-service-history.html">Barbers Service History</a></li>
                <li><a href="admin-logs.html">Logs</a></li>
            </ul>
        `;

        // Show admin, hide client
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('clientDashboard').style.display = 'none';

        // Load admin data
        loadAdminReservations();
        loadAnnouncements('admin');

    } else if (currentUser.role === 'client') {
        console.log('🔄 Rendering client dashboard');

        // Client Nav
        nav.innerHTML = `
            <ul>
                <li><a href="dashboard.html" class="active">Home</a></li>
                <li><a href="seats.html">View Live Seats</a></li>
                <li><a href="history.html">Service History</a></li>
            </ul>
        `;

        // Show client, hide admin
        document.getElementById('clientDashboard').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';

        // Load client data
        loadClientReservations();
        loadAnnouncements('client');

    } else {
        // Barber or unknown — shouldn't be here
        alert('Barbers should use the Android app.');
        supabase.auth.signOut();
        window.location.href = 'login.html';
    }
}

//DATA 

async function loadClientReservations() {
    try {
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
        
        if (error) throw error;
        
        console.log('✅ Upcoming reservations loaded:', reservations);
        
        const card = document.querySelector('#clientDashboard .reservation-card');
        
        if (!reservations || reservations.length === 0) {
            card.innerHTML = `
                <div class="card-top">
                    <span class="title-text">No Upcoming Reservations</span>
                </div>
                <div class="description-text">
                    <span class="text" style="color: #8b5a2b;"></a>
                </div>
            `;
            return;
        }
        
        const res = reservations[0];
        const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
        const serviceName = baseService?.tbl_services?.name || 'Service';
        const timeLeft = calculateTimeLeft(res.reserved_datetime);
        
        card.innerHTML = `
            <div class="card-top">
                <span class="title-text">${serviceName}</span>
                <span class="time-left">${timeLeft}</span>
            </div>
            <div class="description-text">
                ${new Date(res.reserved_datetime).toLocaleDateString()} at ${res.reserved_time} - Seat ${res.tbl_seats.seat_number}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading client reservations:', error);
    }
}

//ADMIN DATA 

async function loadAdminReservations() {
    try {
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
            .in('status', ['pending', 'accepted', 'ongoing'])
            .order('reserved_datetime', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        console.log('Admin reservations loaded:', reservations);
        
        const card = document.getElementById('adminReservationsCard');
        
        if (!reservations || reservations.length === 0) {
            card.innerHTML = `
                <div class="card-top">
                    <span class="title-text">No active reservations</span>
                </div>
            `;
            return;
        }
        
        card.innerHTML = reservations.map(res => {
            const baseService = res.tbl_reservation_services?.find(s => s.is_base_service);
            const serviceName = baseService?.tbl_services?.name || 'Service';
            const timeLeft = calculateTimeLeft(res.reserved_datetime);
            
            return `
                <div class="card-top" style="border-bottom: 1px solid #e0d5c7; padding-bottom: 8px; margin-bottom: 8px;">
                    <span class="title-text">${serviceName} — Seat ${res.tbl_seats.seat_number}</span>
                    <span class="time-left status-${res.status}">${res.status}</span>
                </div>
                <div class="description-text">${res.service_recipient} · ${res.reserved_time}</div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading admin reservations:', error);
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
        
        console.log('Announcements loaded:', announcements);
        
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
        console.error('Error loading announcements:', error);
    }
}

function calculateTimeLeft(reservedDatetime) {
    const now = new Date();
    const reserved = new Date(reservedDatetime);
    const diffMs = reserved - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 0) return 'Past due';
    if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} mins left`;
    }
    if (diffHours < 24) return `${diffHours} hrs left`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days left`;
}

function setupSignOut() {
    document.getElementById('signOutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
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

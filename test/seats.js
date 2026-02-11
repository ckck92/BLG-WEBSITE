import { supabase } from './supabaseclient.js';

let currentUser = null;
let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    loadSeats();
    
    // Refresh every 30 seconds
    setInterval(loadSeats, 30000);
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

    currentUser = profile;
    userRole = profile.role;

    // Update user name
    document.getElementById('userName').textContent = `Hi, ${currentUser.first_name}`;

    // Populate nav based on role
    const nav = document.getElementById('mainNav');
        nav.innerHTML = `
            <ul>
                <li><a href="dashboard.html">Home</a></li>
                <li><a href="reservations-list.html">Reservations List</a></li>
                <li><a href="seats.html" class="active">View Live Seats</a></li>
                <li><a href="history.html">Service History</a></li>
            </ul>
        `;
    }

    // Set legend based on role
    renderLegend();

function renderLegend() {
    const legend = document.getElementById('legendContainer');
        // Client sees full legend
        legend.innerHTML = `
            <div class="legend-item"><div class="dot green"></div> Available</div>
            <div class="legend-item"><div class="dot blue"></div> Your Reservation</div>
            <div class="legend-item"><div class="dot red"></div> Service Ongoing</div>
            <div class="legend-item"><div class="dot gray"></div> Shop Closed</div>
        `;
    }

async function loadSeats() {
    const now = new Date();
    const nowISO = now.toISOString();

    // Get shop hours for today
    const dayOfWeek = now.getDay();
    const { data: shopHours } = await supabase
        .from('tbl_shop_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .single();

    const isShopOpen = shopHours?.is_open || false;

    // Get all seats with barber info
    const { data: seats } = await supabase
        .from('tbl_seats')
        .select(`
            *,
            tbl_barbers (
                user_id,
                tbl_users (first_name, last_name)
            )
        `)
        .order('seat_number');

    if (!seats || seats.length === 0) {
        document.getElementById('seatsContainer').innerHTML = '<p style="color: #666;">No seats available</p>';
        return;
    }

    // Get today's accepted/ongoing reservations
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data: reservations } = await supabase
        .from('tbl_reservations')
        .select('*')
        .in('status', ['accepted', 'ongoing'])
        .gte('reserved_datetime', todayStart)
        .lt('reserved_datetime', todayEnd);

    const container = document.getElementById('seatsContainer');
    container.innerHTML = seats.map(seat => renderSeatCard(seat, reservations || [], isShopOpen, now)).join('');
}

function renderSeatCard(seat, allReservations, isShopOpen, now) {
    const barberName = seat.tbl_barbers?.tbl_users 
        ? `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`
        : 'Unassigned';

    // Find reservations for this seat
    const seatReservations = allReservations.filter(r => r.seat_id === seat.id);

    let seatClass = 'available';
    let statusText = 'Available';
    let statusColor = 'text-green';
    let description = 'Ready for Reservation';
    let icon = '<i class="fa-regular fa-circle-check"></i>';
    let buttonHtml = ``;
    let warningHtml = '';

    // ADMIN LOGIC: Always show green unless shop closed or seat ongoing
    if (userRole === 'admin') {
        if (!isShopOpen) {
            seatClass = 'closed';
            statusText = 'Shop Closed';
            statusColor = 'text-gray';
            description = 'Outside operating hours';
            icon = '<i class="fa-solid fa-ban"></i>';
            buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
        } else {
            const ongoing = seatReservations.find(r => r.status === 'ongoing');
            if (ongoing) {
                seatClass = 'occupied';
                statusText = 'Occupied';
                statusColor = 'text-red';
                description = 'Currently in Service';
                icon = '<i class="fa-solid fa-scissors"></i>';
                buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
            } else {
                // Admin always sees green if shop open and no ongoing service
                seatClass = 'available';
                statusText = 'Available';
                statusColor = 'text-green';
                description = 'Ready for Walk-ins or Reservations';
                icon = '<i class="fa-regular fa-circle-check"></i>';
            }
        }
    } 
    // CLIENT LOGIC: Show full color states
    else {
        if (!isShopOpen) {
            seatClass = 'closed';
            statusText = 'Shop Closed';
            statusColor = 'text-gray';
            description = 'Outside operating hours';
            icon = '<i class="fa-solid fa-ban"></i>';
            buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
        } else {
            const ongoing = seatReservations.find(r => r.status === 'ongoing');
            if (ongoing) {
                seatClass = 'occupied';
                statusText = 'Occupied';
                statusColor = 'text-red';
                description = 'Currently in Service';
                icon = '<i class="fa-solid fa-scissors"></i>';
                buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
            } else {
                const accepted = seatReservations.filter(r => r.status === 'accepted');
                let foundUserReservation = false;

                for (const res of accepted) {
                    const resTime = new Date(res.reserved_datetime);
                    const diffMinutes = (resTime - now) / 1000 / 60;

                    // Client's own reservation (blue) - highest priority
                    if (res.user_id === currentUser.id) {
                        seatClass = 'reserved-user';
                        statusText = 'Reserved By You';
                        statusColor = 'text-blue';
                        description = resTime.toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
                        });
                        icon = '<i class="fa-solid fa-user-check"></i>';
                        
                        if (diffMinutes <= 5 && diffMinutes > 0) {
                            warningHtml = '<p class="desc warning"><small>Grace period active. If missed, seat will open for walk-ins.</small></p>';
                        }
                        
                        foundUserReservation = true;
                        break;
                    }

                    // Upcoming within 30 minutes (brown) - only if not user's own
                    if (!foundUserReservation && diffMinutes <= 30 && diffMinutes > 0) {
                        seatClass = 'upcoming';
                        statusText = 'Upcoming';
                        statusColor = 'text-brown';
                        description = `Appointment in ${Math.floor(diffMinutes)} minutes`;
                        icon = '<i class="fa-solid fa-clock"></i>';
                        buttonHtml = '<button class="btn-action" onclick="window.location.href=\'reservations.html\'">Reserve</button>';
                    }
                }
            }
        }
    }

    return `
        <div class="seat-card">
            <div class="seat-box ${seatClass}">
                <div class="seat-color"></div>
                <span class="seat-status-icon">${icon}</span>
            </div>
            <h3>Seat ${seat.seat_number}</h3>
            <p class="barber-name">${barberName}</p>
            <p class="status-text ${statusColor}">${statusText}</p>
            ${warningHtml}
            <p class="desc">${description}</p>
            ${buttonHtml}
        </div>
    `;
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
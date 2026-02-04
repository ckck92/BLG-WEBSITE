import { supabase } from './supabaseclient.js';

let currentUser = null;

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

    if (profile.role !== 'admin') {
        window.location.href = 'seats.html'; // Redirect non-admins to client view
        return;
    }

    currentUser = profile;
    document.getElementById('userName').textContent = `Hi, ${currentUser.first_name}`;
}

async function loadSeats() {
    const now = new Date();

    // Get shop hours for today
    const dayOfWeek = now.getDay();
    const { data: shopHours } = await supabase
        .from('tbl_shop_hours')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .single();

    const isShopOpen = shopHours?.is_open || false;

    // Get all seats with barber info
    const { data: seats, error } = await supabase
        .from('tbl_seats')
        .select(`
            *,
            tbl_barbers (
                user_id,
                tbl_users (first_name, last_name)
            )
        `)
        .order('seat_number');

    console.log('Seats query result:', { seats, error });

    if (error) {
        console.error('Error loading seats:', error);
        document.getElementById('seatsContainer').innerHTML = '<p style="color: #666;">Error loading seats</p>';
        return;
    }

    if (!seats || seats.length === 0) {
        document.getElementById('seatsContainer').innerHTML = '<p style="color: #666;">No seats available</p>';
        return;
    }

    // Get today's ongoing reservations only
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data: reservations } = await supabase
        .from('tbl_reservations')
        .select('*')
        .eq('status', 'ongoing')
        .gte('reserved_datetime', todayStart)
        .lt('reserved_datetime', todayEnd);

    const container = document.getElementById('seatsContainer');
    container.innerHTML = seats.map(seat => renderSeatCard(seat, reservations || [], isShopOpen)).join('');
}

function renderSeatCard(seat, ongoingReservations, isShopOpen) {
    const barberName = seat.tbl_barbers?.tbl_users 
        ? `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`
        : 'Unassigned';

    const isOccupied = ongoingReservations.some(r => r.seat_id === seat.id);

    let seatClass, statusText, statusColor, description, icon, buttonHtml;

    if (!isShopOpen) {
        seatClass = 'closed';
        statusText = 'Shop Closed';
        statusColor = 'text-gray';
        description = 'Outside operating hours';
        icon = '<i class="fa-solid fa-ban"></i>';
        buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
    } else if (isOccupied) {
        seatClass = 'occupied';
        statusText = 'Occupied';
        statusColor = 'text-red';
        description = 'Currently in Service';
        icon = '<i class="fa-solid fa-scissors"></i>';
        buttonHtml = '<button class="btn-action" disabled>Unavailable</button>';
    } else {
        // Admin always sees green if open and not occupied
        seatClass = 'available';
        statusText = 'Available';
        statusColor = 'text-green';
        description = 'Ready for Walk-ins or Reservations';
        icon = '<i class="fa-regular fa-circle-check"></i>';
        buttonHtml = '<button class="btn-action" onclick="window.location.href=\'admin-manage-reservations.html\'">Manage</button>';
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
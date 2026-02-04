import { supabase } from './supabaseclient.js';

let currentUser = null;
let selectedServices = [];
let allServices = {};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadServices();
    await loadAvailableSeats();
    await loadUserReservations();
    setupEventListeners();
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
    
    // Update username in header
    const userSpan = document.querySelector('#userProfileContainer span');
    if (userSpan) userSpan.textContent = `Hi, ${currentUser.first_name}`;
    
    // Pre-fill recipient name with current user's name
    const recipientInput = document.getElementById('recipientName');
    if (recipientInput && !recipientInput.value) {
        recipientInput.value = `${currentUser.first_name} ${currentUser.last_name}`;
    }
}

async function loadServices() {
    const { data: services } = await supabase
        .from('tbl_services')
        .select('*')
        .eq('is_active', true)
        .order('price');
    
    allServices = {
        general: services.filter(s => s.service_type === 'general'),
        modern_cut: services.filter(s => s.service_type === 'modern_cut'),
        bossing: services.filter(s => s.service_type === 'bossing'),
        addons: services.filter(s => s.service_type === 'addon')
    };
    
    renderServiceMenu();
}

async function loadAvailableSeats() {
    const { data: seats, error } = await supabase
        .from('tbl_seats')
        .select(`
            *,
            tbl_barbers (
                user_id,
                tbl_users (first_name, last_name)
            )
        `)
        .eq('is_available', true)
        .order('seat_number');

    if (error) {
        console.error('Error loading seats:', error);
        return;
    }

    const seatSelect = document.getElementById('resSeat');
    if (!seatSelect) return;

    if (!seats || seats.length === 0) {
        seatSelect.innerHTML = '<option value="">No seats available</option>';
        return;
    }

    seatSelect.innerHTML = '<option value="">Select a Seat</option>' + 
        seats.map(seat => {
            const barberName = seat.tbl_barbers?.tbl_users 
                ? `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`
                : 'Unassigned';
            
            return `<option value="${seat.id}">Seat ${seat.seat_number} - ${barberName}</option>`;
        }).join('');
}

function renderServiceMenu() {
    const menuContainer = document.querySelector('.menu-container');
    if (!menuContainer) return;
    
    menuContainer.innerHTML = `
        <div class="menu-column" data-group="general" data-type="single">
            <div class="category-header-small">GENERAL</div>
            ${allServices.general.map(s => `
                <div class="selectable" data-service-id="${s.id}" onclick="handleMenuSelect(this)">
                    <h4>${s.name}</h4>
                    <p>Price: ₱${s.price}</p>
                </div>
            `).join('')}
        </div>
        
        <div class="menu-column" data-group="modern_cut" data-type="single">
            <div class="category-header-small">MODERN CUT</div>
            ${allServices.modern_cut.map(s => `
                <div class="selectable" data-service-id="${s.id}" onclick="handleMenuSelect(this)">
                    <h4>${s.name}</h4>
                    <p>Price: ₱${s.price}</p>
                </div>
            `).join('')}
        </div>
        
        <div class="menu-column" data-group="bossing" data-type="single">
            <div class="category-header-small">BOSSING SERVICES</div>
            ${allServices.bossing.map(s => `
                <div class="selectable" data-service-id="${s.id}" onclick="handleMenuSelect(this)">
                    <h4>${s.name}</h4>
                    <p>Price: ₱${s.price}</p>
                </div>
            `).join('')}
        </div>
        
        <div class="menu-column" data-type="multi">
            <div class="category-header-small">ADD-ONS</div>
            ${allServices.addons.map(s => `
                <div class="selectable" data-service-id="${s.id}" onclick="handleMenuSelect(this)">
                    <h4>${s.name}</h4>
                    <p>Price: ₱${s.price}</p>
                </div>
            `).join('')}
        </div>
    `;
}

window.handleMenuSelect = (element) => {
    const serviceId = parseInt(element.dataset.serviceId);
    const service = Object.values(allServices).flat().find(s => s.id === serviceId);
    const column = element.closest('.menu-column');
    const isSingle = column.dataset.type === 'single';

    if (isSingle) {
        // Remove the old base service from the array before adding the new one
        selectedServices = selectedServices.filter(s => !s.can_be_base);

        // Clear all base selection highlights
        document.querySelectorAll('.menu-column[data-type="single"] .selectable').forEach(el => {
            el.classList.remove('selected');
        });

        // If bossing, also clear all add-ons
        if (service.service_type === 'bossing') {
            selectedServices = selectedServices.filter(s => s.can_be_base);
            document.querySelectorAll('.menu-column[data-type="multi"] .selectable').forEach(el => {
                el.classList.remove('selected');
            });
        }

        // Clicking the already-selected base service deselects it
        if (element.classList.contains('selected')) {
            element.classList.remove('selected');
            return;
        }

        element.classList.add('selected');
        selectedServices.push(service);
    } else {
        // Add-on toggle logic
        if (element.classList.contains('selected')) {
            element.classList.remove('selected');
            selectedServices = selectedServices.filter(s => s.id !== serviceId);
        } else {
            element.classList.add('selected');
            selectedServices.push(service);
        }
    }
};

window.confirmMenuSelection = function() {
    if (selectedServices.length === 0) {
        alert('Please select at least one service');
        return;
    }
    
    const baseService = selectedServices.find(s => s.can_be_base);
    if (!baseService) {
        alert('Please select a base service (General, Modern Cut, or Bossing)');
        return;
    }
    
    // Update service input
    const serviceInput = document.getElementById('serviceInput');
    const addons = selectedServices.filter(s => !s.can_be_base);
    
    let displayText = baseService.name;
    if (addons.length > 0) {
        displayText += ' + ' + addons.map(a => a.name).join(', ');
    }
    serviceInput.value = displayText;
    
    // Close modal
    document.getElementById('serviceMenuOverlay').style.display = 'none';
};

async function loadUserReservations() {
    const { data: reservations } = await supabase
        .from('tbl_reservations')
        .select(`
            *,
            tbl_seats (seat_number),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .eq('user_id', currentUser.id)
        .in('status', ['pending', 'accepted', 'ongoing'])
        .order('reserved_datetime', { ascending: false });
    
    displayReservations(reservations);
}

function displayReservations(reservations) {
    const container = document.getElementById('reservationContainer');
    if (!container) return;
    
    if (!reservations || reservations.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px;">No active reservations. Make your first one!</p>';
        return;
    }
    
    container.innerHTML = reservations.map(res => {
        const baseService = res.tbl_reservation_services.find(s => s.is_base_service);
        const addons = res.tbl_reservation_services.filter(s => !s.is_base_service);
        const timeLeft = calculateTimeLeft(res.reserved_datetime);
        
        return `
            <div class="reservation-card">
                <div class="bell-icon">🔔</div>
                <div class="content-wrapper">
                    <details>
                        <summary><h2 class="service-title">${baseService?.tbl_services.name || 'Service'}</h2></summary>
                        ${addons.length > 0 ? `
                            <ul class="sub-services">
                                ${addons.map(a => `<li>${a.tbl_services.name}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </details>
                    <div class="meta-info">${new Date(res.reserved_date).toLocaleDateString()} ${res.reserved_time}<br>Seat: ${res.tbl_seats.seat_number}</div>
                </div>
                <div class="status-area">
                    <div class="time-left">Time: ${timeLeft}</div>
                    <div class="status-val">Status: <b class="status-${res.status}">${res.status}</b></div>
                    <button class="btn-cancel" onclick="openCancelModal(this, ${res.id})">Cancel</button>
                </div>
            </div>
        `;
    }).join('');
}

function calculateTimeLeft(datetime) {
    const diff = new Date(datetime) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours < 0 ? 'Past' : `${hours} hrs left`;
}

function setupEventListeners() {
    // Open reservation modal
    document.getElementById('openReserve')?.addEventListener('click', () => {
        document.getElementById('reserveOverlay').style.display = 'flex';
    });
    
    // Open service menu when clicking service input
    document.getElementById('serviceInput')?.addEventListener('click', () => {
        document.getElementById('serviceMenuOverlay').style.display = 'flex';
    });
    
    // Reserve now button
    document.getElementById('reserveNowBtn')?.addEventListener('click', createReservation);
    
    // Setup logout
    document.querySelector('.dropdown-item[href="login.html"]')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

async function createReservation() {
    if (selectedServices.length === 0) {
        alert('Please select services first');
        return;
    }
    
    const recipientName = document.getElementById('recipientName')?.value.trim();
    const datetime = document.getElementById('resDateTime').value;
    const seatId = parseInt(document.getElementById('resSeat').value);
    
    if (!recipientName || !datetime || !seatId) {
        alert('Please fill all fields');
        return;
    }
    
    const [date, time] = datetime.split('T');
    const serviceIds = selectedServices.map(s => s.id);
    
    try {
        const { data, error } = await supabase.rpc('create_multi_service_reservation', {
            p_user_id: currentUser.id,
            p_service_recipient: recipientName,
            p_service_ids: serviceIds,
            p_seat_id: seatId,
            p_reserved_date: date,
            p_reserved_time: time
        });
        
        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        alert('Reservation created!');
        window.location.reload();
        
    } catch (error) {
        alert('Failed: ' + error.message);
    }
}

window.openCancelModal = function(btn, reservationId) {
    document.getElementById('cancelModalOverlay').style.display = 'flex';
    document.getElementById('confirmCancelBtn').onclick = () => cancelReservation(reservationId);
};

window.closeCancelModal = function() {
    document.getElementById('cancelModalOverlay').style.display = 'none';
};

async function cancelReservation(reservationId) {
    const reason = document.getElementById('cancelReasonInput').value;
    
    try {
        const { error } = await supabase
            .from('tbl_reservations')
            .update({ 
                status: 'cancelled',
                cancellation_reason: reason 
            })
            .eq('id', reservationId);
        
        if (error) throw error;
        
        alert('Reservation cancelled');
        window.location.reload();
        
    } catch (error) {
        alert('Failed: ' + error.message);
    }
}

window.openDetailsModal = () => document.getElementById('detailsOverlay').style.display = 'flex';
window.closeDetailsModal = () => document.getElementById('detailsOverlay').style.display = 'none';

function setupSignOut() {
    document.getElementById('signOutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
}
import { supabase } from './supabaseclient.js';

let currentUser = null;
let allHistory = [];
let filteredHistory = [];
let allBarbers = [];
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadBarbers();
    await loadServiceHistory();
    setupFilters();
});

async function initAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile?.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
        return;
    }

    currentUser = profile;
}

async function loadBarbers() {
    const { data, error } = await supabase
        .from('tbl_seats')
        .select(`
            *,
            tbl_barbers (
                id,
                tbl_users (first_name, last_name)
            )
        `)
        .order('seat_number');

    if (error) {
        console.error('Error loading barbers:', error);
        return;
    }

    allBarbers = data || [];
    populateBarberDropdown();
}

function populateBarberDropdown() {
    const barberFilter = document.getElementById('filterBarber');
    if (!barberFilter) return;

    let options = '<option value="">All Barbers</option>';
    
    allBarbers.forEach(seat => {
        const barberName = seat.tbl_barbers?.tbl_users
            ? `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';
        
        options += `<option value="${barberName}">${barberName}</option>`;
    });

    barberFilter.innerHTML = options;
}

async function loadServiceHistory() {
    const { data: reservations, error } = await supabase
        .from('tbl_reservations')
        .select(`
            id,
            service_recipient,
            user_id,
            seat_id,
            total_price,
            completed_at,
            tbl_seats!seat_id (
                seat_number,
                tbl_barbers (
                    id,
                    user_id,
                    tbl_users (first_name, last_name)
                )
            ),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

    if (error) {
        console.error('Error loading service history:', error);
        document.getElementById('historyTableBody').innerHTML = 
            '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">Error loading service history</td></tr>';
        return;
    }

    allHistory = reservations || [];
    filteredHistory = [...allHistory];
    displayHistory();
}

function setupFilters() {
    const recipientFilter = document.getElementById('filterRecipient');
    const barberFilter = document.getElementById('filterBarber');
    const dateFilter = document.getElementById('filterDate');
    const resetBtn = document.getElementById('resetFilters');

    if (recipientFilter) {
        recipientFilter.addEventListener('input', applyFilters);
    }

    if (barberFilter) {
        barberFilter.addEventListener('change', applyFilters);
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
}

function applyFilters() {
    const recipientFilter = document.getElementById('filterRecipient').value.toLowerCase();
    const barberFilter = document.getElementById('filterBarber').value;
    const dateFilter = document.getElementById('filterDate').value;

    filteredHistory = allHistory.filter(record => {
        // Filter by recipient name
        const recipientMatch = !recipientFilter || 
            record.service_recipient.toLowerCase().includes(recipientFilter);

        // Filter by barber name
        const barberName = record.tbl_seats?.tbl_barbers?.tbl_users
            ? `${record.tbl_seats.tbl_barbers.tbl_users.first_name} ${record.tbl_seats.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';
        const barberMatch = !barberFilter || barberName === barberFilter;

        // Filter by date
        const completedDate = record.completed_at ? record.completed_at.split('T')[0] : '';
        const dateMatch = !dateFilter || completedDate === dateFilter;

        return recipientMatch && barberMatch && dateMatch;
    });

    currentPage = 1; // Reset to first page when filtering
    displayHistory();
}

function resetFilters() {
    document.getElementById('filterRecipient').value = '';
    document.getElementById('filterBarber').value = '';
    document.getElementById('filterDate').value = '';
    filteredHistory = [...allHistory];
    currentPage = 1;
    displayHistory();
}

function displayHistory() {
    const tbody = document.getElementById('historyTableBody');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const firstBtn = document.getElementById('firstPage');
    const lastBtn = document.getElementById('lastPage');

    if (!filteredHistory || filteredHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No completed services yet</td></tr>';
        if (paginationInfo) paginationInfo.textContent = 'No records';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (firstBtn) firstBtn.disabled = true;
        if (lastBtn) lastBtn.disabled = true;
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredHistory.length);
    const pageData = filteredHistory.slice(startIndex, endIndex);

    // Render table rows
    tbody.innerHTML = pageData.map(record => {
        const barberName = record.tbl_seats?.tbl_barbers?.tbl_users
            ? `${record.tbl_seats.tbl_barbers.tbl_users.first_name} ${record.tbl_seats.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';

        const seatNumber = record.tbl_seats?.seat_number || 'N/A';

        // Get service details
        const baseService = record.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = record.tbl_reservation_services?.filter(s => !s.is_base_service) || [];

        let serviceDetails = baseService?.tbl_services?.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        // Format completed date
        const completedDate = record.completed_at
            ? new Date(record.completed_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            })
            : 'N/A';

        return `
            <tr>
                <td><strong>${record.service_recipient}</strong></td>
                <td>Seat ${seatNumber}</td>
                <td>${barberName}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${record.total_price}</strong></td>
                <td>${completedDate}</td>
            </tr>
        `;
    }).join('');

    // Update pagination info
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredHistory.length}`;
    }

    // Update pagination buttons
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                displayHistory();
            }
        };
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayHistory();
            }
        };
    }

    if (firstBtn) {
        firstBtn.disabled = currentPage === 1;
        firstBtn.onclick = () => {
            currentPage = 1;
            displayHistory();
        };
    }

    if (lastBtn) {
        lastBtn.disabled = currentPage === totalPages;
        lastBtn.onclick = () => {
            currentPage = totalPages;
            displayHistory();
        };
    }
}

function setupDropdown() {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.querySelector('.dropdown');

    if (userProfile && dropdown) {
        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
    }
}

async function setupSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }
}
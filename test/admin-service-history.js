import { supabase } from './supabaseclient.js';

let currentUser = null;
let allServiceHistory = [];
let filteredServiceHistory = [];
let allBarbers = [];
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadBarbers();
    await loadServiceHistory();
    setupFilters(); // Setup filters AFTER loading data
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
    
    const uniqueBarbers = new Set();
    allBarbers.forEach(seat => {
        if (seat.tbl_barbers?.tbl_users) {
            const barberName = `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`;
            uniqueBarbers.add(barberName);
        }
    });

    uniqueBarbers.forEach(barberName => {
        options += `<option value="${barberName}">${barberName}</option>`;
    });

    barberFilter.innerHTML = options;
}

async function loadServiceHistory() {
    try {
        const { data: reservations, error } = await supabase
            .from('tbl_reservations')
            .select(`
                id,
                service_recipient,
                user_id,
                seat_id,
                total_price,
                completed_at,
                tbl_users!tbl_reservations_user_id_fkey (
                    first_name,
                    last_name
                ),
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
            .eq('status', 'completed')
            .order('completed_at', { ascending: false });

        if (error) throw error;

        allServiceHistory = reservations || [];
        filteredServiceHistory = [...allServiceHistory]; // CRITICAL: Initialize filteredServiceHistory
        console.log('Service history loaded:', allServiceHistory.length);
        displayCurrentPage();

    } catch (error) {
        console.error('Error loading service history:', error);
        const tbody = document.getElementById('serviceHistoryTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">
                    Error loading service history. Please refresh.
                </td>
            </tr>
        `;
    }
}

function setupFilters() {
    const barberFilter = document.getElementById('filterBarber');
    const dateFilter = document.getElementById('filterDate');
    const minPriceFilter = document.getElementById('filterMinPrice');
    const maxPriceFilter = document.getElementById('filterMaxPrice');
    const resetBtn = document.getElementById('resetFilters');

    // AUTO-FILTER: Apply filters on change
    if (barberFilter) {
        barberFilter.addEventListener('change', applyFilters);
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
    }

    if (minPriceFilter) {
        minPriceFilter.addEventListener('input', applyFilters);
    }

    if (maxPriceFilter) {
        maxPriceFilter.addEventListener('input', applyFilters);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
}

function applyFilters() {
    const barberFilter = document.getElementById('filterBarber');
    const dateFilter = document.getElementById('filterDate');
    const minPriceFilter = document.getElementById('filterMinPrice');
    const maxPriceFilter = document.getElementById('filterMaxPrice');

    const barberValue = barberFilter ? barberFilter.value : '';
    const dateValue = dateFilter ? dateFilter.value : '';
    const minPriceValue = minPriceFilter ? minPriceFilter.value : '';
    const maxPriceValue = maxPriceFilter ? maxPriceFilter.value : '';

    filteredServiceHistory = allServiceHistory.filter(record => {
        // Filter by barber
        const barberName = record.tbl_seats?.tbl_barbers?.tbl_users
            ? `${record.tbl_seats.tbl_barbers.tbl_users.first_name} ${record.tbl_seats.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';
        const barberMatch = !barberValue || barberName === barberValue;

        // Filter by date
        const completedDate = record.completed_at ? record.completed_at.split('T')[0] : '';
        const dateMatch = !dateValue || completedDate === dateValue;

        // Filter by min price
        const minPriceMatch = !minPriceValue || record.total_price >= parseFloat(minPriceValue);

        // Filter by max price
        const maxPriceMatch = !maxPriceValue || record.total_price <= parseFloat(maxPriceValue);

        return barberMatch && dateMatch && minPriceMatch && maxPriceMatch;
    });

    currentPage = 1; // CRITICAL: Reset to first page when filtering
    displayCurrentPage();
}

function resetFilters() {
    document.getElementById('filterBarber').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';

    filteredServiceHistory = [...allServiceHistory];
    currentPage = 1;
    displayCurrentPage();
}

function displayCurrentPage() {
    const tbody = document.getElementById('serviceHistoryTableBody');

    if (!filteredServiceHistory || filteredServiceHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                    No completed services found
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredServiceHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredServiceHistory.length);
    const pageData = filteredServiceHistory.slice(startIndex, endIndex);

    // Render table rows
    tbody.innerHTML = pageData.map(record => {
        const clientName = record.tbl_users
            ? `${record.tbl_users.first_name} ${record.tbl_users.last_name}`
            : 'Unknown User';

        const barberName = record.tbl_seats?.tbl_barbers?.tbl_users
            ? `${record.tbl_seats.tbl_barbers.tbl_users.first_name} ${record.tbl_seats.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';

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
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
            : 'N/A';

        return `
            <tr>
                <td><strong>${record.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td>${barberName}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${record.total_price}</strong></td>
                <td>${completedDate}</td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredServiceHistory.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredServiceHistory.length);

    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    }

    // Update pagination buttons
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const firstBtn = document.getElementById('firstPage');
    const lastBtn = document.getElementById('lastPage');

    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                displayCurrentPage();
            }
        };
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayCurrentPage();
            }
        };
    }

    if (firstBtn) {
        firstBtn.disabled = currentPage === 1;
        firstBtn.onclick = () => {
            currentPage = 1;
            displayCurrentPage();
        };
    }

    if (lastBtn) {
        lastBtn.disabled = currentPage === totalPages;
        lastBtn.onclick = () => {
            currentPage = totalPages;
            displayCurrentPage();
        };
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
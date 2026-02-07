import { supabase } from './supabaseclient.js';

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 5;
let allHistory = [];
let filteredHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadBarbers();
    await loadServiceHistory();
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
    const { data: barbers } = await supabase
        .from('tbl_barbers')
        .select('id, tbl_users (first_name, last_name)')
        .order('id');

    const select = document.getElementById('barberFilter');
    if (barbers) {
        barbers.forEach(barber => {
            const option = document.createElement('option');
            option.value = barber.id;
            option.textContent = `${barber.tbl_users.first_name} ${barber.tbl_users.last_name}`;
            select.appendChild(option);
        });
    }
}

async function loadServiceHistory() {
    const { data: reservations, error } = await supabase
        .from('tbl_reservations')
        .select(`
            id,
            service_recipient,
            user_id,
            barber_id,
            reserved_date,
            reserved_time,
            reserved_datetime,
            completed_at,
            status,
            total_price,
            tbl_users!tbl_reservations_user_id_fkey (first_name, last_name),
            tbl_barbers!tbl_reservations_barber_id_fkey (
                id,
                user_id,
                tbl_users (first_name, last_name)
            ),
            tbl_reservation_services (
                is_base_service,
                tbl_services (name)
            )
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

    if (error) {
        console.error('Error loading history:', error);
        return;
    }

    allHistory = reservations || [];
    filteredHistory = [...allHistory];
    updatePagination();
    displayCurrentPage();
}

window.applyFilters = function() {
    const barberId = document.getElementById('barberFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;

    filteredHistory = allHistory.filter(res => {
        // Barber filter
        if (barberId && res.barber_id !== parseInt(barberId)) return false;
        
        // Date filter
        if (dateFilter) {
            const completedDate = new Date(res.completed_at).toISOString().split('T')[0];
            if (completedDate !== dateFilter) return false;
        }
        
        // Price range filter
        const price = parseFloat(res.total_price);
        if (price < minPrice || price > maxPrice) return false;
        
        return true;
    });

    currentPage = 1;
    updatePagination();
    displayCurrentPage();
};

window.resetFilters = function() {
    document.getElementById('barberFilter').value = '';
    document.getElementById('dateFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    
    filteredHistory = [...allHistory];
    currentPage = 1;
    updatePagination();
    displayCurrentPage();
};

function updatePagination() {
    totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
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
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredHistory.slice(start, end);
    
    const tbody = document.querySelector('#historyTable tbody');
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No completed services found</td></tr>';
        return;
    }

    tbody.innerHTML = pageData.map(res => {
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

        const dateTime = res.completed_at 
            ? new Date(res.completed_at) 
            : new Date(res.reserved_datetime);
            
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

        return `
            <tr>
                <td><strong>${res.service_recipient}</strong></td>
                <td>${clientName}</td>
                <td><strong>${barberName}</strong></td>
                <td>${serviceDetails}</td>
                <td><strong>₱${res.total_price}</strong></td>
                <td>${dateStr}<br><small style="color: #666;">${timeStr}</small></td>
            </tr>
        `;
    }).join('');
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
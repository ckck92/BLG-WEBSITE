import { supabase } from './supabaseclient.js';

let currentUser = null;
let allCompletedServices = [];
let filteredServices = [];
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupDropdown();
    setupSignOut();
    await loadCompletedServices();
    setupFilter();
    calculateRevenue();
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

async function loadCompletedServices() {
    try {
        const { data: reservations, error } = await supabase
            .from('tbl_reservations')
            .select(`
                id,
                service_recipient,
                total_price,
                completed_at,
                tbl_seats!seat_id (
                    tbl_barbers (
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

        allCompletedServices = reservations || [];
        filteredServices = [...allCompletedServices];
        calculateRevenue();
        applyPeriodFilter('today');

    } catch (error) {
        console.error('Error loading completed services:', error);
    }
}

function calculateRevenue() {
    const now = new Date();
    
    // Today's revenue
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayServices = allCompletedServices.filter(s => 
        new Date(s.completed_at) >= todayStart
    );
    const todayRevenue = todayServices.reduce((sum, s) => sum + s.total_price, 0);
    
    document.getElementById('todayRevenue').textContent = `₱${todayRevenue.toLocaleString()}`;
    document.getElementById('todayCount').textContent = `${todayServices.length} completed service${todayServices.length !== 1 ? 's' : ''}`;

    // Weekly revenue (current week - Sunday to Saturday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Go to Sunday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekServices = allCompletedServices.filter(s => 
        new Date(s.completed_at) >= weekStart
    );
    const weeklyRevenue = weekServices.reduce((sum, s) => sum + s.total_price, 0);
    
    document.getElementById('weeklyRevenue').textContent = `₱${weeklyRevenue.toLocaleString()}`;
    document.getElementById('weeklyCount').textContent = `${weekServices.length} completed service${weekServices.length !== 1 ? 's' : ''}`;

    // Monthly revenue (current month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthServices = allCompletedServices.filter(s => 
        new Date(s.completed_at) >= monthStart
    );
    const monthlyRevenue = monthServices.reduce((sum, s) => sum + s.total_price, 0);
    
    document.getElementById('monthlyRevenue').textContent = `₱${monthlyRevenue.toLocaleString()}`;
    document.getElementById('monthlyCount').textContent = `${monthServices.length} completed service${monthServices.length !== 1 ? 's' : ''}`;
}

function setupFilter() {
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
        periodFilter.addEventListener('change', (e) => {
            applyPeriodFilter(e.target.value);
        });
    }
}

function applyPeriodFilter(period) {
    const now = new Date();
    
    switch(period) {
        case 'today':
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            filteredServices = allCompletedServices.filter(s => 
                new Date(s.completed_at) >= todayStart
            );
            break;
            
        case 'weekly':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            filteredServices = allCompletedServices.filter(s => 
                new Date(s.completed_at) >= weekStart
            );
            break;
            
        case 'monthly':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            filteredServices = allCompletedServices.filter(s => 
                new Date(s.completed_at) >= monthStart
            );
            break;
    }
    
    currentPage = 1;
    displayCurrentPage();
}

function displayCurrentPage() {
    const tbody = document.getElementById('revenueTableBody');
    
    if (filteredServices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                    No completed services in this period
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredServices.length);
    const pageData = filteredServices.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(service => {
        const barberName = service.tbl_seats?.tbl_barbers?.tbl_users
            ? `${service.tbl_seats.tbl_barbers.tbl_users.first_name} ${service.tbl_seats.tbl_barbers.tbl_users.last_name}`
            : 'Unknown';

        const baseService = service.tbl_reservation_services?.find(s => s.is_base_service);
        const addons = service.tbl_reservation_services?.filter(s => !s.is_base_service) || [];
        
        let serviceDetails = baseService?.tbl_services?.name || 'Service';
        if (addons.length > 0) {
            serviceDetails += ' + ' + addons.map(a => a.tbl_services.name).join(', ');
        }

        const completedDate = new Date(service.completed_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        return `
            <tr>
                <td>${completedDate}</td>
                <td><strong>${service.service_recipient}</strong></td>
                <td>${barberName}</td>
                <td>${serviceDetails}</td>
                <td><strong>₱${service.total_price.toLocaleString()}</strong></td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1;
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    }

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
            window.location.href = 'login.html';
        });
    }
}
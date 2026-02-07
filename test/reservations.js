import { supabase } from './supabaseclient.js';

let currentUser = null;
let selectedBaseService = null;
let selectedModernCutType = null;
let selectedAddons = [];
let allServices = [];
let allBarbers = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadServices();
    await loadBarbers();
    setupEventListeners();
});

async function checkAuth() {
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
    
    const recipientInput = document.getElementById('recipientName');
    if (recipientInput && currentUser) {
        recipientInput.value = `${currentUser.first_name} ${currentUser.last_name}`;
    }
}

async function loadServices() {
    const { data, error } = await supabase
        .from('tbl_services')
        .select('*')
        .order('service_type');

    if (error) {
        console.error('Error loading services:', error);
        return;
    }

    allServices = data;
    populateServiceDropdown();
}

function populateServiceDropdown() {
    const serviceSelect = document.getElementById('serviceSelect');
    if (!serviceSelect) return;

    const generalServices = allServices.filter(s => s.service_type === 'general' && s.can_be_base);
    const modernCutServices = allServices.filter(s => s.service_type === 'modern_cut' && s.can_be_base);
    const bossingServices = allServices.filter(s => s.service_type === 'bossing' && s.can_be_base);

    let options = '<option value="">Select a service</option>';
    
    if (generalServices.length > 0) {
        options += '<optgroup label="General Services">';
        generalServices.forEach(service => {
            options += `<option value="${service.id}" data-type="general" data-price="${service.price}">
                ${service.name} - ₱${service.price}
            </option>`;
        });
        options += '</optgroup>';
    }

    if (modernCutServices.length > 0) {
        const modernCutPrice = modernCutServices[0].price;
        options += '<optgroup label="Modern Cut">';
        options += `<option value="modern_cut" data-type="modern_cut" data-price="${modernCutPrice}">
            Modern Cut - ₱${modernCutPrice}
        </option>`;
        options += '</optgroup>';
    }

    if (bossingServices.length > 0) {
        options += '<optgroup label="Bossing Packages">';
        bossingServices.forEach(service => {
            options += `<option value="${service.id}" data-type="bossing" data-price="${service.price}">
                ${service.name} - ₱${service.price}
            </option>`;
        });
        options += '</optgroup>';
    }

    serviceSelect.innerHTML = options;
}

async function loadBarbers() {
    const { data, error } = await supabase
        .from('tbl_seats')
        .select(`
            *,
            tbl_barbers (
                id,
                user_id,
                tbl_users (first_name, last_name)
            )
        `)
        .eq('is_available', true)
        .order('seat_number');

    if (error) {
        console.error('Error loading barbers:', error);
        return;
    }

    allBarbers = data;
    populateBarberDropdown();
}

function populateBarberDropdown() {
    const barberSelect = document.getElementById('barberSelect');
    if (!barberSelect) return;

    if (!allBarbers || allBarbers.length === 0) {
        barberSelect.innerHTML = '<option value="">No barbers available</option>';
        return;
    }

    let options = '<option value="">Select a barber</option>';
    allBarbers.forEach(seat => {
        const barberName = seat.tbl_barbers?.tbl_users 
            ? `${seat.tbl_barbers.tbl_users.first_name} ${seat.tbl_barbers.tbl_users.last_name}`
            : 'Unassigned';
        
        options += `<option value="${seat.id}" data-barber-id="${seat.barber_id}">
            Seat ${seat.seat_number} - ${barberName}
        </option>`;
    });

    barberSelect.innerHTML = options;
}

function setupEventListeners() {
    const serviceSelect = document.getElementById('serviceSelect');
    const modernCutOptions = document.getElementById('modernCutOptions');
    const modernCutTypeSelect = document.getElementById('modernCutType');
    const addonsSection = document.getElementById('addonsSection');
    const termsBtn = document.getElementById('termsBtn');
    const termsModal = document.getElementById('termsModal');
    const closeModal = document.querySelector('.btn-close');
    const modalBody = document.querySelector('.modal-body');
    const agreeCheckbox = document.getElementById('agreeTerms');
    const confirmBtn = document.getElementById('confirmBtn');
    const viewListBtn = document.getElementById('viewListBtn');

    if (serviceSelect) {
        serviceSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const serviceType = selectedOption.dataset.type;
            const serviceValue = e.target.value;

            if (serviceValue === 'modern_cut') {
                selectedBaseService = null;
                selectedModernCutType = null;
                modernCutOptions.style.display = 'block';
                addonsSection.style.display = 'block';
                loadAddons('modern_cut');
            } else if (serviceValue && serviceType === 'general') {
                selectedBaseService = allServices.find(s => s.id == serviceValue);
                selectedModernCutType = null;
                modernCutOptions.style.display = 'none';
                addonsSection.style.display = 'block';
                loadAddons('general');
            } else if (serviceValue && serviceType === 'bossing') {
                selectedBaseService = allServices.find(s => s.id == serviceValue);
                selectedModernCutType = null;
                modernCutOptions.style.display = 'none';
                addonsSection.style.display = 'none';
                selectedAddons = [];
            } else {
                selectedBaseService = null;
                selectedModernCutType = null;
                modernCutOptions.style.display = 'none';
                addonsSection.style.display = 'none';
            }

            calculateTotal();
        });
    }

    if (modernCutTypeSelect) {
        modernCutTypeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (selectedType) {
                const modernCutService = allServices.find(s => s.service_type === 'modern_cut' && s.can_be_base);
                selectedBaseService = modernCutService;
                selectedModernCutType = selectedType;
            } else {
                selectedBaseService = null;
                selectedModernCutType = null;
            }
            calculateTotal();
        });
    }

    if (termsBtn) {
        termsBtn.addEventListener('click', () => {
            termsModal.style.display = 'flex';
            agreeCheckbox.disabled = true;
            agreeCheckbox.checked = false;
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            termsModal.style.display = 'none';
        });
    }

    if (modalBody) {
        modalBody.addEventListener('scroll', () => {
            const scrolledToBottom = modalBody.scrollHeight - modalBody.scrollTop <= modalBody.clientHeight + 10;
            if (scrolledToBottom) {
                agreeCheckbox.disabled = false;
            }
        });
    }

    if (agreeCheckbox) {
        agreeCheckbox.addEventListener('change', (e) => {
            confirmBtn.disabled = !e.target.checked;
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleReservationSubmit);
    }

    if (viewListBtn) {
        viewListBtn.addEventListener('click', () => {
            window.location.href = 'reservations-list.html';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === termsModal) {
            termsModal.style.display = 'none';
        }
    });
}

async function loadAddons(baseServiceType) {
    const addonsContainer = document.getElementById('addonsContainer');
    if (!addonsContainer) return;

    const { data: addons, error } = await supabase
        .from('tbl_services')
        .select('*')
        .eq('can_be_base', false)
        .order('name');

    if (error) {
        console.error('Error loading add-ons:', error);
        return;
    }

    if (!selectedBaseService && baseServiceType !== 'modern_cut') {
        addonsContainer.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">Please select a base service first</p>';
        return;
    }

    let availableAddons = addons;

    if (baseServiceType === 'general') {
        const includedAddons = selectedBaseService?.included_addons || [];
        availableAddons = addons.filter(addon => !includedAddons.includes(addon.name));
    } else if (baseServiceType === 'modern_cut') {
        const modernCutService = allServices.find(s => s.service_type === 'modern_cut' && s.can_be_base);
        const includedAddons = modernCutService?.included_addons || [];
        availableAddons = addons.filter(addon => !includedAddons.includes(addon.name));
    }

    if (availableAddons.length === 0) {
        addonsContainer.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">All add-ons are included in this service</p>';
        return;
    }

    let html = '<div class="checkbox-group">';
    availableAddons.forEach(addon => {
        html += `
            <label class="checkbox-label">
                <input type="checkbox" 
                       value="${addon.id}" 
                       data-price="${addon.price}" 
                       data-name="${addon.name}"
                       onchange="window.handleAddonChange(this)">
                <span>${addon.name} - ₱${addon.price}</span>
            </label>
        `;
    });
    html += '</div>';

    addonsContainer.innerHTML = html;
}

window.handleAddonChange = function(checkbox) {
    const addonId = parseInt(checkbox.value);
    const addonPrice = parseFloat(checkbox.dataset.price);
    const addonName = checkbox.dataset.name;

    if (checkbox.checked) {
        selectedAddons.push({ id: addonId, name: addonName, price: addonPrice });
    } else {
        selectedAddons = selectedAddons.filter(a => a.id !== addonId);
    }

    calculateTotal();
};

function calculateTotal() {
    const totalDisplay = document.querySelector('.total-display span');
    if (!totalDisplay) return;

    let total = 0;

    if (selectedBaseService) {
        total += parseFloat(selectedBaseService.price);
    }

    selectedAddons.forEach(addon => {
        total += addon.price;
    });

    totalDisplay.textContent = `₱${total.toFixed(2)}`;
}

async function handleReservationSubmit() {
    const recipientName = document.getElementById('recipientName').value.trim();
    const barberSelect = document.getElementById('barberSelect');
    const timeInput = document.getElementById('timeInput');
    const agreeCheckbox = document.getElementById('agreeTerms');

    if (!recipientName) {
        alert('Please enter the service recipient name');
        return;
    }

    if (!selectedBaseService) {
        alert('Please select a service');
        return;
    }

    if (selectedBaseService.service_type === 'modern_cut' && !selectedModernCutType) {
        alert('Please select a Modern Cut type');
        return;
    }

    if (!barberSelect.value) {
        alert('Please select a barber');
        return;
    }

    if (!timeInput.value) {
        alert('Please select a time');
        return;
    }

    if (!agreeCheckbox.checked) {
        alert('Please read and agree to the reservation rules');
        return;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const reservedDate = `${year}-${month}-${day}`;

    const serviceIds = [selectedBaseService.id];
    selectedAddons.forEach(addon => {
        serviceIds.push(addon.id);
    });

    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating...';

    try {
        const { data, error } = await supabase.rpc('create_multi_service_reservation', {
            p_user_id: currentUser.id,
            p_service_recipient: recipientName,
            p_service_ids: serviceIds,
            p_seat_id: parseInt(barberSelect.value),
            p_reserved_date: reservedDate,
            p_reserved_time: timeInput.value
        });

        if (error) throw error;

        if (!data.success) {
            throw new Error(data.error || 'Failed to create reservation');
        }

        alert('Reservation created successfully!');
        window.location.href = 'reservations-list.html';

    } catch (error) {
        console.error('Error creating reservation:', error);
        alert('Failed to create reservation: ' + error.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Reservation';
    }
}

function setupDropdown() {
    const userProfile = document.querySelector('.user-profile');
    const dropdown = document.querySelector('.dropdown-menu');

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

setupDropdown();
setupSignOut();
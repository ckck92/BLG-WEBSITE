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

// ========================================
// BUSINESS LOGIC VALIDATION FUNCTIONS
// ========================================

/**
 * CRITICAL FIX: Validates exact time slot with proper timezone handling
 */
async function validateTimeSlotAvailable(barberId, reservedDateTime) {
    try {
        const requestedTime = new Date(reservedDateTime);
        
        console.log('🔍 Checking exact time slot:');
        console.log('   Requested:', requestedTime.toISOString());
        
        const { data: existingReservations, error } = await supabase
            .from('tbl_reservations')
            .select('id, reserved_datetime, service_recipient, barber_id')
            .eq('barber_id', barberId)
            .in('status', ['pending', 'accepted', 'on_hold', 'ongoing'])
            .eq('reserved_datetime', requestedTime.toISOString());

        if (error) {
            console.error('Error in validateTimeSlotAvailable:', error);
            throw error;
        }

        if (existingReservations && existingReservations.length > 0) {
            console.log('❌ EXACT TIME CONFLICT!');
            return {
                valid: false,
                message: 'This time slot is already booked by another client. Please select a different time.'
            };
        }

        console.log('✅ Exact time slot available');
        return { valid: true };

    } catch (error) {
        console.error('Error checking time slot:', error);
        return {
            valid: false,
            message: 'Unable to verify time slot availability. Please try again.'
        };
    }
}

/**
 * CRITICAL FIX: 90-minute buffer validation with timezone handling
 */
async function validateServiceBuffer(barberId, reservedDateTime) {
    try {
        const requestedTime = new Date(reservedDateTime);
        const BUFFER_MINUTES = 90;
        
        console.log('═══════════════════════════════════════');
        console.log('🔍 BUFFER VALIDATION (90 MINUTES)');
        console.log('═══════════════════════════════════════');
        console.log('Barber ID:', barberId);
        console.log('Requested (Local):', requestedTime.toLocaleString());
        console.log('Requested (UTC):', requestedTime.toISOString());
        
        if (!barberId) {
            console.error('❌ No barber_id!');
            return {
                valid: false,
                message: 'Unable to identify the selected barber.'
            };
        }

        // CRITICAL FIX: Create day boundaries in UTC, not local time
        // Get the UTC date components from the requested time
        const year = requestedTime.getUTCFullYear();
        const month = requestedTime.getUTCMonth();
        const day = requestedTime.getUTCDate();
        
        // Create day boundaries using UTC methods
        const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

        console.log('Day boundaries (UTC):');
        console.log('   Start:', dayStart.toISOString());
        console.log('   End:', dayEnd.toISOString());

        // Query ALL active reservations for this barber on this UTC day
        const { data: allReservations, error } = await supabase
            .from('tbl_reservations')
            .select('id, reserved_datetime, service_recipient, status, barber_id')
            .eq('barber_id', barberId)
            .in('status', ['pending', 'accepted', 'on_hold', 'ongoing'])
            .gte('reserved_datetime', dayStart.toISOString())
            .lte('reserved_datetime', dayEnd.toISOString())
            .order('reserved_datetime');

        if (error) {
            console.error('❌ Query error:', error);
            throw error;
        }

        console.log('───────────────────────────────────────');
        console.log('📋 Found:', allReservations?.length || 0, 'active reservations');

        if (!allReservations || allReservations.length === 0) {
            console.log('✅ No conflicts - PASS');
            console.log('═══════════════════════════════════════\n');
            return { valid: true };
        }

        // Check EACH reservation for buffer violation
        for (let i = 0; i < allReservations.length; i++) {
            const reservation = allReservations[i];
            const existingTime = new Date(reservation.reserved_datetime);
            
            const diffMs = Math.abs(requestedTime.getTime() - existingTime.getTime());
            const diffMinutes = diffMs / (60 * 1000);

            console.log(`\n📌 Reservation ${i + 1}/${allReservations.length}:`);
            console.log('   Recipient:', reservation.service_recipient);
            console.log('   Time (Local):', existingTime.toLocaleString());
            console.log('   Time (UTC):', existingTime.toISOString());
            console.log('   Gap:', diffMinutes.toFixed(2), 'min');

            if (diffMinutes > 0 && diffMinutes < BUFFER_MINUTES) {
                console.log('   ❌ BUFFER VIOLATION!');
                console.log('   Required:', BUFFER_MINUTES, 'min');
                console.log('   Actual:', diffMinutes.toFixed(2), 'min');
                console.log('   SHORT BY:', (BUFFER_MINUTES - diffMinutes).toFixed(2), 'min');
                console.log('═══════════════════════════════════════\n');

                const existingTimeStr = existingTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                const earlierTime = new Date(existingTime.getTime() - (BUFFER_MINUTES * 60 * 1000));
                const laterTime = new Date(existingTime.getTime() + (BUFFER_MINUTES * 60 * 1000));

                const earlierStr = earlierTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                const laterStr = laterTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                return {
                    valid: false,
                    message: `⚠️ TOO CLOSE TO EXISTING RESERVATION\n\nThis barber has a booking at ${existingTimeStr}.\n\nYou need at least 90 minutes (1.5 hours) between appointments.\n\n✅ Available times:\n• ${laterStr} or later\n• ${earlierStr} or earlier`
                };
            }

            if (diffMinutes === 0) {
                console.log('   ❌ EXACT SAME TIME!');
                console.log('═══════════════════════════════════════\n');
                return {
                    valid: false,
                    message: 'This exact time is already booked.'
                };
            }

            console.log('   ✅ OK');
        }

        console.log('\n✅ All buffer checks PASSED!');
        console.log('═══════════════════════════════════════\n');
        return { valid: true };

    } catch (error) {
        console.error('❌ Error in validateServiceBuffer:', error);
        return {
            valid: false,
            message: 'Unable to verify booking buffer. Please try again.'
        };
    }
}

/**
 * Validates booking is within shop hours
 */
async function validateShopHours(reservedDateTime) {
    try {
        const reservedDate = new Date(reservedDateTime);
        const dayOfWeek = reservedDate.getDay();

        const { data: shopHours, error } = await supabase
            .from('tbl_shop_hours')
            .select('*')
            .eq('day_of_week', dayOfWeek)
            .single();

        if (error) throw error;

        if (!shopHours.is_open) {
            return {
                valid: false,
                message: 'The shop is closed on this day. Please select a different date.'
            };
        }

        const requestedTime = reservedDate.toTimeString().split(' ')[0];

        if (requestedTime < shopHours.open_time) {
            const openTime = formatTime(shopHours.open_time);
            return {
                valid: false,
                message: `The shop opens at ${openTime}. Please select a later time.`
            };
        }

        const serviceEndTime = new Date(reservedDate.getTime() + (90 * 60 * 1000));
        const serviceEndTimeStr = serviceEndTime.toTimeString().split(' ')[0];

        if (serviceEndTimeStr > shopHours.close_time) {
            const closeTime = formatTime(shopHours.close_time);
            return {
                valid: false,
                message: `This reservation would exceed closing time (${closeTime}). Please book earlier.`
            };
        }

        return { valid: true };

    } catch (error) {
        console.error('Error checking shop hours:', error);
        return {
            valid: false,
            message: 'Unable to verify shop hours. Please try again.'
        };
    }
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Master validation - runs all checks
 */
async function validateReservation(barberId, reservedDateTime) {
    console.log('🚀 STARTING VALIDATION');
    console.log('Barber ID:', barberId);
    console.log('DateTime:', reservedDateTime);

    // Check 1: Exact time slot
    const timeSlotCheck = await validateTimeSlotAvailable(barberId, reservedDateTime);
    if (!timeSlotCheck.valid) {
        console.log('❌ FAILED: Time slot check');
        return timeSlotCheck;
    }

    // Check 2: 90-minute buffer
    const bufferCheck = await validateServiceBuffer(barberId, reservedDateTime);
    if (!bufferCheck.valid) {
        console.log('❌ FAILED: Buffer check');
        return bufferCheck;
    }

    // Check 3: Shop hours
    const shopHoursCheck = await validateShopHours(reservedDateTime);
    if (!shopHoursCheck.valid) {
        console.log('❌ FAILED: Shop hours check');
        return shopHoursCheck;
    }

    console.log('✅ ALL VALIDATIONS PASSED!\n');
    return { valid: true };
}

// ========================================
// UI FUNCTIONS
// ========================================

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

/**
 * CRITICAL: Reservation submission with double validation
 */
async function handleReservationSubmit() {
    const recipientName = document.getElementById('recipientName').value.trim();
    const barberSelect = document.getElementById('barberSelect');
    const timeInput = document.getElementById('timeInput');
    const agreeCheckbox = document.getElementById('agreeTerms');

    // Basic validation
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

    // Build datetime string
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const reservedDate = `${year}-${month}-${day}`;
    const reservedDateTime = `${reservedDate}T${timeInput.value}:00`;

    console.log('\n' + '='.repeat(50));
    console.log('📝 RESERVATION SUBMISSION ATTEMPT');
    console.log('='.repeat(50));
    console.log('User:', currentUser?.email);
    console.log('Recipient:', recipientName);
    console.log('Service:', selectedBaseService?.name);
    console.log('Time input:', timeInput.value);
    console.log('DateTime string:', reservedDateTime);

    const selectedSeat = allBarbers.find(seat => seat.id == barberSelect.value);
    const barberId = selectedSeat?.barber_id;

    console.log('Selected seat:', selectedSeat);
    console.log('Barber ID:', barberId);

    if (!barberId) {
        alert('Unable to determine barber. Please try again.');
        return;
    }

    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Validating...';

    // FIRST VALIDATION
    const validation = await validateReservation(barberId, reservedDateTime);
    
    if (!validation.valid) {
        alert(validation.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Reservation';
        return;
    }

    confirmBtn.textContent = 'Creating...';

    const serviceIds = [selectedBaseService.id];
    selectedAddons.forEach(addon => {
        serviceIds.push(addon.id);
    });

    try {
        // SECOND VALIDATION (prevent race condition)
        console.log('\n🔒 FINAL VALIDATION BEFORE INSERT');
        const finalValidation = await validateReservation(barberId, reservedDateTime);
        
        if (!finalValidation.valid) {
            alert(finalValidation.message + '\n\n(Someone else just booked this time)');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Reservation';
            return;
        }

        // Create reservation
        const { data, error } = await supabase.rpc('create_multi_service_reservation', {
            p_user_id: currentUser.id,
            p_service_recipient: recipientName,
            p_service_ids: serviceIds,
            p_seat_id: parseInt(barberSelect.value),
            p_reserved_date: reservedDate,
            p_reserved_time: timeInput.value
        });

        if (error) {
            if (error.message?.includes('duplicate') || 
                error.code === '23505' || 
                error.message?.toLowerCase().includes('already booked')) {
                throw new Error('This time slot was just booked by another customer.');
            }
            throw error;
        }

        if (!data.success) {
            throw new Error(data.error || 'Failed to create reservation');
        }

        console.log('✅ RESERVATION CREATED SUCCESSFULLY!');
        console.log('='.repeat(50) + '\n');
        
        alert('Reservation created successfully!');
        window.location.href = 'reservations-list.html';

    } catch (error) {
        console.error('❌ ERROR:', error);
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
import { supabase } from './supabaseclient.js';

let todayCheckins = [];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadTodayCheckins();
});

function setupEventListeners() {
    const uidInput = document.getElementById('barberUid');
    const checkinBtn = document.getElementById('checkinBtn');

    // Only allow numeric input
    uidInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    // Allow Enter key to submit
    uidInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleCheckin();
        }
    });

    checkinBtn.addEventListener('click', handleCheckin);
}

async function handleCheckin() {
    const uidInput = document.getElementById('barberUid');
    const uid = uidInput.value.trim();
    const messageDiv = document.getElementById('message');
    const checkinBtn = document.getElementById('checkinBtn');

    // Clear previous message
    messageDiv.className = 'message';
    messageDiv.style.display = 'none';

    // Validation
    if (!uid) {
        showMessage('Please enter your UID', 'error');
        return;
    }

    if (uid.length !== 8) {
        showMessage('UID must be exactly 8 digits', 'error');
        return;
    }

    // Disable button during processing
    checkinBtn.disabled = true;
    checkinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

    try {
        // Step 1: Verify UID exists and get barber info
        const { data: barber, error: barberError } = await supabase
            .from('tbl_barbers')
            .select(`
                id,
                user_id,
                barber_uid,
                tbl_users (
                    first_name,
                    last_name
                )
            `)
            .eq('barber_uid', uid)
            .single();

        if (barberError || !barber) {
            showMessage('Invalid UID. Please check and try again.', 'error');
            checkinBtn.disabled = false;
            checkinBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Check In';
            return;
        }

        // Step 2: Check if already checked in today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingCheckin, error: checkError } = await supabase
            .from('tbl_admin_logs')
            .select('id, created_at')
            .eq('action', 'barber_attendance')
            .eq('target_id', barber.id)
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingCheckin) {
            const checkinTime = new Date(existingCheckin.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            showMessage(
                `You already checked in today at ${checkinTime}`,
                'error'
            );
            checkinBtn.disabled = false;
            checkinBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Check In';
            return;
        }

        // Step 3: Log attendance
        const { error: logError } = await supabase
            .from('tbl_admin_logs')
            .insert({
                admin_id: barber.user_id,
                action: 'barber_attendance',
                target_table: 'tbl_barbers',
                target_id: barber.id,
                details: {
                    barber_uid: uid,
                    barber_name: `${barber.tbl_users.first_name} ${barber.tbl_users.last_name}`,
                    check_in_time: new Date().toISOString()
                }
            });

        if (logError) throw logError;

        // Success!
        const barberName = `${barber.tbl_users.first_name} ${barber.tbl_users.last_name}`;
        showMessage(
            `✓ Check-in successful! Welcome, ${barberName}!`,
            'success'
        );

        // Clear input
        uidInput.value = '';

        // Reload today's check-ins
        await loadTodayCheckins();

        // Re-enable button
        checkinBtn.disabled = false;
        checkinBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Check In';

    } catch (error) {
        console.error('Check-in error:', error);
        showMessage('An error occurred. Please try again.', 'error');
        checkinBtn.disabled = false;
        checkinBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Check In';
    }
}

async function loadTodayCheckins() {
    const today = new Date().toISOString().split('T')[0];

    try {
        const { data: checkins, error } = await supabase
            .from('tbl_admin_logs')
            .select('id, created_at, details')
            .eq('action', 'barber_attendance')
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        todayCheckins = checkins || [];
        displayTodayCheckins();

    } catch (error) {
        console.error('Error loading check-ins:', error);
    }
}

function displayTodayCheckins() {
    const container = document.getElementById('recentCheckins');
    const listDiv = document.getElementById('checkinList');

    if (todayCheckins.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    listDiv.innerHTML = todayCheckins.map(checkin => {
        const time = new Date(checkin.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const barberName = checkin.details?.barber_name || 'Unknown';

        return `
            <div class="checkin-item">
                <span class="name">
                    <i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i>
                    ${barberName}
                </span>
                <span class="time">${time}</span>
            </div>
        `;
    }).join('');
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.className = `message ${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';
    
    messageDiv.innerHTML = `${icon} ${text}`;
    messageDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}
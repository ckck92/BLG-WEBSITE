import { supabase } from './supabaseclient.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupBackButton();
    await loadShopSchedule();
});

function setupBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
}

async function loadShopSchedule() {
    try {
        const { data: schedules, error } = await supabase
            .from('tbl_shop_hours')
            .select('*')
            .order('day_of_week', { ascending: true });

        if (error) throw error;

        displaySchedule(schedules);

    } catch (error) {
        console.error('Error loading shop schedule:', error);
        // Keep the static schedule as fallback
    }
}

function displaySchedule(schedules) {
    const tbody = document.querySelector('.schedule-table tbody');
    if (!tbody || !schedules || schedules.length === 0) return;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Clear existing rows except holiday row
    const holidayRow = tbody.querySelector('.holiday-row');
    tbody.innerHTML = '';

    // Create rows for each day
    schedules.forEach(schedule => {
        const row = document.createElement('tr');
        const dayName = dayNames[schedule.day_of_week];
        
        // Format times
        const openTime = formatTime(schedule.open_time);
        const closeTime = formatTime(schedule.close_time);
        
        // Check if shop is open
        const hoursText = schedule.is_open 
            ? `${openTime} - ${closeTime}`
            : 'Closed';

        row.innerHTML = `
            <td>${dayName}</td>
            <td>${hoursText}</td>
        `;
        
        tbody.appendChild(row);
    });

    // Re-add holiday row at the end
    if (holidayRow) {
        tbody.appendChild(holidayRow);
    } else {
        // Create holiday row if it doesn't exist
        const newHolidayRow = document.createElement('tr');
        newHolidayRow.className = 'holiday-row';
        newHolidayRow.innerHTML = `
        `;
        tbody.appendChild(newHolidayRow);
    }
}

function formatTime(timeString) {
    if (!timeString) return '';
    
    // timeString format is "HH:MM:SS"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const min = minutes;
    
    // Convert to 12-hour format
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    
    return `${displayHour}:${min} ${period}`;
}
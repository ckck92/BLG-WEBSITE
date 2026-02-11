import { supabase } from './supabaseclient.js';

let barbers = [];
let currentIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    setupBackButton();
    await loadBarbers();
    setupCarousel();
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

async function loadBarbers() {
    try {
        const { data: barbersData, error } = await supabase
            .from('tbl_barbers')
            .select(`
                id,
                years_of_experience,
                bio,
                is_available,
                tbl_users (
                    first_name,
                    last_name
                )
            `)
            .eq('is_available', true)
            .order('id', { ascending: true });

        if (error) throw error;

        barbers = barbersData || [];
        
        if (barbers.length > 0) {
            displayBarber(0);
        } else {
            displayNoBarbers();
        }

    } catch (error) {
        console.error('Error loading barbers:', error);
        displayError();
    }
}

function displayBarber(index) {
    if (!barbers || barbers.length === 0) return;
    
    currentIndex = index;
    const barber = barbers[index];
    
    // Get barber name
    const firstName = barber.tbl_users?.first_name || 'Unknown';
    const lastName = barber.tbl_users?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    // Update description
    const descContainer = document.getElementById('crew-desc');
    if (descContainer) {
        let description = `<strong>${fullName}</strong><br>`;
        description += `<em>${barber.years_of_experience || 0} years of experience</em><br><br>`;
        description += barber.bio || 'Professional barber dedicated to providing quality haircuts and grooming services.';
        descContainer.innerHTML = description;
    }

    // Update navigation buttons
    updateNavigationButtons();
}

function displayNoBarbers() {
    const descContainer = document.getElementById('crew-desc');
    if (descContainer) {
        descContainer.innerHTML = '<p style="text-align: center; color: #666;">No barbers available at this time.</p>';
    }
    
    const schedContainer = document.getElementById('crew-sched');
    if (schedContainer) {
        schedContainer.innerHTML = '';
    }
    
    // Disable navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.3';
    }
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.3';
    }
}

function displayError() {
    const descContainer = document.getElementById('crew-desc');
    if (descContainer) {
        descContainer.innerHTML = '<p style="text-align: center; color: #ef4444;">Error loading barber information. Please try again later.</p>';
    }
    
    const schedContainer = document.getElementById('crew-sched');
    if (schedContainer) {
        schedContainer.innerHTML = '';
    }
}

function setupCarousel() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                displayBarber(currentIndex - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIndex < barbers.length - 1) {
                displayBarber(currentIndex + 1);
            }
        });
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Update previous button
    if (prevBtn) {
        if (currentIndex === 0) {
            prevBtn.disabled = true;
            prevBtn.style.opacity = '0.3';
            prevBtn.style.cursor = 'not-allowed';
        } else {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
            prevBtn.style.cursor = 'pointer';
        }
    }
    
    // Update next button
    if (nextBtn) {
        if (currentIndex === barbers.length - 1) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.3';
            nextBtn.style.cursor = 'not-allowed';
        } else {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
        }
    }
}
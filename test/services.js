import { supabase } from './supabaseclient.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupBackButton();
    await loadServices();
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

async function loadServices() {
    try {
        const { data: services, error } = await supabase
            .from('tbl_services')
            .select('*')
            .order('price', { ascending: true });

        if (error) throw error;

        displayServices(services);

    } catch (error) {
        console.error('Error loading services:', error);
        // Keep static services as fallback
    }
}

function displayServices(services) {
    if (!services || services.length === 0) return;

    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;

    // Group services by type
    const generalServices = services.filter(s => s.service_type === 'general' && s.can_be_base);
    const modernCutServices = services.filter(s => s.service_type === 'modern_cut');
    const bossingServices = services.filter(s => s.service_type === 'bossing' && s.can_be_base);
    const addons = services.filter(s => s.service_type === 'addon' || !s.can_be_base);

    // Clear existing content
    gridContainer.innerHTML = '';

    // General Column - COMPACT VERSION
    if (generalServices.length > 0) {
        const generalCol = createCompactServiceColumn(
            'General',
            'Essential for every bossing',
            generalServices
        );
        gridContainer.appendChild(generalCol);
    }

    // Modern Cut Column
    if (modernCutServices.length > 0) {
        const modernCol = createModernCutColumn(modernCutServices);
        gridContainer.appendChild(modernCol);
    }

    // Premium Packages (Bossing) Column
    if (bossingServices.length > 0) {
        const bossingCol = createServiceColumn(
            'Premium Packages',
            'The full bossing experience',
            bossingServices,
            true // Show included addons
        );
        gridContainer.appendChild(bossingCol);
    }

    // Add-ons Column - LIMITED TO 3 + "See All" LINK
    if (addons.length > 0) {
        const addonsCol = createAddonsColumn(addons);
        gridContainer.appendChild(addonsCol);
    }
}

// COMPACT SERVICE COLUMN for General Services
function createCompactServiceColumn(title, description, services) {
    const col = document.createElement('div');
    col.className = 'col';

    let cardsHTML = '';
    services.forEach(service => {
        cardsHTML += `
            <div class="card compact">
                <div class="card-header compact-header">
                    <span class="service-name compact-name">${service.name}</span>
                    <span class="service-price compact-price">₱${service.price}</span>
                </div>
                ${service.description ? `<p class="service-desc compact-desc">${service.description}</p>` : ''}
            </div>
        `;
    });

    col.innerHTML = `
        <div class="column-header">
            <h2>${title}</h2>
            <p>${description}</p>
        </div>
        ${cardsHTML}
    `;

    return col;
}

// REGULAR SERVICE COLUMN
function createServiceColumn(title, description, services, showIncluded = false) {
    const col = document.createElement('div');
    col.className = 'col';

    let cardsHTML = '';
    services.forEach(service => {
        let content = '';
        
        if (service.description && !showIncluded) {
            content = `<p class="service-desc">${service.description}</p>`;
        }
        
        if (showIncluded && service.included_addons && service.included_addons.length > 0) {
            content = `<p class="service-desc">${service.included_addons.join(' + ')}</p>`;
        }

        cardsHTML += `
            <div class="card">
                <div class="card-header">
                    <span class="service-name">${service.name}</span>
                    <span class="service-price">₱${service.price}</span>
                </div>
                ${content}
            </div>
        `;
    });

    col.innerHTML = `
        <div class="column-header">
            <h2>${title}</h2>
            <p>${description}</p>
        </div>
        ${cardsHTML}
    `;

    return col;
}

// MODERN CUT COLUMN
function createModernCutColumn(services) {
    const col = document.createElement('div');
    col.className = 'col';

    const modernCut = services[0]; // Assuming there's one Modern Cut service
    
    col.innerHTML = `
        <div class="column-header">
            <h2>Modern Cut</h2>
            <p>Custom contemporary styles</p>
        </div>
        <div class="card">
            <div class="card-header">
                <span class="service-name">${modernCut.name}</span>
                <span class="service-price">₱${modernCut.price}</span>
            </div>
            <ul class="list-items">
                <li>Mullet</li>
                <li>Pompadour</li>
                <li>Wolf Cut</li>
                <li>Curtain Cut</li>
                <li>Edgar Cut</li>
            </ul>
        </div>
    `;

    return col;
}

// ADD-ONS COLUMN - LIMITED TO 3 + "See All" LINK
function createAddonsColumn(addons) {
    const col = document.createElement('div');
    col.className = 'col';

    // Show only first 3 add-ons
    const displayAddons = addons.slice(0, 3);
    const hasMore = addons.length > 3;

    let cardsHTML = '';
    displayAddons.forEach(service => {
        cardsHTML += `
            <div class="card">
                <div class="card-header">
                    <span class="service-name">${service.name}</span>
                    <span class="service-price">₱${service.price}</span>
                </div>
                ${service.description ? `<p class="service-desc">${service.description}</p>` : ''}
            </div>
        `;
    });

    // Add "See All Add-Ons" card if there are more than 3
    if (hasMore) {
        cardsHTML += `
            <div class="card see-all-card" onclick="showAllAddons()">
                <div class="see-all-content">
                    <i class="fas fa-plus-circle"></i>
                    <span>Click here to see all Add-Ons services</span>
                </div>
            </div>
        `;
    }

    col.innerHTML = `
        <div class="column-header">
            <h2>Add-ons</h2>
            <p>Finishing touches</p>
        </div>
        ${cardsHTML}
    `;

    return col;
}

// Show all add-ons in modal
window.showAllAddons = async function() {
    try {
        const { data: addons, error } = await supabase
            .from('tbl_services')
            .select('*')
            .eq('service_type', 'addon')
            .order('price', { ascending: true });

        if (error) throw error;

        displayAddonsModal(addons);

    } catch (error) {
        console.error('Error loading all add-ons:', error);
        alert('Failed to load add-ons. Please try again.');
    }
}

function displayAddonsModal(addons) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'addons-modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };

    let addonsHTML = '';
    addons.forEach(addon => {
        addonsHTML += `
            <div class="addon-item">
                <div class="addon-info">
                    <span class="addon-name">${addon.name}</span>
                    ${addon.description ? `<p class="addon-desc">${addon.description}</p>` : ''}
                </div>
                <span class="addon-price">₱${addon.price}</span>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="addons-modal-content">
            <div class="addons-modal-header">
                <h2>All Add-On Services</h2>
                <button class="modal-close-btn" onclick="this.closest('.addons-modal-overlay').remove()">✕</button>
            </div>
            <div class="addons-modal-body">
                ${addonsHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Add CSS for compact cards and modal
const style = document.createElement('style');
style.textContent = `
    /* Compact General Services */
    .card.compact {
        padding: 12px 16px;
        margin-bottom: 10px;
    }

    .card-header.compact-header {
        margin-bottom: 6px;
    }

    .service-name.compact-name {
        font-size: 0.95rem;
    }

    .service-price.compact-price {
        font-size: 0.9rem;
    }

    .service-desc.compact-desc {
        font-size: 0.85rem;
        line-height: 1.3;
        margin: 0;
    }

    /* See All Card */
    .see-all-card {
        background: linear-gradient(135deg, #4a2c0a 0%, #6d4a2a 100%);
        cursor: pointer;
        transition: all 0.3s;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 80px;
    }

    .see-all-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(74, 44, 10, 0.3);
    }

    .see-all-content {
        text-align: center;
        color: white;
    }

    .see-all-content i {
        font-size: 2rem;
        display: block;
        margin-bottom: 8px;
    }

    .see-all-content span {
        font-size: 0.9rem;
        font-weight: 600;
    }

    /* Add-ons Modal */
    .addons-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    }

    .addons-modal-content {
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .addons-modal-header {
        padding: 20px 24px;
        border-bottom: 2px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .addons-modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #4a2c0a;
    }

    .modal-close-btn {
        background: none;
        border: none;
        font-size: 1.8rem;
        color: #666;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
    }

    .modal-close-btn:hover {
        background: #f0f0f0;
        color: #333;
    }

    .addons-modal-body {
        padding: 24px;
        overflow-y: auto;
    }

    .addon-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px;
        border-bottom: 1px solid #eee;
        gap: 16px;
    }

    .addon-item:last-child {
        border-bottom: none;
    }

    .addon-info {
        flex: 1;
    }

    .addon-name {
        font-weight: 700;
        font-size: 1.05rem;
        color: #2c1810;
        display: block;
        margin-bottom: 4px;
    }

    .addon-desc {
        font-size: 0.9rem;
        color: #666;
        margin: 0;
    }

    .addon-price {
        font-weight: 700;
        font-size: 1.1rem;
        color: #4a2c0a;
        white-space: nowrap;
    }
`;
document.head.appendChild(style);
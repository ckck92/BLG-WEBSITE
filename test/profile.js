document.addEventListener('DOMContentLoaded', () => {

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'dashboard.html';
        });
    }

    const profileHeader = document.getElementById('profileHeader');
    const details = document.getElementById('details');
    const arrow = document.getElementById('arrow');

    if (profileHeader && details && arrow) {
        profileHeader.addEventListener('click', () => {
            if (details.style.display === "none") {
                details.style.display = "block";
                arrow.style.transform = "rotate(0deg)";
            } else {
                details.style.display = "none";
                arrow.style.transform = "rotate(180deg)";
            }
        });
    }

    const modal = document.getElementById('modalOverlay');
    const openBtn = document.getElementById('openEditModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const editForm = document.getElementById('editForm');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    };

    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert("Profile updated successfully!");
            closeModal();
        });
    }
});
    document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');

    if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'dashboard.html';
            });
        }
    });
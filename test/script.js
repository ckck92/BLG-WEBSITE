document.addEventListener('DOMContentLoaded', () => {
    console.log("Boss Lupit Gupit Welcome Page Loaded");

    const heroImage = document.querySelector('.hero-image');
    
    if(heroImage) {
        heroImage.addEventListener('mouseover', () => {
            heroImage.style.transform = "scale(1.05)";
            heroImage.style.transition = "transform 0.3s ease";
        });

        heroImage.addEventListener('mouseout', () => {
            heroImage.style.transform = "scale(1)";
        });
    }

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log(`Navigating to: ${btn.getAttribute('href')}`);
        });
    });
});
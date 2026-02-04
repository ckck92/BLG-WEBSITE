document.addEventListener('DOMContentLoaded', () => {
    console.log("Boss Lupit Gupit - About Us Page Loaded");

    const paragraphs = document.querySelectorAll('.text-content p');
    
    paragraphs.forEach((p, index) => {
        p.style.opacity = '0';
        p.style.transform = 'translateY(10px)';
        p.style.transition = `opacity 0.5s ease ${index * 0.2}s, transform 0.5s ease ${index * 0.2}s`;
        
        setTimeout(() => {
            p.style.opacity = '1';
            p.style.transform = 'translateY(0)';
        }, 300); 
    });
});
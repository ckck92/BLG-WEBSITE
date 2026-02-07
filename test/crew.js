document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'dashboard.html';
        });
    }

    const crewMembers = [
        {
            name: "Mark Watson",
            img: "barber1.jpg", 
            desc: "I'm Mark Watson. I've been a barber for 15 years and currently in a decade long run here at Boss Lupit Gupit. I'm open to any fun conversations, give fun facts, and answer inquiries while I give any barbershop-related service.",
            sched: "Monday - Friday: 9:00 AM - 6:00 PM"
        },
        {
            name: "Steve Manchester",
            img: "barber2.jpg", 
            desc: "I'm Steve Manchester. I specialize in modern fades and grooming. I love creating sharp, clean looks that fit my clients' lifestyles. Come by for a fresh cut and a great chat!",
            sched: "Wednesday - Sunday: 10:00 AM - 7:00 PM"
        },

        {
            name: "Charles Lincoln",
            img: "barber3.jpg", 
            desc: "I'm Charles Lincoln. I specialize in classic cuts and traditional styling. I bring a personal touch to every client, ensuring a perfect fit for their style and personality.",
            sched: "Tuesday - Saturday: 9:00 AM - 6:00 PM"
        }
    ];

    let currentIndex = 0;

    function updateDisplay() {
        const img = document.getElementById('crew-img');
        const bioContainer = document.getElementById('crew-bio-container');
        const desc = document.getElementById('crew-desc');
        const sched = document.getElementById('crew-sched');

        if (!img || !bioContainer) return;

        img.style.opacity = 0;
        bioContainer.style.opacity = 0;

        setTimeout(() => {
            const member = crewMembers[currentIndex];
            img.src = member.img;
            img.alt = member.name;
            desc.innerText = member.desc;
            sched.innerText = member.sched;
            img.style.opacity = 1;
            bioContainer.style.opacity = 1;
        }, 300);
    }

    function changeCrew(direction) {
        currentIndex += direction;
        if (currentIndex >= crewMembers.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = crewMembers.length - 1;
        updateDisplay();
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) prevBtn.addEventListener('click', () => changeCrew(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeCrew(1));

    updateDisplay();
});
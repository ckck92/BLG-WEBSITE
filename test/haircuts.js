document.addEventListener('DOMContentLoaded', () => {

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'dashboard.html';
        });
    }

    const haircutData = {
        "Round": [
            { name: "Pompadour", img: "round-haircut.png", desc: "Adds vertical volume to balance the circular face shape and create a longer profile." },
            { name: "High Fade", img: "round-haircut.png", desc: "Keeping the sides short and the top long helps elongate the face visually." }
        ],
        "Long": [
            { name: "Buzz Cut", img: "long-haircut.png", desc: "Highlights your strong jawline and masculine features perfectly." },
            { name: "Side Part", img: "long-haircut.png", desc: "Softens the corners of a square face while maintaining a sharp look." }
        ],
        "Oval": [
            { name: "Burst Fade", img: "oval-haircut.png", desc: "Highlights your symmetrical features with a clean, modern taper." },
            { name: "Side Part", img: "oval-haircut.png", desc: "Provides a balanced look that suits the natural proportions of an oval face." }
        ],
        "Square": [
            { name: "Buzz Cut", img: "square-haircut.png", desc: "Highlights your strong jawline and masculine features perfectly." },
            { name: "Side Part", img: "square-haircut.png", desc: "Softens the corners of a square face while maintaining a sharp look." }
        ],
        "Heart": [
            { name: "Messy Fringe", img: "heart-haircut.png", desc: "Balances a wider forehead by adding texture and volume near the temples." },
            { name: "Longer Layers", img: "heart-haircut.png", desc: "Adds width to the lower half of the face to match a broader forehead." }
        ],
        "Diamond": [
            { name: "Fringe Up", img: "diamond-haircut.png", desc: "Softens sharp cheekbones while adding volume to the top of the head." },
            { name: "Textured Crop", img: "diamond-haircut.png", desc: "Adds width at the forehead and chin to balance prominent cheekbones." }
        ],
        "Triangle": [
            { name: "Textured Quiff", img: "triangle-haircut.png", desc: "Adds volume to the top of the head to balance a wider jawline." },
            { name: "Side Part", img: "triangle-haircut.png", desc: "Creates a classic silhouette that draws attention upward from the jaw." }
        ]
    };

    const modal = document.getElementById('haircutModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBodyContent');
    const cards = document.querySelectorAll('.shape-card');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const shape = card.querySelector('span').innerText;
            modalTitle.innerText = `Recommended Haircuts For ${shape} Face Shape`;
            
            const options = haircutData[shape] || [];

            if (options.length === 0) {
                modalBody.innerHTML = "<p style='text-align:center; width:100%;'>No recommendations found.</p>";
            } else {
                modalBody.innerHTML = options.map(opt => `
                    <div class="haircut-option">
                        <div class="img-holder">
                            <img src="${opt.img}" alt="${opt.name}">
                        </div>
                        <h3>${opt.name}</h3>
                        <p>
                            <span class="why-title">Why choose this haircut?</span>
                            "${opt.desc}"
                        </p>
                    </div>
                `).join('');
            }

            modal.style.display = 'flex';
        });
    });

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
});
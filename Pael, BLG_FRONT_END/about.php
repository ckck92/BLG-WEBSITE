<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boss Lupit Gupit - About Us</title>
    <style>
        /* --- Reuse Base Styles for Consistency --- */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: #F6EADD; /* Light beige background */
            color: #4A2C10;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow-x: hidden;
        }

        /* --- Header (Same as Landing Page) --- */
        header {
            background-color: #6D3B0E;
            padding: 15px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            z-index: 10;
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 15px;
            text-decoration: none;
        }

        .logo-img {
            height: 40px;
            object-fit: contain;
        }

        .brand-name {
            color: white;
            font-weight: 800;
            font-size: 1.2rem;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .auth-container {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: white;
            font-weight: 500;
            transition: opacity 0.3s;
        }

        .auth-container:hover {
            opacity: 0.8;
        }

        .user-icon {
            width: 32px;
            height: 32px;
            background-color: white;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .user-icon svg {
            width: 20px;
            height: 20px;
            fill: #6D3B0E;
        }

        /* --- About Us Specific Content --- */
        main {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 80px;
            z-index: 5;
        }

        .content-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 60px; /* Space between image and text */
            max-width: 1200px;
            width: 100%;
        }

        /* Left Side Image */
        .about-image {
            width: 300px; /* Adjust based on preference */
            transform: rotate(-15deg); /* Slight tilt to match design style */
        }

        /* Right Side Text Content */
        .text-content {
            flex: 1;
            max-width: 600px;
            text-align: left;
        }

        h1 {
            font-size: 3rem;
            font-weight: 800;
            color: #6D3B0E;
            margin-bottom: 30px;
            text-transform: uppercase;
            text-align: center; /* Center the title relative to text block */
        }

        p {
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 25px;
            color: #231205;
            text-align: justify;
        }

        /* Centering the Register button under the text */
        .btn-container {
            display: flex;
            justify-content: center;
            margin-top: 10px;
        }

        .btn {
            background-color: #7B5E2C;
            color: white;
            border: none;
            padding: 12px 50px;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 25px;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.2s, background-color 0.2s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            display: inline-block;
        }

        .btn:hover {
            background-color: #5e451e;
            transform: translateY(-2px);
        }

        /* --- Background Decorations --- */
        .bg-deco-left {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 30vw;
            max-width: 400px;
            z-index: 1;
            pointer-events: none;
        }

        .bg-deco-right {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 30vw;
            max-width: 400px;
            z-index: 1;
            pointer-events: none;
        }
        
        /* Responsive adjustments */
        @media (max-width: 900px) {
            .content-wrapper {
                flex-direction: column;
                text-align: center;
            }
            .text-content {
                text-align: center;
            }
            .about-image {
                width: 200px;
                margin-bottom: 20px;
            }
        }
    </style>
</head>
<body>

    <header>
        <a href="landing_page.php" class="logo-container">
            <img src="R2.png" alt="BLG Logo" class="logo-img">
            <span class="brand-name">Boss Lupit Gupit</span>
        </a>

        <a href="login.php" class="auth-container">
            <span>Sign In</span>
            <div class="user-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
        </a>
    </header>

    <main>
        <div class="content-wrapper">
            <img src="R5.png" alt="Barber Tools" class="about-image">

            <div class="text-content">
                <h1>About Us</h1>
                
                <p>
                    Apart from the standard barbershop services we offer, we believe that the act 
                    of self-care is only getting more important. Through years of service, we have 
                    collected valuable feedback and data from customers interested and have in 
                    self-care.
                </p>

                <p>
                    In return, we provide back to customers by giving valuable self-care guidance to 
                    our customers in each barbershop session. We do this because we value every 
                    customer that trusts us our service. With trust, we do everything in our hands to 
                    provide satisfactory service, boost customer confidence, and make you 
                    interested in the self-care journey with proper guidance.
                </p>

                <div class="btn-container">
                    <a href="register.php" class="btn">Register</a>
                </div>
            </div>
        </div>
    </main>

    <img src="R10.png" alt="Decoration" class="bg-deco-left">
    <img src="R11.png" alt="Decoration" class="bg-deco-right">

</body>
</html>
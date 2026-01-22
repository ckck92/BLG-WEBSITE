<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boss Lupit Gupit - Welcome</title>
    <style>
        /* Reset and Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: #F6EADD; /* Light beige from blueprint */
            color: #4A2C10; /* Dark brown text */
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden; /* Prevent scroll from background images */
            position: relative;
        }

        /* Header Styles */
        header {
            background-color: #6D3B0E; /* Dark brown header */
            padding: 15px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            z-index: 10; /* Keep header above background images */
        }

        .logo-container {
            display: flex;
            align-items: center;
            gap: 15px;
            text-decoration: none;
        }

        .logo-img {
            height: 40px; /* Adjust based on R2 actual size */
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

        /* Main Content Styles */
        main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding-bottom: 80px; /* Space for footer graphics */
            z-index: 5; /* Above background graphics */
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 20px;
            color: #5C330A;
        }

        .hero-image {
            width: 300px; /* Adjust size of R1 to match blueprint */
            max-width: 100%;
            margin-bottom: 20px;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
        }

        .tagline {
            font-size: 1.2rem;
            margin-bottom: 30px;
            color: #231205;
        }

        /* Button Styles */
        .button-group {
            display: flex;
            gap: 20px;
        }

        .btn {
            background-color: #7B5E2C; /* Button brown */
            color: white;
            border: none;
            padding: 12px 40px;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 25px;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.2s, background-color 0.2s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }

        .btn:hover {
            background-color: #5e451e;
            transform: translateY(-2px);
        }

        /* Background Decorations (R10 and R11) */
        .bg-deco-left {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 30vw; /* Adjust scale */
            max-width: 400px;
            z-index: 1;
            pointer-events: none; /* Let clicks pass through if needed */
        }

        .bg-deco-right {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 30vw; /* Adjust scale */
            max-width: 400px;
            z-index: 1;
            pointer-events: none;
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
        <h1>Welcome!</h1>
        
        <img src="R1.png" alt="Barber Tools" class="hero-image">
        
        <p class="tagline">Join in the moment of quality services and self-care!</p>

        <div class="button-group">
            <a href="register.php" class="btn">Register</a>
            <a href="about.php" class="btn">About Us</a>
        </div>
    </main>

    <img src="R10.png" alt="Decoration" class="bg-deco-left">
    
    <img src="R11.png" alt="Decoration" class="bg-deco-right">

</body>
</html>
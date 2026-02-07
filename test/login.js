import { supabase } from './supabaseclient.js';

console.log('Login.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }
    
    console.log('Login form found');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';
        
        try {
            console.log('Signing in...');
            
            // Sign in
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            console.log('Sign in successful');
            console.log('User:', data.user);
            
            // Check if email is verified (optional - remove if email verification is disabled)
            if (!data.user.email_confirmed_at) {
                console.log('Email not verified');
                alert('Please verify your email before logging in. Check your inbox!');
                await supabase.auth.signOut();
                window.location.href = `verify-prompt.html?email=${encodeURIComponent(email)}`;
                return;
            }
            
            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('tbl_users')
                .select('*')
                .eq('id', data.user.id)
                .single();
            
            if (profileError) throw profileError;
            
            console.log('Profile loaded:', profile);
            
            // Store user info in localStorage
            localStorage.setItem('currentUser', JSON.stringify(profile));
            
            // Redirect based on role
            if (profile.role === 'admin') {
                console.log('Redirecting to admin dashboard');
                window.location.href = 'admin-dashboard.html'; // Admin dashboard
            } else if (profile.role === 'barber') {
                alert('Barbers should use the Android app');
                await supabase.auth.signOut();
            } else if (profile.role === 'client') {
                console.log('Redirecting to client dashboard');
                window.location.href = 'dashboard.html'; // Client dashboard
            }
            
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

        // Password Toggle Logic
        document.getElementById('togglePassword').addEventListener('click', function() {
            const pwd = document.getElementById('password');
            const type = pwd.getAttribute('type') === 'password' ? 'text' : 'password';
            pwd.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });

        document.getElementById('toggleConfirmPassword').addEventListener('click', function() {
            const cpwd = document.getElementById('confirmPassword');
            const type = cpwd.getAttribute('type') === 'password' ? 'text' : 'password';
            cpwd.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
});
import { supabase } from './supabaseclient.js';
console.log('Register.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    
    if (!registerForm) {
        console.error('Form not found');
        return;
    }
    
    console.log('Form found');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submitted');
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const contactNumber = document.getElementById('contactNumber').value;
        const birthDate = document.getElementById('birthDate').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        
        // Age validation
        const age = Math.floor((new Date() - new Date(birthDate)) / 31557600000);
        if (age < 18) {
            alert("You must be 18 or older to register");
            return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const role = urlParams.get('role') || 'client';
        console.log('Registering with role:', role);
        
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        try {
            console.log('Creating auth user...');
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password
            });
            
            if (authError) throw authError;
            
            console.log('Auth user created:', authData.user.id);
            
            if (!authData.session) {
                console.log('No session after signup. Signing in manually...');
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                if (signInError) throw signInError;
                console.log('Manual sign-in successful');
            }
            
            console.log('📤 Inserting profile into tbl_users...');
            const { error: profileError } = await supabase
                .from('tbl_users')
                .insert([{
                    id: authData.user.id,
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    contact_number: contactNumber,
                    birth_date: birthDate,
                    role: role,
                    is_walk_in: false
                }]);
            
            if (profileError) throw profileError;
            
            // If registering as barber, also insert into tbl_barbers
            if (role === 'barber') {
                console.log('Inserting into tbl_barbers...');
                const { error: barberError } = await supabase
                    .from('tbl_barbers')
                    .insert([{
                        user_id: authData.user.id,
                        years_of_experience: 1,
                        is_available: true,
                        bio: firstName + ' ' + lastName + ' - Barber at Boss Lupit Gupit'
                    }]);
                if (barberError) throw barberError;
                console.log('Barber profile created');
            }
            
            console.log('Profile inserted successfully!');
            
            await supabase.auth.signOut();
            
            localStorage.setItem('pendingEmail', email);
            
            // Skip verification prompt if admin or barber (for testing speed)
            if (role !== 'client') {
                alert(`${role} account created! You can now login.`);
                window.location.href = 'login.html';
            } else {
                alert("Registration successful! Please check your email to verify your account.");
                window.location.href = `verify-prompt.html?email=${encodeURIComponent(email)}`;
            }
            
        } catch (error) {
            console.error('ERROR:', error);
            alert('Registration failed: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Get Started';
        }
    });
});
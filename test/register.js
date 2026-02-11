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
        
        // Get form values
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const contactNumber = document.getElementById('contactNumber').value.trim();
        const birthDate = document.getElementById('birthDate').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // ===== VALIDATION =====
        
        // 1. Check required fields
        if (!firstName || !lastName || !email || !contactNumber || !birthDate || !password || !confirmPassword) {
            alert("Please fill in all fields");
            return;
        }
        
        // 2. Validate name (letters only, 2-50 chars)
        const nameRegex = /^[a-zA-Z\s]{2,50}$/;
        if (!nameRegex.test(firstName)) {
            alert("First name must be 2-50 letters only");
            return;
        }
        if (!nameRegex.test(lastName)) {
            alert("Last name must be 2-50 letters only");
            return;
        }
        
        // 3. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Please enter a valid email address");
            return;
        }
        
        // 4. Validate contact number (PH format: 09XXXXXXXXX or +639XXXXXXXXX)
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phoneRegex.test(contactNumber.replace(/\s|-/g, ''))) {
            alert("Please enter a valid Philippine mobile number (e.g., 09171234567)");
            return;
        }
        
        // 5. Validate password length
        if (password.length < 8) {
            alert("Password must be at least 8 characters long");
            return;
        }
        
        // 6. Validate password strength
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumber) {
            alert("Password must contain:\n• At least one uppercase letter\n• At least one lowercase letter\n• At least one number");
            return;
        }
        
        // 7. Check password match
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        
        // 8. Validate age (18+)
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        if (age < 18) {
            alert("You must be at least 18 years old to register");
            return;
        }
        
        if (age > 120) {
            alert("Please enter a valid birth date");
            return;
        }
        
        // Check for role parameter (for admin creating barber accounts)
        const urlParams = new URLSearchParams(window.location.search);
        const role = urlParams.get('role') || 'client';
        console.log('Registering with role:', role);
        
        // Disable submit button
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        try {
            console.log('Creating auth user...');
            
            // Create authentication user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName
                    }
                }
            });
            
            if (authError) {
                console.error('Auth error:', authError);
                throw authError;
            }
            
            if (!authData.user) {
                throw new Error('No user returned from signup');
            }
            
            console.log('Auth user created:', authData.user.id);
            
            // If no session, sign in manually
            if (!authData.session) {
                console.log('No session, signing in manually...');
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (signInError) {
                    console.warn('Manual sign-in failed:', signInError.message);
                }
            }
            
            // Create user profile
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
            
            if (profileError) {
                console.error('Profile error:', profileError);
                throw profileError;
            }
            
            console.log('Profile created successfully');
            
            // If registering as barber, create barber profile
            if (role === 'barber') {
                console.log('📤 Creating barber profile...');
                const { error: barberError } = await supabase
                    .from('tbl_barbers')
                    .insert([{
                        user_id: authData.user.id,
                        years_of_experience: 1,
                        is_available: true,
                        bio: `${firstName} ${lastName} - Barber at Boss Lupit Gupit`
                    }]);
                
                if (barberError) {
                    console.error('Barber profile error:', barberError);
                    throw barberError;
                }
                
            }
            
            // Sign out after registration
            await supabase.auth.signOut();
            
            // Store email for verification page
            localStorage.setItem('pendingEmail', email);
            
            // Redirect based on role
            if (role === 'client') {
                alert("Registration successful! Please check your email to verify your account.");
                window.location.href = `verify-prompt.html?email=${encodeURIComponent(email)}`;
            } else {
                alert(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully! You can now login.`);
                window.location.href = 'login.html';
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            
            // User-friendly error messages
            let errorMessage = 'Registration failed: ';
            
            if (error.message.includes('duplicate key') || error.message.includes('already registered')) {
                errorMessage = 'This email is already registered. Please use a different email or try logging in.';
            } else if (error.message.includes('invalid email')) {
                errorMessage = 'Invalid email address format';
            } else if (error.message.includes('weak password')) {
                errorMessage = 'Password is too weak. Please use a stronger password.';
            } else {
                errorMessage += error.message;
            }
            
            alert(errorMessage);
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Real-time validation feedback (optional but recommended)
    setupRealtimeValidation();
});

function setupRealtimeValidation() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('email');
    const contactNumber = document.getElementById('contactNumber');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    
    // Name validation
    [firstName, lastName].forEach(input => {
        if (input) {
            input.addEventListener('blur', function() {
                const nameRegex = /^[a-zA-Z\s]{2,50}$/;
                if (this.value && !nameRegex.test(this.value)) {
                    this.style.borderColor = '#dc3545';
                } else {
                    this.style.borderColor = '';
                }
            });
        }
    });
    
    // Email validation
    if (email) {
        email.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !emailRegex.test(this.value)) {
                this.style.borderColor = '#dc3545';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Phone validation
    if (contactNumber) {
        contactNumber.addEventListener('blur', function() {
            const phoneRegex = /^(09|\+639)\d{9}$/;
            if (this.value && !phoneRegex.test(this.value.replace(/\s|-/g, ''))) {
                this.style.borderColor = '#dc3545';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Password match validation
    if (confirmPassword) {
        confirmPassword.addEventListener('input', function() {
            if (this.value && password.value && this.value !== password.value) {
                this.style.borderColor = '#dc3545';
            } else {
                this.style.borderColor = '';
            }
        });
    }
}
import { supabase } from '../test/supabaseclient.js';

/**
 * Get services grouped by type with selection rules
 * @returns {Object} Services grouped by category with metadata
 */
export async function getServicesForSelection() {
    try {
        const { data, error } = await supabase
            .from('tbl_services')
            .select('*')
            .eq('is_active', true)
            .order('category', { ascending: true })
            .order('price', { ascending: true });
        
        if (error) throw error;
        
        // Group by service type
        const grouped = {
            general: [],
            modern_cut: [],
            bossing: [],
            addons: []
        };
        
        data.forEach(service => {
            const type = service.service_type;
            if (type === 'general') grouped.general.push(service);
            else if (type === 'modern_cut') grouped.modern_cut.push(service);
            else if (type === 'bossing') grouped.bossing.push(service);
            else if (type === 'addon') grouped.addons.push(service);
        });
        
        return grouped;
    } catch (error) {
        console.error('Error fetching services:', error);
        return { general: [], modern_cut: [], bossing: [], addons: [] };
    }
}

/**
 * Validate service combination before creating reservation
 * @param {Array<number>} serviceIds - Array of selected service IDs
 * @returns {Object} Validation result
 */
export async function validateServiceCombination(serviceIds) {
    try {
        const { data, error } = await supabase
            .rpc('validate_service_combination', {
                p_service_ids: serviceIds
            });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error validating services:', error);
        return {
            valid: false,
            error: error.message
        };
    }
}

/**
 * Client-side service validation rules
 * @param {Array} selectedServices - Array of service objects
 * @returns {Object} Validation result with details
 */
export function validateServicesClientSide(selectedServices) {
    if (selectedServices.length === 0) {
        return {
            valid: false,
            error: 'Please select at least one service'
        };
    }
    
    // Separate base and add-on services
    const baseServices = selectedServices.filter(s => s.can_be_base);
    const addons = selectedServices.filter(s => !s.can_be_base);
    
    // Must have exactly one base service
    if (baseServices.length === 0) {
        return {
            valid: false,
            error: 'Please select a base service (General, Modern Cut, or Bossing)'
        };
    }
    
    if (baseServices.length > 1) {
        return {
            valid: false,
            error: 'Can only select one base service'
        };
    }
    
    const baseService = baseServices[0];
    
    // Bossing services cannot have add-ons
    if (baseService.service_type === 'bossing' && addons.length > 0) {
        return {
            valid: false,
            error: 'Bossing services are premium packages and cannot be combined with add-ons'
        };
    }
    
    // Check if any add-ons are already included
    if (baseService.included_addons && addons.length > 0) {
        for (const addon of addons) {
            if (baseService.included_addons.includes(addon.name)) {
                return {
                    valid: false,
                    error: `"${addon.name}" is already included in ${baseService.name}`
                };
            }
        }
    }
    
    // Calculate totals
    const totalPrice = selectedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
    
    return {
        valid: true,
        baseService: baseService,
        addons: addons,
        totalPrice: totalPrice.toFixed(2),
        totalDuration: totalDuration
    };
}

/**
 * Get shop hours for all days
 * @returns {Array} Shop hours by day
 */
export async function getShopHours() {
    try {
        const { data, error } = await supabase
            .from('tbl_shop_hours')
            .select('*')
            .order('day_of_week', { ascending: true });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching shop hours:', error);
        return [];
    }
}

/**
 * Check if date/time is within shop hours
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @returns {boolean} True if within hours
 */
export async function isWithinShopHours(date, time) {
    try {
        const datetime = `${date}T${time}:00+08:00`;
        
        const { data, error } = await supabase
            .rpc('is_within_shop_hours', {
                p_datetime: datetime
            });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error checking shop hours:', error);
        return false;
    }
}

/**
 * Get available time slots for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Array} Available time slots
 */
export async function getAvailableTimeSlots(date) {
    try {
        // Get shop hours for this day
        const [year, month, day] = date.split('-').map(Number);
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        
        const { data: shopHours } = await supabase
            .from('tbl_shop_hours')
            .select('*')
            .eq('day_of_week', dayOfWeek)
            .single();
        
        if (!shopHours || !shopHours.is_open) {
            return [];
        }
        
        // Generate 90-minute time slots
        const slots = [];
        const openTime = shopHours.open_time;
        const closeTime = shopHours.close_time;
        
        let currentTime = openTime;
        
        while (currentTime < closeTime) {
            // Check if this slot has available seats
            const available = await getAvailableSeats(date, currentTime);
            
            if (available.length > 0) {
                slots.push({
                    time: currentTime,
                    availableSeats: available.length
                });
            }
            
            // Add 90 minutes
            const [hours, minutes] = currentTime.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes + 90;
            const newHours = Math.floor(totalMinutes / 60);
            const newMinutes = totalMinutes % 60;
            currentTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`;
        }
        
        return slots;
    } catch (error) {
        console.error('Error getting time slots:', error);
        return [];
    }
}

/**
 * Get seats with assigned barbers
 * @returns {Array} Seats with barber details
 */
export async function getSeatsWithBarbers() {
    try {
        const { data, error } = await supabase
            .from('tbl_seats')
            .select(`
                *,
                tbl_barbers (
                    id,
                    specialization,
                    rating,
                    tbl_users!tbl_barbers_user_id_fkey (
                        first_name,
                        last_name
                    )
                )
            `)
            .eq('is_available', true)
            .order('seat_number', { ascending: true });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching seats with barbers:', error);
        return [];
    }
}

/**
 * Get barber info for a specific seat
 * @param {number} seatId - Seat ID
 * @returns {Object} Barber information
 */
export async function getBarberBySeat(seatId) {
    try {
        const { data, error } = await supabase
            .from('tbl_seats')
            .select(`
                barber_id,
                tbl_barbers (
                    id,
                    specialization,
                    years_of_experience,
                    rating,
                    tbl_users!tbl_barbers_user_id_fkey (
                        first_name,
                        last_name
                    )
                )
            `)
            .eq('id', seatId)
            .single();
        
        if (error) throw error;
        
        return data.tbl_barbers;
    } catch (error) {
        console.error('Error fetching barber:', error);
        return null;
    }
}

/**
 * Create reservation with multiple services
 * @param {Object} reservationData - Reservation details with service array
 * @returns {Object} Created reservation
 */
export async function createMultiServiceReservation(reservationData) {
    try {
        const {
            serviceRecipient,
            serviceIds, // Array of service IDs
            seatId,
            reservedDate,
            reservedTime
        } = reservationData;
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        // Validate service combination
        const validation = await validateServiceCombination(serviceIds);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Create reservation using database function
        const { data, error } = await supabase
            .rpc('create_multi_service_reservation', {
                p_user_id: user.id,
                p_service_recipient: serviceRecipient,
                p_service_ids: serviceIds,
                p_seat_id: seatId,
                p_reserved_date: reservedDate,
                p_reserved_time: reservedTime
            });
        
        if (error) throw error;
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        // Fetch complete reservation details
        const completeReservation = await getReservationDetails(data.reservation_id);
        
        return completeReservation;
    } catch (error) {
        console.error('Error creating reservation:', error);
        throw error;
    }
}

/**
 * Get reservation with all services
 * @param {number} reservationId - Reservation ID
 * @returns {Object} Complete reservation details
 */
export async function getReservationDetails(reservationId) {
    try {
        const { data, error } = await supabase
            .from('tbl_reservations')
            .select(`
                *,
                tbl_seats (seat_number),
                tbl_barbers (
                    id,
                    tbl_users!tbl_barbers_user_id_fkey (
                        first_name,
                        last_name
                    )
                ),
                tbl_reservation_services (
                    id,
                    is_base_service,
                    price,
                    tbl_services (
                        id,
                        name,
                        category,
                        duration_minutes
                    )
                )
            `)
            .eq('id', reservationId)
            .single();
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching reservation details:', error);
        return null;
    }
}

/**
 * Get user's reservations with all services
 * @param {string|Array} status - Filter by status
 * @returns {Array} List of reservations
 */
export async function getUserReservationsWithServices(status = null) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        let query = supabase
            .from('tbl_reservations')
            .select(`
                *,
                tbl_seats (seat_number),
                tbl_barbers (
                    id,
                    tbl_users!tbl_barbers_user_id_fkey (
                        first_name,
                        last_name
                    )
                ),
                tbl_reservation_services (
                    id,
                    is_base_service,
                    price,
                    tbl_services (
                        id,
                        name,
                        category,
                        duration_minutes
                    )
                )
            `)
            .eq('user_id', user.id)
            .order('reserved_datetime', { ascending: false });
        
        if (status) {
            if (Array.isArray(status)) {
                query = query.in('status', status);
            } else {
                query = query.eq('status', status);
            }
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching reservations:', error);
        return [];
    }
}

/**
 * Get user's notifications
 * @param {boolean} unreadOnly - Get only unread notifications
 * @returns {Array} List of notifications
 */
export async function getNotifications(unreadOnly = false) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        let query = supabase
            .from('tbl_notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (unreadOnly) {
            query = query.eq('is_read', false);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

/**
 * Get unread notification count
 * @returns {number} Count of unread notifications
 */
export async function getUnreadNotificationCount() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;
        
        const { data, error } = await supabase
            .rpc('get_unread_count', {
                p_user_id: user.id
            });
        
        if (error) throw error;
        
        return data || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @returns {boolean} Success status
 */
export async function markNotificationAsRead(notificationId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabase
            .rpc('mark_notification_read', {
                p_notification_id: notificationId,
                p_user_id: user.id
            });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
}

/**
 * Mark all notifications as read
 * @returns {boolean} Success status
 */
export async function markAllNotificationsAsRead() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const { error } = await supabase
            .from('tbl_notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        return true;
    } catch (error) {
        console.error('Error marking all as read:', error);
        return false;
    }
}

/**
 * Subscribe to notifications (realtime)
 * @param {Function} callback - Callback when new notification arrives
 * @returns {Object} Subscription
 */
export function subscribeToNotifications(callback) {
    const subscription = supabase
        .channel('notifications-changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'tbl_notifications' },
            (payload) => {
                callback(payload.new);
            }
        )
        .subscribe();
    
    return subscription;
}

/**
 * Create announcement (ADMIN) - Auto-notifies all barbers
 * @param {Object} announcementData - Announcement details
 * @returns {Object} Created announcement
 */
export async function createAnnouncement(announcementData) {
    try {
        const { title, message, startDate, endDate } = announcementData;
        
        const { data, error } = await supabase
            .from('tbl_announcements')
            .insert([{
                title: title,
                message: message,
                is_active: true,
                start_date: startDate || null,
                end_date: endDate || null
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Trigger automatically notifies all barbers via database trigger
        
        return data;
    } catch (error) {
        console.error('Error creating announcement:', error);
        throw error;
    }
}

/**
 * Format services list for display
 * @param {Array} services - Array of service objects
 * @returns {string} Formatted string
 */
export function formatServicesList(services) {
    if (!services || services.length === 0) return '';
    
    const baseService = services.find(s => s.is_base_service);
    const addons = services.filter(s => !s.is_base_service);
    
    let result = baseService ? baseService.tbl_services.name : '';
    
    if (addons.length > 0) {
        result += '\n+ ' + addons.map(a => a.tbl_services.name).join('\n+ ');
    }
    
    return result;
}

/**
 * Get service category display name
 * @param {string} category - Service category/type
 * @returns {string} Display name
 */
export function getServiceCategoryDisplay(category) {
    const displays = {
        'general': 'General Service',
        'modern_cut': 'Modern Cut',
        'bossing': 'General Bossing Services',
        'addon': 'Add-ons'
    };
    return displays[category] || category;
}

/**
 * Calculate estimated end time
 * @param {string} startTime - Start time (HH:MM)
 * @param {number} durationMinutes - Duration in minutes
 * @returns {string} End time (HH:MM)
 */
export function calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * Check if services can be combined
 * @param {Object} baseService - Base service object
 * @param {Array} addons - Array of addon service objects
 * @returns {Object} { canCombine: boolean, reason: string }
 */
export function canCombineServices(baseService, addons) {
    if (!baseService) {
        return { canCombine: false, reason: 'No base service selected' };
    }
    
    if (baseService.service_type === 'bossing' && addons.length > 0) {
        return { 
            canCombine: false, 
            reason: 'Bossing services cannot be combined with add-ons' 
        };
    }
    
    if (baseService.included_addons && addons.length > 0) {
        for (const addon of addons) {
            if (baseService.included_addons.includes(addon.name)) {
                return { 
                    canCombine: false, 
                    reason: `${addon.name} is already included in ${baseService.name}` 
                };
            }
        }
    }
    
    return { canCombine: true, reason: '' };
}

// Re-export other functions from updated_api_functions.js
export {
    registerUser,
    signIn,
    signOut,
    getCurrentUserProfile,
    hasRole,
    cancelReservation,
    getActiveAnnouncements,
    subscribeToSeatChanges,
    subscribeToReservationChanges,
    unsubscribe,
    formatDate,
    formatTime,
    getTimeUntilReservation,
    getSeatStatusColor,
    getStatusDisplayText
} from './updated_api_functions.js';
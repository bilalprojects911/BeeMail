// Supabase Configuration
// PLEASE REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = "https://ytgztkehiussvkvhhakp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0Z3p0a2VoaXVzc3ZrdmhoYWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDc5MTcsImV4cCI6MjEwMDU4MzkxN30.Uy-0xXCa72ZSxf8VKtlTthNebyxQellw2d4rVnJeboU";

// Create Supabase client only if credentials are provided to prevent errors
window.supabaseClient = (SUPABASE_URL.includes('YOUR_')) ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let emails = [];
let currentCategory = 'inbox';
let searchQuery = '';
let selectedEmailId = null;
let isMobileDetailView = false;
let isDarkMode = false;
let currentUser = null; // Holds the authenticated Supabase user object

// Categories Definition
const categories = [
    { id: 'inbox', label: 'Inbox', icon: 'ph-tray', unreadCount: true },
    { id: 'starred', label: 'Starred', icon: 'ph-star', unreadCount: false },
    { id: 'sent', label: 'Sent', icon: 'ph-paper-plane-right', unreadCount: false },
    { id: 'drafts', label: 'Drafts', icon: 'ph-file-text', unreadCount: false },
    { id: 'trash', label: 'Trash', icon: 'ph-trash', unreadCount: false },
];

// DOM Elements
const emailListContainer = document.getElementById('emailListContainer');
const emailDetailContent = document.getElementById('emailDetailContent');
const emailListCol = document.getElementById('emailListCol');
const emailDetailCol = document.getElementById('emailDetailCol');
const mobileBackBtn = document.getElementById('mobileBackBtn');
const mobileLogo = document.getElementById('mobileLogo');
const searchInput = document.getElementById('searchInput');
const viewTitle = document.getElementById('viewTitle');
const navCategories = document.getElementById('navCategories');
const composeModal = document.getElementById('composeModal');
const composeModalContent = document.getElementById('composeModalContent');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const mobileThemeBtn = document.getElementById('mobileThemeBtn');
const emailCountDisplay = document.getElementById('emailCountDisplay');
const toastContainer = document.getElementById('toastContainer');

const composeTo = document.getElementById('composeTo');
const composeSubject = document.getElementById('composeSubject');
const composeBody = document.getElementById('composeBody');
const sendEmailBtn = document.getElementById('sendEmailBtn');

// Initialize App
async function init() {
    checkResponsive();
    
    // Check saved theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        isDarkMode = true;
    } else {
        document.documentElement.classList.remove('dark');
    }

    // AUTH GUARD: Check session before loading inbox
    if (window.supabaseClient) {
        const authenticated = await checkAuthSession();
        if (!authenticated) {
            // Show auth modal, don't load inbox yet
            showAuthModal();
            setupEventListeners();
            setupAuthListeners();
            return;
        }
        await fetchEmailsFromSupabase();
        setupRealtimeSubscription();
    } else {
        // Fallback to local storage if Supabase isn't configured
        showToast("Supabase keys missing. Running in local mode.", "info");
        loadLocalEmails();
    }
    
    renderSidebar();
    renderEmailList();
    setupEventListeners();
    setupAuthListeners();
}

// ============ AUTHENTICATION ============

async function checkAuthSession() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;
        if (session?.user) {
            currentUser = session.user;
            updateProfileUI();
            hideAuthModal();
            return true;
        }
        return false;
    } catch (err) {
        console.error('Auth session check failed:', err);
        return false;
    }
}

function showAuthModal() {
    const authModal = document.getElementById('authModal');
    authModal.classList.remove('hidden');
}

function hideAuthModal() {
    const authModal = document.getElementById('authModal');
    authModal.classList.add('hidden');
}

async function signInWithGoogle() {
    if (!window.supabaseClient) return;
    try {
        const { error } = await window.supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error('Google sign-in error:', err);
        showAuthError(err.message || 'Failed to sign in with Google');
    }
}

async function signInWithEmail() {
    if (!window.supabaseClient) return;
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if (!email || !password) {
        showAuthError('Please enter both email and password.');
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        updateProfileUI();
        hideAuthModal();
        await loadInboxAfterAuth();
        showToast('Signed in successfully', 'success');
    } catch (err) {
        console.error('Email sign-in error:', err);
        showAuthError(err.message || 'Invalid credentials.');
    }
}

async function signUpWithEmail() {
    if (!window.supabaseClient) return;
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if (!email || !password) {
        showAuthError('Please enter both email and password.');
        return;
    }
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.user.confirmed_at && data.user.identities?.length === 0) {
            showAuthError('This email is already registered. Please sign in instead.');
            return;
        }
        if (data.session) {
            currentUser = data.user;
            updateProfileUI();
            hideAuthModal();
            await loadInboxAfterAuth();
            showToast('Account created! Welcome to BeeMail.', 'success');
        } else {
            showAuthError('Check your email for a confirmation link, then sign in.');
        }
    } catch (err) {
        console.error('Sign-up error:', err);
        showAuthError(err.message || 'Sign up failed.');
    }
}

async function handleSignOut() {
    if (!window.supabaseClient) return;
    try {
        await window.supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Sign out error:', err);
    }
    // Clear app state
    currentUser = null;
    emails = [];
    selectedEmailId = null;
    currentCategory = 'inbox';
    searchQuery = '';
    
    // Reset UI
    renderSidebar();
    renderEmailList();
    renderEmailDetail();
    closeProfileDropdown();
    showAuthModal();
    showToast('Signed out', 'info');
}

async function loadInboxAfterAuth() {
    await fetchEmailsFromSupabase();
    setupRealtimeSubscription();
    renderSidebar();
    renderEmailList();
}

function showAuthError(message) {
    const errEl = document.getElementById('authError');
    errEl.textContent = message;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 5000);
}

function updateProfileUI() {
    if (!currentUser) return;
    const meta = currentUser.user_metadata || {};
    const displayName = meta.full_name || meta.name || meta.preferred_username || currentUser.email?.split('@')[0] || 'User';
    const email = currentUser.email || 'user@beemail.io';
    const avatarUrl = meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0b5cff&color=fff&bold=true`;
    
    // Header avatar
    const headerAvatar = document.getElementById('headerAvatar');
    if (headerAvatar) headerAvatar.src = avatarUrl;
    
    // Dropdown
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');
    if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
    if (dropdownName) dropdownName.textContent = displayName;
    if (dropdownEmail) dropdownEmail.textContent = email;
    
    // Settings modal
    const settingsAvatar = document.getElementById('settingsAvatar');
    const settingsEmail = document.getElementById('settingsEmail');
    const settingsDisplayName = document.getElementById('settingsDisplayName');
    if (settingsAvatar) settingsAvatar.src = avatarUrl;
    if (settingsEmail) settingsEmail.textContent = email;
    if (settingsDisplayName) settingsDisplayName.value = displayName;
}

// ============ PROFILE DROPDOWN ============

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown.classList.contains('hidden')) {
        openProfileDropdown();
    } else {
        closeProfileDropdown();
    }
}

function openProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.remove('hidden');
    setTimeout(() => {
        dropdown.classList.remove('opacity-0', 'scale-95');
        dropdown.classList.add('opacity-100', 'scale-100');
    }, 10);
}

function closeProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.remove('opacity-100', 'scale-100');
    dropdown.classList.add('opacity-0', 'scale-95');
    setTimeout(() => dropdown.classList.add('hidden'), 200);
}

// ============ PROFILE SETTINGS MODAL ============

function openProfileSettingsModal() {
    closeProfileDropdown();
    updateProfileUI(); // Refresh data
    const modal = document.getElementById('profileSettingsModal');
    const content = document.getElementById('profileSettingsContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeProfileSettingsModal() {
    const modal = document.getElementById('profileSettingsModal');
    const content = document.getElementById('profileSettingsContent');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function saveProfile() {
    if (!window.supabaseClient || !currentUser) return;
    const newName = document.getElementById('settingsDisplayName').value.trim();
    if (!newName) {
        showToast('Display name cannot be empty', 'info');
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient.auth.updateUser({
            data: { full_name: newName }
        });
        if (error) throw error;
        currentUser = data.user;
        updateProfileUI();
        closeProfileSettingsModal();
        showToast('Profile updated', 'success');
    } catch (err) {
        console.error('Profile update error:', err);
        showToast('Failed to update profile', 'info');
    }
}

// ============ AUTH EVENT LISTENERS ============

function setupAuthListeners() {
    // Google OAuth button
    document.getElementById('googleSignInBtn')?.addEventListener('click', signInWithGoogle);
    
    // Email/Password
    document.getElementById('emailSignInBtn')?.addEventListener('click', signInWithEmail);
    document.getElementById('emailSignUpBtn')?.addEventListener('click', signUpWithEmail);
    
    // Enter key on password field triggers sign in
    document.getElementById('authPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') signInWithEmail();
    });
    
    // Profile avatar dropdown toggle
    document.getElementById('profileAvatarBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
    });
    
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('profileAvatarWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            closeProfileDropdown();
        }
    });
    
    // Sign Out
    document.getElementById('signOutBtn')?.addEventListener('click', handleSignOut);
    
    // Profile Settings
    document.getElementById('profileSettingsBtn')?.addEventListener('click', openProfileSettingsModal);
    document.getElementById('closeProfileSettingsBtn')?.addEventListener('click', closeProfileSettingsModal);
    document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
    
    // Close profile settings on overlay click
    document.getElementById('profileSettingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'profileSettingsModal') closeProfileSettingsModal();
    });
    
    // Listen for Supabase auth state changes (handles OAuth redirect callback)
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user;
                updateProfileUI();
                hideAuthModal();
                // Only load inbox if emails haven't been loaded yet
                if (emails.length === 0) {
                    await loadInboxAfterAuth();
                }
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                emails = [];
                renderSidebar();
                renderEmailList();
                renderEmailDetail();
                showAuthModal();
            }
        });
    }
}

// Database Fetching & Seeding
async function fetchEmailsFromSupabase() {
    try {
        const { data, error } = await window.supabaseClient.from('emails').select('*').order('id', { ascending: false });
        if (error) throw error;
        
        if (data.length === 0 && mockEmails) {
            // Seed database
            showToast("Seeding database...", "info");
            
            // Format mockEmails for DB
            const seedData = mockEmails.map(e => ({
                id: e.id,
                sender: e.sender,
                senderEmail: e.senderEmail,
                subject: e.subject,
                snippet: e.snippet,
                body: e.body,
                timestamp: e.timestamp,
                category: e.category,
                read: e.read,
                starred: e.starred,
                avatar: e.avatar,
                is_trashed: false,
                replies: []
            }));

            const { error: insertError } = await window.supabaseClient.from('emails').insert(seedData);
            if (insertError) throw insertError;
            
            const { data: newData } = await window.supabaseClient.from('emails').select('*').order('id', { ascending: false });
            emails = newData || [];
        } else {
            emails = data;
        }
    } catch (err) {
        console.error("Supabase Error:", err);
        showToast("Failed to fetch emails", "info");
        loadLocalEmails(); // Fallback
    }
}

function loadLocalEmails() {
    const saved = localStorage.getItem('beemail_data');
    if (saved) {
        emails = JSON.parse(saved);
    } else {
        emails = [...mockEmails].map(e => ({...e, is_trashed: false, replies: []}));
        localStorage.setItem('beemail_data', JSON.stringify(emails));
    }
}

function saveEmails() {
    localStorage.setItem('beemail_data', JSON.stringify(emails));
}

// Realtime Listener
function setupRealtimeSubscription() {
    window.supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, payload => {
        
        if (payload.eventType === 'INSERT') {
            // Ensure we don't duplicate if we inserted it ourselves (though IDs might handle this)
            if (!emails.find(e => e.id === payload.new.id)) {
                emails.unshift(payload.new);
            }
        } else if (payload.eventType === 'UPDATE') {
            const index = emails.findIndex(e => e.id === payload.new.id);
            if (index !== -1) {
                emails[index] = payload.new;
            }
        } else if (payload.eventType === 'DELETE') {
            emails = emails.filter(e => e.id !== payload.old.id);
        }
        
        renderSidebar();
        renderEmailList();
        
        // Refresh detail view if the currently opened email was updated
        if (selectedEmailId === payload.new?.id || selectedEmailId === payload.old?.id) {
            renderEmailDetail();
        }
    })
    .subscribe();
}

// DB Updates
async function updateEmailInDB(id, updates) {
    if (window.supabaseClient) {
        try {
            await window.supabaseClient.from('emails').update(updates).eq('id', id);
        } catch(err) {
            console.error("Update failed", err);
        }
    } else {
        localStorage.setItem('beemail_data', JSON.stringify(emails));
    }
}

// Toast Notification System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700`;
    
    const icon = type === 'success' 
        ? '<i class="ph-fill ph-check-circle text-2xl text-green-500"></i>' 
        : '<i class="ph-fill ph-info text-2xl text-brand-500"></i>';
        
    toast.innerHTML = `
        ${icon}
        <span class="font-semibold text-slate-800 dark:text-white text-sm">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-5');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Render Sidebar Navigation
function renderSidebar() {
    navCategories.innerHTML = '';
    categories.forEach(cat => {
        // Unread logic excludes trashed items
        const unread = cat.unreadCount ? emails.filter(e => e.category === cat.id && !e.read && !e.is_trashed).length : 0;
        const isActive = currentCategory === cat.id;
        
        const a = document.createElement('a');
        a.href = '#';
        a.className = `flex items-center justify-between px-4 py-3 rounded-xl transition-all-200 group ${isActive ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700 hover:text-slate-900 dark:hover:text-slate-200'}`;
        
        a.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="ph ${isActive ? cat.icon.replace('ph-', 'ph-fill ph-') : cat.icon} text-xl"></i>
                <span>${cat.label}</span>
            </div>
            ${unread > 0 ? `<span class="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">${unread}</span>` : ''}
        `;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            changeCategory(cat.id);
        });
        
        navCategories.appendChild(a);
    });

    // Update Mobile Nav
    document.querySelectorAll('.nav-item-mobile').forEach(btn => {
        const catId = btn.dataset.cat;
        if (catId === currentCategory) {
            btn.classList.add('text-brand-500');
            btn.classList.remove('text-slate-400');
            const icon = btn.querySelector('i');
            icon.className = icon.className.replace('ph ', 'ph-fill ');
        } else {
            btn.classList.remove('text-brand-500');
            btn.classList.add('text-slate-400');
            const icon = btn.querySelector('i');
            icon.className = icon.className.replace('ph-fill ', 'ph ');
        }
    });
}

function changeCategory(categoryId) {
    currentCategory = categoryId;
    selectedEmailId = null; 
    viewTitle.textContent = categories.find(c => c.id === categoryId)?.label || 'Inbox';
    if (isMobileDetailView) closeMobileDetail();
    renderSidebar();
    renderEmailList();
    renderEmailDetail(); 
}

// Render Email List
function renderEmailList() {
    emailListContainer.innerHTML = '';
    
    let filteredEmails = emails.filter(e => {
        if (currentCategory === 'trash') return e.is_trashed;
        if (e.is_trashed) return false;
        
        const matchCategory = currentCategory === 'starred' ? e.starred : e.category === currentCategory;
        const matchSearch = e.subject.toLowerCase().includes(searchQuery) || e.sender.toLowerCase().includes(searchQuery);
        return matchCategory && matchSearch;
    });

    emailCountDisplay.textContent = filteredEmails.length;

    if (filteredEmails.length === 0) {
        emailListContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-slate-400">
                <i class="ph ph-empty text-4xl mb-3 opacity-50"></i>
                <p>No emails found.</p>
            </div>
        `;
        return;
    }

    filteredEmails.forEach(email => {
        const isSelected = selectedEmailId === email.id;
        const row = document.createElement('div');
        row.className = `email-row cursor-pointer p-4 rounded-xl border mb-2 transition-all duration-200 group relative overflow-hidden ${
            isSelected 
                ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-500/30 shadow-sm' 
                : (email.read ? 'bg-white border-transparent hover:border-slate-200 dark:bg-dark-800 dark:hover:border-dark-600' : 'bg-white border-slate-100 shadow-sm dark:bg-dark-800 dark:border-dark-700')
        }`;
        
        row.innerHTML = `
            ${!email.read && !isSelected ? `<div class="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 rounded-l-xl"></div>` : ''}
            <div class="flex items-start gap-3">
                <div class="relative mt-1 shrink-0">
                    <img src="${email.avatar}" class="w-10 h-10 rounded-full object-cover">
                    ${!email.read ? `<div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-500 border-2 border-white dark:border-dark-800 rounded-full"></div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-0.5">
                        <h4 class="text-[15px] ${!email.read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'} truncate pr-2">${email.sender}</h4>
                        <span class="text-xs ${!email.read ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-slate-500'} shrink-0">${email.timestamp}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <p class="text-[14px] ${!email.read ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'} truncate pr-2">${email.subject}</p>
                        <button class="star-btn p-1.5 -mr-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors shrink-0 ${email.starred ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'}" data-id="${email.id}" title="${email.starred ? 'Unstar' : 'Star'}">
                            <i class="${email.starred ? 'ph-fill' : 'ph'} ph-star text-lg"></i>
                        </button>
                    </div>
                    <p class="text-sm text-slate-500 dark:text-slate-500 truncate mt-0.5">${email.snippet}</p>
                </div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.star-btn')) return;
            openEmailDetail(email.id);
        });

        const starBtn = row.querySelector('.star-btn');
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStar(email.id);
        });

        emailListContainer.appendChild(row);
    });
}

// Render Email Detail
function renderEmailDetail() {
    if (!selectedEmailId) {
        emailDetailContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 hidden md:flex">
                <div class="w-24 h-24 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center mb-6">
                <i class="ph ph-envelope-open text-4xl text-slate-300 dark:text-slate-600"></i>
                </div>
                <p class="text-xl font-medium text-slate-500 dark:text-slate-400">Select an email to read</p>
                <p class="text-sm mt-2 text-slate-400 dark:text-slate-500">Nothing is selected currently.</p>
            </div>
        `;
        return;
    }

    const email = emails.find(e => e.id === selectedEmailId);
    if (!email) return;

    const isTrash = email.is_trashed;

    const repliesHTML = email.replies && email.replies.length > 0 ? email.replies.map(reply => `
        <div class="flex gap-4 mt-8">
            <img src="${reply.avatar}" class="w-10 h-10 rounded-full object-cover shadow-sm">
            <div class="flex-1 bg-slate-50 dark:bg-dark-800 rounded-2xl rounded-tl-none p-5 shadow-sm border border-slate-100 dark:border-dark-700">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-slate-900 dark:text-white text-[15px]">${reply.sender}</span>
                    <span class="text-xs text-slate-400 font-medium">${reply.timestamp}</span>
                </div>
                <div class="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">${reply.body.replace(/\n/g, '<br>')}</div>
            </div>
        </div>
    `).join('') : '';

    emailDetailContent.innerHTML = `
        <div class="h-full flex flex-col bg-white dark:bg-dark-900 md:m-4 md:rounded-2xl md:border border-slate-200 dark:border-dark-700 md:shadow-sm overflow-hidden relative">
            
            ${isTrash ? `
            <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-2 text-sm font-medium flex items-center justify-between border-b border-red-100 dark:border-red-900/30">
                <span>This message is in the Trash.</span>
            </div>` : ''}

            <!-- Toolbar -->
            <div class="px-6 py-4 border-b border-slate-100 dark:border-dark-800 flex justify-between items-center bg-slate-50/50 dark:bg-dark-900">
                <div class="flex gap-2">
                    <button class="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-dark-700 flex items-center justify-center text-slate-500 transition-colors" title="Archive">
                        <i class="ph ph-archive-box text-xl"></i>
                    </button>
                    
                    ${isTrash ? `
                    <button id="restoreEmailBtn" class="w-10 h-10 rounded-full hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 flex items-center justify-center text-slate-500 transition-colors" title="Restore to Inbox">
                        <i class="ph ph-arrow-u-up-left text-xl"></i>
                    </button>
                    ` : `
                    <button id="deleteEmailBtn" class="w-10 h-10 rounded-full hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 flex items-center justify-center text-slate-500 transition-colors" title="Move to Trash">
                        <i class="ph ph-trash text-xl"></i>
                    </button>
                    `}
                    
                    <button id="toggleReadBtn" class="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-dark-700 flex items-center justify-center text-slate-500 transition-colors" title="${email.read ? 'Mark Unread' : 'Mark Read'}">
                        <i class="ph ${email.read ? 'ph-envelope' : 'ph-envelope-open'} text-xl"></i>
                    </button>
                </div>
                <div class="flex gap-2">
                    <button class="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-dark-700 flex items-center justify-center text-slate-500 transition-colors" title="More">
                        <i class="ph ph-dots-three-vertical text-xl"></i>
                    </button>
                </div>
            </div>

            <!-- Email Header -->
            <div class="p-6 md:p-8 flex-1 overflow-y-auto pb-8">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">${email.subject}</h2>
                
                <div class="flex items-start justify-between mb-8">
                    <div class="flex items-center gap-4">
                        <img src="${email.avatar}" class="w-12 h-12 rounded-full object-cover shadow-sm">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-slate-900 dark:text-white text-lg">${email.sender}</h3>
                                <span class="text-xs text-slate-400 bg-slate-100 dark:bg-dark-700 px-2 py-0.5 rounded-full capitalize">${email.category}</span>
                            </div>
                            <p class="text-sm text-slate-500 font-medium">to me <span class="mx-1">&bull;</span> ${email.senderEmail || 'sender@beemail.io'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-sm text-slate-400 font-medium">${email.timestamp}</span>
                        <button class="star-btn-detail text-xl ${email.starred ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'} transition-colors" data-id="${email.id}">
                            <i class="${email.starred ? 'ph-fill' : 'ph'} ph-star"></i>
                        </button>
                    </div>
                </div>

                <!-- Original Email Body -->
                <div class="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-base">
                    ${email.body.replace(/\n/g, '<br>')}
                </div>
                
                <!-- Replies Thread -->
                ${repliesHTML}

                <!-- Reply Box -->
                <div class="mt-10 pt-6 border-t border-slate-200 dark:border-dark-700">
                    <div class="border border-slate-200 dark:border-dark-700 rounded-xl p-3 flex gap-3 focus-within:ring-2 ring-brand-500/50 transition-shadow bg-white dark:bg-dark-800">
                        <img src="${getUserAvatar()}" class="w-10 h-10 rounded-full object-cover shadow-sm">
                        <input type="text" id="replyInput" placeholder="Reply to ${email.sender}..." class="flex-1 bg-transparent outline-none text-slate-900 dark:text-white font-medium placeholder-slate-400" autocomplete="off">
                        <button id="sendReplyBtn" class="bg-brand-500 hover:bg-brand-600 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-50">
                            <i class="ph ph-paper-plane-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Bind Detail Actions
    document.getElementById('toggleReadBtn').addEventListener('click', () => {
        email.read = !email.read;
        updateEmailInDB(email.id, { read: email.read });
        renderEmailList();
        renderSidebar();
        renderEmailDetail(); 
    });

    if (document.getElementById('deleteEmailBtn')) {
        document.getElementById('deleteEmailBtn').addEventListener('click', () => {
            email.is_trashed = true;
            updateEmailInDB(email.id, { is_trashed: true });
            showToast("Moved to Trash");
            selectedEmailId = null; 
            renderSidebar();
            renderEmailList();
            renderEmailDetail();
            if (isMobileDetailView) closeMobileDetail();
        });
    }

    if (document.getElementById('restoreEmailBtn')) {
        document.getElementById('restoreEmailBtn').addEventListener('click', () => {
            email.is_trashed = false;
            updateEmailInDB(email.id, { is_trashed: false });
            showToast("Restored to Inbox");
            selectedEmailId = null; 
            renderSidebar();
            renderEmailList();
            renderEmailDetail();
            if (isMobileDetailView) closeMobileDetail();
        });
    }

    document.querySelector('.star-btn-detail').addEventListener('click', () => {
        toggleStar(email.id);
        renderEmailDetail();
    });

    // Handle Thread Reply
    const replyInput = document.getElementById('replyInput');
    const sendReplyBtn = document.getElementById('sendReplyBtn');
    
    const submitReply = async () => {
        const text = replyInput.value.trim();
        if (!text) return;
        
        if (!email.replies) email.replies = [];
        
        const newReply = {
            id: Date.now(),
            sender: getUserDisplayName(),
            avatar: getUserAvatar(),
            body: text,
            timestamp: "Just now"
        };
        
        email.replies.push(newReply);
        
        // Optimistic UI
        renderEmailDetail();
        const detailScrollArea = document.querySelector('#emailDetailContent > div > div:nth-child(3)');
        if (detailScrollArea) {
            detailScrollArea.scrollTop = detailScrollArea.scrollHeight;
        }

        updateEmailInDB(email.id, { replies: email.replies });
        showToast("Reply Sent");
    };
    
    sendReplyBtn.addEventListener('click', submitReply);
    replyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitReply();
    });
}

function openEmailDetail(id) {
    selectedEmailId = id;
    
    const email = emails.find(e => e.id === id);
    if (email && !email.read) {
        email.read = true;
        updateEmailInDB(email.id, { read: true });
        renderSidebar(); 
    }

    renderEmailList(); 
    renderEmailDetail();

    if (window.innerWidth < 768) {
        isMobileDetailView = true;
        emailListCol.classList.add('-translate-x-full');
        emailDetailCol.classList.remove('translate-x-full');
        mobileBackBtn.classList.remove('hidden');
        mobileLogo.classList.add('hidden');
    }
}

function closeMobileDetail() {
    isMobileDetailView = false;
    emailListCol.classList.remove('-translate-x-full');
    emailDetailCol.classList.add('translate-x-full');
    mobileBackBtn.classList.add('hidden');
    mobileLogo.classList.remove('hidden');
    selectedEmailId = null;
    renderEmailList();
}

function toggleStar(id) {
    const email = emails.find(e => e.id === id);
    if (email) {
        email.starred = !email.starred;
        updateEmailInDB(email.id, { starred: email.starred });
        renderEmailList();
    }
}

// Handle Compose Send
async function handleSendEmail() {
    const to = composeTo.value.trim();
    const subject = composeSubject.value.trim();
    const body = composeBody.value.trim();

    if (!to || !body) {
        alert("Please specify a recipient and a message body.");
        return;
    }

    // Auto-generate numeric ID for mock insertion (Supabase usually uses UUID/int sequence)
    // We'll let Supabase handle 'id' by excluding it if we use Supabase, 
    // but we add it for local state rendering until it syncs.
    const newEmail = {
        id: Date.now(), 
        sender: getUserDisplayName(),
        senderEmail: getUserEmail(),
        subject: subject || "(No Subject)",
        snippet: body.length > 50 ? body.substring(0, 50) + "..." : body,
        body: body,
        timestamp: "Just now",
        category: "sent",
        read: true,
        starred: false,
        avatar: getUserAvatar(),
        is_trashed: false,
        replies: [],
        user_id: currentUser?.id || null
    };

    const originalText = sendEmailBtn.innerHTML;
    sendEmailBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Sending...`;

    try {
        if (window.supabaseClient) {
            // Remove the temporary ID, let the DB generate it
            const dbEmail = { ...newEmail };
            delete dbEmail.id;
            const { error } = await window.supabaseClient.from('emails').insert([dbEmail]);
            if (error) throw error;
        } else {
            emails.unshift(newEmail);
            saveEmails();
        }

        // Cleanup Form & UI
        composeTo.value = '';
        composeSubject.value = '';
        composeBody.value = '';
        
        closeComposeModal();
        showToast("Message Sent", "success");
        
        sendEmailBtn.innerHTML = originalText; 
        changeCategory('sent'); 
        
    } catch (err) {
        console.error("Failed to send email:", err);
        showToast("Error sending message", "error");
        sendEmailBtn.innerHTML = originalText;
    }
}

function openComposeModal() {
    composeModal.classList.remove('hidden');
    setTimeout(() => {
        composeModal.classList.remove('opacity-0');
        composeModalContent.classList.remove('translate-y-full', 'sm:scale-95');
        composeTo.focus();
    }, 10);
}

function closeComposeModal() {
    composeModal.classList.add('opacity-0');
    composeModalContent.classList.add('translate-y-full', 'sm:scale-95');
    setTimeout(() => {
        composeModal.classList.add('hidden');
    }, 300);
}

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderEmailList();
    });

    mobileBackBtn.addEventListener('click', closeMobileDetail);

    document.getElementById('composeBtn').addEventListener('click', openComposeModal);
    document.getElementById('mobileComposeBtn').addEventListener('click', openComposeModal);
    document.getElementById('closeComposeBtn').addEventListener('click', closeComposeModal);
    sendEmailBtn.addEventListener('click', handleSendEmail);

    const toggleTheme = () => {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        }
    };
    themeToggleBtn.addEventListener('click', toggleTheme);
    mobileThemeBtn.addEventListener('click', toggleTheme);

    window.addEventListener('resize', checkResponsive);

    document.querySelectorAll('.nav-item-mobile').forEach(btn => {
        btn.addEventListener('click', (e) => {
            changeCategory(btn.dataset.cat);
        });
    });
}

function checkResponsive() {
    if (window.innerWidth >= 768) {
        emailListCol.classList.remove('-translate-x-full');
        emailDetailCol.classList.remove('translate-x-full');
        mobileBackBtn.classList.add('hidden');
        mobileLogo.classList.remove('hidden');
        
        if (!selectedEmailId && currentCategory !== 'drafts') {
            const visibleEmails = emails.filter(e => {
                if (currentCategory === 'trash') return e.is_trashed;
                if (e.is_trashed) return false;
                return currentCategory === 'starred' ? e.starred : e.category === currentCategory;
            });
            if(visibleEmails.length > 0) openEmailDetail(visibleEmails[0].id);
        }
    } else {
        if (!isMobileDetailView) {
            emailDetailCol.classList.add('translate-x-full');
            emailListCol.classList.remove('-translate-x-full');
        } else {
            emailDetailCol.classList.remove('translate-x-full');
            emailListCol.classList.add('-translate-x-full');
        }
    }
}

// ============ USER HELPERS ============

function getUserDisplayName() {
    if (!currentUser) return 'Me';
    const meta = currentUser.user_metadata || {};
    return meta.full_name || meta.name || currentUser.email?.split('@')[0] || 'Me';
}

function getUserEmail() {
    return currentUser?.email || 'user@beemail.io';
}

function getUserAvatar() {
    if (!currentUser) return 'https://i.pravatar.cc/150?u=me';
    const meta = currentUser.user_metadata || {};
    return meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=0b5cff&color=fff&bold=true`;
}

document.addEventListener('DOMContentLoaded', init);

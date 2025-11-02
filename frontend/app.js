// Smart City Admin Portal - JavaScript

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Smart City Admin Portal Initialized');
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize forms
    initializeForms();
    
    // Initialize mobile sidebar toggle
    initializeMobileSidebar();
});

// Default API base (useful when serving frontend from a different origin)
if (!window.API_BASE) {
    window.API_BASE = 'http://127.0.0.1:5000/api';
}

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const table = document.getElementById('citizensTable');
            
            if (table) {
                const rows = table.getElementsByTagName('tr');
                
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const text = row.textContent.toLowerCase();
                    
                    if (text.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            }
        });
    }
}

// Form handling
function initializeForms() {
    // Announcement form
    const announcementForm = document.getElementById('announcementForm');
    if (announcementForm) {
        announcementForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const title = document.getElementById('title').value;
            const message = document.getElementById('message').value;
            
            // Show success message
            showToast('Announcement sent successfully!', 'success');
            
            // Reset form
            announcementForm.reset();
            
            console.log('Announcement sent:', { title, message });
        });
    }
    
    // Citizen form
    const citizenForm = document.getElementById('citizenForm');
    if (citizenForm) {
        citizenForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                zipCode: document.getElementById('zipCode').value
            };
            
            // Show success message
            showToast('Citizen added successfully!', 'success');
            
            // Redirect after a short delay
            setTimeout(function() {
                window.location.href = 'citizens.html';
            }, 1500);
            
            console.log('Citizen added:', formData);
        });
    }
}

// Mobile sidebar toggle
function initializeMobileSidebar() {
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarCollapse && sidebar) {
        sidebarCollapse.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
}

// Toast notification function
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
    toast.style.cssText = 'min-width: 250px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
            toast.remove();
        }, 150);
    }, 3000);
}

// API integration placeholder functions
// Replace these with actual API calls to your backend

function fetchCitizens() {
    // TODO: Fetch citizens from API
    console.log('Fetching citizens from API...');
}

function fetchComplaints() {
    // TODO: Fetch complaints from API
    console.log('Fetching complaints from API...');
}

function fetchTransportData() {
    // TODO: Fetch transport data from API
    console.log('Fetching transport data from API...');
}

function fetchMaintenanceRequests() {
    // TODO: Fetch maintenance requests from API
    console.log('Fetching maintenance requests from API...');
}

function fetchBookings() {
    // TODO: Fetch bookings from API
    console.log('Fetching bookings from API...');
}

// Export functions for use in other scripts if needed
window.smartCityAdmin = {
    showToast: showToast,
    fetchCitizens: fetchCitizens,
    fetchComplaints: fetchComplaints,
    fetchTransportData: fetchTransportData,
    fetchMaintenanceRequests: fetchMaintenanceRequests,
    fetchBookings: fetchBookings
};

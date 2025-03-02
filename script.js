// GitHub repository configuration
const CONFIG = {
    username: 'your-github-username',
    repoName: 'warehouse-monitor',
    branch: 'main' // or 'master' depending on your default branch
};

// Function to get raw GitHub URLs
function getGitHubRawUrl(path) {
    return `https://raw.githubusercontent.com/${CONFIG.username}/${CONFIG.repoName}/${CONFIG.branch}/${path}`;
}

// Helper function to get priority class
function getPriorityClass(priority) {
    // Convert to string and trim in case it's a number or has whitespace
    const priorityStr = String(priority).trim();
    
    if (priorityStr === '10') {
        return 'priority-10';
    } else if (priorityStr === '20') {
        return 'priority-20';
    } else if (priorityStr === '30') {
        return 'priority-30';
    } else {
        return 'priority-other';
    }
}

// Helper function to check if the viewport is mobile-sized
function isMobileView() {
    return window.innerWidth <= 768;
}

// Global variables
let deliveryData = [];
let filteredData = [];
let groupedData = {}; // For storing data grouped by GI TIME
let expandedGroups = {}; // Track which groups are expanded
let selectedPriorities = {
    '10': true,
    '20': true,
    '30': true
};
let showingTomorrow = false; // Track whether we're showing today or tomorrow
let statsData = null; // For storing statistics data

// DOM elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const loadingIndicator = document.getElementById('loadingIndicator');
const priority10Checkbox = document.getElementById('priority10');
const priority20Checkbox = document.getElementById('priority20');
const priority30Checkbox = document.getElementById('priority30');
const dateToggleBtn = document.getElementById('dateToggleBtn');
const totalLinesOpenElement = document.getElementById('totalLinesOpen');
const totalItemsOpenElement = document.getElementById('totalItemsOpen');
const detailModal = document.getElementById('detailModal');
const modalTitle = document.getElementById('modalTitle');
const detailTableBody = document.getElementById('detailTableBody');
const closeButton = document.querySelector('.close-button');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set initial state to Today (should show only today's deliveries by default)
    showingTomorrow = false;
    
    // Load data
    fetchDeliveryData();
    fetchStatisticsData();
    
    // Set up search functionality
    searchInput.addEventListener('input', () => {
        filterData();
        renderTable();
    });
    
    // Set up priority filter functionality
    priority10Checkbox.addEventListener('change', () => {
        selectedPriorities['10'] = priority10Checkbox.checked;
        filterData();
        renderTable();
    });
    
    priority20Checkbox.addEventListener('change', () => {
        selectedPriorities['20'] = priority20Checkbox.checked;
        filterData();
        renderTable();
    });
    
    priority30Checkbox.addEventListener('change', () => {
        selectedPriorities['30'] = priority30Checkbox.checked;
        filterData();
        renderTable();
    });
    
    // Set up date toggle button functionality
    dateToggleBtn.addEventListener('click', () => {
        showingTomorrow = !showingTomorrow;
        
        // Update button text and style
        if (showingTomorrow) {
            dateToggleBtn.textContent = 'Tomorrow';
            dateToggleBtn.classList.add('tomorrow');
        } else {
            dateToggleBtn.textContent = 'Today';
            dateToggleBtn.classList.remove('tomorrow');
        }
        
        // Update the statistics display
        updateStatisticsDisplay();
        
        // Filter and render the data
        filterData();
        renderTable();
    });
    
    // Set up modal close button
    closeButton.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
    
    // Close the modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === detailModal) {
            detailModal.style.display = 'none';
        }
    });
    
    // Set up the countdown timer to update color status every second
    setInterval(updateCountdowns, 1000);
    
    // Set up resize event to handle responsive changes
    window.addEventListener('resize', debounce(() => {
        renderTable(); // Re-render the table when window size changes
    }, 250));
    
    // Add swipe functionality for mobile
    setupMobileSwipe();
    
    // Set up auto-refresh for real-time updates
    setupAutoRefresh();
});

// Set up auto-refresh for real-time updates
function setupAutoRefresh() {
    const REFRESH_INTERVAL = 60000; // 1 minute
    
    setInterval(() => {
        console.log("Auto-refreshing data...");
        fetchDeliveryData();
        fetchStatisticsData();
    }, REFRESH_INTERVAL);
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Setup mobile swipe functionality
function setupMobileSwipe() {
    let touchStartX = 0;
    let touchEndX = 0;
    
    // Only apply swipe on mobile devices
    if (isMobileView()) {
        const tableContainer = document.querySelector('.table-container');
        
        tableContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        tableContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
    }
    
    // Handle swipe left/right
    function handleSwipe() {
        // Minimum swipe distance (in pixels)
        const minSwipeDistance = 50;
        
        // Calculate swipe distance
        const swipeDistance = Math.abs(touchEndX - touchStartX);
        
        // Only process if swipe is long enough
        if (swipeDistance > minSwipeDistance) {
            // Left swipe
            if (touchEndX < touchStartX && !showingTomorrow) {
                // Switch to tomorrow view
                dateToggleBtn.click();
            }
            // Right swipe
            else if (touchEndX > touchStartX && showingTomorrow) {
                // Switch to today view
                dateToggleBtn.click();
            }
        }
    }
}

// Fetch statistics data from GitHub
async function fetchStatisticsData() {
    try {
        const response = await fetch(getGitHubRawUrl('data/statistics.json'), {
            cache: 'no-store' // Ensure we don't use cached data
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        statsData = await response.json();
        console.log('Statistics data loaded:', statsData);
        
        // Update the statistics display based on current toggle state
        updateStatisticsDisplay();
    } catch (error) {
        console.error('Error fetching statistics data:', error);
        totalLinesOpenElement.textContent = 'Error';
        totalItemsOpenElement.textContent = 'Error';
    }
}

// Update the statistics display based on the current toggle state
function updateStatisticsDisplay() {
    if (!statsData) {
        totalLinesOpenElement.textContent = 'Loading...';
        totalItemsOpenElement.textContent = 'Loading...';
        return;
    }
    
    const statsType = showingTomorrow ? 'tomorrow' : 'today';
    
    totalLinesOpenElement.textContent = statsData[statsType].total_lines_open.toLocaleString();
    totalItemsOpenElement.textContent = statsData[statsType].total_items_open.toLocaleString();
}

// Fetch delivery data from GitHub
async function fetchDeliveryData() {
    try {
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = 'Loading data...';
        
        const response = await fetch(getGitHubRawUrl('data/VL06F.json'), {
            cache: 'no-store' // Ensure we don't use cached data
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        deliveryData = await response.json();
        
        // Initialize with all data
        filteredData = [...deliveryData];
        
        // Filter to show only today's deliveries by default
        filterData();
        
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        
        // Render the table
        renderTable();
    } catch (error) {
        console.error('Error fetching delivery data:', error);
        loadingIndicator.textContent = 'Error loading data. Please check the console for details.';
        loadingIndicator.style.color = '#cf6679'; // Use the error color from CSS variables
    }
}

// Filter data based on search input, priority filters, and date toggle
function filterData() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Log current filter state for debugging
    console.log(`Filtering with: searchTerm="${searchTerm}", priorities:`, selectedPriorities, `showingTomorrow=${showingTomorrow}`);
    
    // Start with all data and then apply filters
    filteredData = [...deliveryData];
    
    // Apply date filter based on toggle button state
    filteredData = filteredData.filter(item => {
        // Make sure GI DATE exists
        if (!item['GI DATE']) return !showingTomorrow; // If no date, only show for "Today" view
        
        // Format of date in the data is DD/MM/YYYY
        const giDateStr = String(item['GI DATE']);
        
        // Get today's date formatted as DD/MM/YYYY for comparison
        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        
        // Get tomorrow's date formatted as DD/MM/YYYY
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowFormatted = `${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}/${tomorrow.getFullYear()}`;
        
        if (showingTomorrow) {
            // Show dates that are not today (assume they're for tomorrow or later)
            return giDateStr !== todayFormatted;
        } else {
            // Show only today's dates
            return giDateStr === todayFormatted;
        }
    });
    
    // Apply search filter if search term is not empty
    if (searchTerm !== '') {
        filteredData = filteredData.filter(item => {
            // Make sure DELIVERY exists and is converted to string
            return item.DELIVERY && 
                  String(item.DELIVERY).toLowerCase().includes(searchTerm);
        });
    }
    
    // Apply priority filter
    filteredData = filteredData.filter(item => {
        // Convert to string and trim in case it's a number with whitespace
        const priorityStr = item['DELIVERY PRIORITY'] ? 
                           String(item['DELIVERY PRIORITY']).trim() : '';
        
        // If priority is empty, or the priority is selected, keep the item
        return priorityStr === '' || selectedPriorities[priorityStr] === true;
    });
    
    // Log filtered data length for debugging
    console.log(`Filtered data length: ${filteredData.length}`);
    
    // Group the filtered data by GI TIME
    groupDataByGITime();
}

// Group data by GI TIME
function groupDataByGITime() {
    // Clear the existing grouped data
    groupedData = {};
    
    // Group the filtered data by GI TIME
    filteredData.forEach(item => {
        const giTime = item['GI TIME'] || 'No GI Time';
        
        if (!groupedData[giTime]) {
            groupedData[giTime] = [];
        }
        
        groupedData[giTime].push(item);
    });
}

// Helper function to get country flag HTML
function getCountryFlag(countryCode) {
    // If no country code, return empty string
    if (!countryCode) return '';
    
    // Convert country code to uppercase for consistency
    const code = countryCode ? countryCode.toUpperCase() : '';
    
    // Only proceed if we have a valid 2-letter country code
    if (code.length !== 2) return '';
    
    // Use flag images from a CDN that provides country flags by ISO code
    return `<img src="https://flagcdn.com/16x12/${code.toLowerCase()}.png" width="16" height="12" alt="${code}" class="country-flag">`;
}

// Toggle the expanded state of a group
function toggleGroupExpansion(giTime) {
    expandedGroups[giTime] = !expandedGroups[giTime];
    renderTable();
}

// Show delivery detail modal
function showDeliveryDetails(deliveryData) {
    // Update the modal title with the delivery number
    modalTitle.textContent = `Delivery Details: ${deliveryData.DELIVERY}`;
    
    // Clear previous detail data
    detailTableBody.innerHTML = '';
    
    // Check if this delivery has HU INFO
    if (!deliveryData['HU INFO'] || Object.keys(deliveryData['HU INFO']).length === 0) {
        // No HU INFO available
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = '<td colspan="13">No detailed information available for this delivery</td>';
        detailTableBody.appendChild(noDataRow);
    } else {
        // Process and display HU INFO
        const huInfo = deliveryData['HU INFO'];
        
        // For each HU
        for (const hu in huInfo) {
            // Get TO Numbers for this HU
            const toNumbers = huInfo[hu]['TO_NUMBERS'];
            
            // For each TO Number
            for (const toNumber in toNumbers) {
                // Get Locations for this TO Number
                const locations = toNumbers[toNumber]['LOCATIONS'];
                
                // For each Location
                locations.forEach(locationData => {
                    const row = document.createElement('tr');
                    
                    // Get HU additional data
                    const huProfile = huInfo[hu]['PROFILE'] || '';
                    const huFirstPick = huInfo[hu]['INITIATED_BY'] || '';
                    const huFirstPickDate = huInfo[hu]['INITIATED_ON'] || '';
                    const huFirstPickTime = huInfo[hu]['INITIATED_TIME'] || '';
                    const huLastPick = huInfo[hu]['LAST_BY'] || '';
                    const huLastPickDate = huInfo[hu]['LAST_PICK_ON'] || '';
                    const huLastPickTime = huInfo[hu]['LAST_TIME'] || '';
                
                    // Create cells for HU, TO, LOCATION, MATERIAL, BATCH, QTY, and additional HU data
                    row.innerHTML = `
                        <td>${hu}</td>
                        <td>${toNumber}</td>
                        <td>${locationData.LOCATION || ''}</td>
                        <td>${locationData.MATERIAL || ''}</td>
                        <td>${locationData.BATCH || ''}</td>
                        <td>${locationData['TO ITEM QTY'] || 0}</td>
                        <td>${huProfile}</td>
                        <td>${huFirstPick}</td>
                        <td>${huFirstPickDate}</td>
                        <td>${huFirstPickTime}</td>
                        <td>${huLastPick}</td>
                        <td>${huLastPickDate}</td>
                        <td>${huLastPickTime}</td>
                    `;
                    
                    detailTableBody.appendChild(row);
                });
            }
        }
    }
    
    // Show the modal
    detailModal.style.display = 'block';
    
    // If on mobile, auto-expand the modal to full screen
    if (isMobileView()) {
        document.querySelector('.modal-content').classList.add('mobile-full');
    } else {
        document.querySelector('.modal-content').classList.remove('mobile-full');
    }
}

// Calculate time remaining until a given GI time
function calculateTimeRemaining(giTimeStr) {
    // Parse the giTime string (format: HH:MM:SS)
    const [hours, minutes, seconds] = giTimeStr.split(':').map(num => parseInt(num, 10));
    
    // Create today's date with the GI time
    const now = new Date();
    const giTime = new Date(now);
    giTime.setHours(hours, minutes, seconds, 0);
    
    // If giTime is in the past for today, it's likely meant for tomorrow
    if (giTime < now) {
        giTime.setDate(giTime.getDate() + 1);
    }
    
    // Calculate the time difference in milliseconds
    const diffMs = giTime - now;
    
    // Convert to hours, minutes, seconds
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return {
        total: diffMs,
        hours: diffHours,
        minutes: diffMinutes,
        seconds: diffSeconds,
        expired: diffMs <= 0
    };
}

// Get the countdown class based on time remaining
function getCountdownClass(timeObj) {
    if (timeObj.expired) {
        return 'countdown-expired';
    } else if (timeObj.hours === 0 && timeObj.minutes < 30) {
        return 'countdown-critical';
    } else if (timeObj.hours === 0) {
        return 'countdown-warning';
    } else {
        return 'countdown-normal';
    }
}

// Update all the countdowns - KEEP this to update the color-coding
function updateCountdowns() {
    const countdownElements = document.querySelectorAll('.countdown');
    countdownElements.forEach(element => {
        const giTime = element.getAttribute('data-gi-time');
        if (giTime && giTime !== 'No GI Time') {
            const timeRemaining = calculateTimeRemaining(giTime);
            
            // Update the class for styling
            element.className = 'countdown ' + getCountdownClass(timeRemaining);
            
            // Also update the group header class
            const groupHeader = element.closest('.group-header');
            if (groupHeader) {
                // Remove any existing countdown classes
                groupHeader.classList.remove('countdown-normal', 'countdown-warning', 'countdown-critical', 'countdown-expired');
                // Add the appropriate class
                groupHeader.classList.add(getCountdownClass(timeRemaining));
            }
        }
    });
}

// Render the table with grouped data
function renderTable() {
    // Clear existing table data
    tableBody.innerHTML = '';
    
    // If no data, show message
    if (filteredData.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = '<td colspan="9">No data found</td>';
        tableBody.appendChild(noDataRow);
        return;
    }
    
    // Get the GI Times sorted
    const giTimes = Object.keys(groupedData).sort();
    
    // Determine if we're in mobile view to adjust behavior
    const mobileMode = isMobileView();
    
    // Display all groups (no pagination)
    for (let i = 0; i < giTimes.length; i++) {
        const giTime = giTimes[i];
        const groupItems = groupedData[giTime];
        
        // Calculate time remaining for this GI TIME (keep for color coding)
        let timeRemainingObj = { expired: true }; // Default to expired
        let countdownClass = 'countdown-expired';
        
        if (giTime !== 'No GI Time') {
            timeRemainingObj = calculateTimeRemaining(giTime);
            countdownClass = getCountdownClass(timeRemainingObj);
        }
        
        // Calculate the count of deliveries in this group
        const deliveryCount = groupItems.length;
        
        // Auto-expand groups if on mobile and there are few items (better UX)
        if (mobileMode && deliveryCount <= 5 && !expandedGroups.hasOwnProperty(giTime)) {
            expandedGroups[giTime] = true;
        }
        
        // Check if this group is expanded
        const isExpanded = expandedGroups[giTime] || false;
        const expandBtnIcon = isExpanded ? '−' : '+'; // Minus sign for collapse, plus sign for expand
        
        // Create a full-width row for the group header
        const headerRow = document.createElement('tr');
        headerRow.className = `group-header ${countdownClass}`;
        headerRow.innerHTML = `<td colspan="9"></td>`;
        tableBody.appendChild(headerRow);
        
        // Create the header content as an absolutely positioned overlay
        const headerContent = document.createElement('div');
        headerContent.className = 'group-header-content';
        headerContent.innerHTML = `
            <button class="group-toggle-btn" data-gi-time="${giTime}">
                ${expandBtnIcon}
            </button>
            <span class="group-time">${giTime}</span>
            <span class="group-count">(${deliveryCount} deliveries)</span>
            <span class="countdown hidden" data-gi-time="${giTime}"></span>
        `;
        
        // Add the header content to the first cell of the header row
        headerRow.cells[0].appendChild(headerContent);
        
        // Add click event to the button
        headerRow.querySelector('.group-toggle-btn').addEventListener('click', function(e) {
            // Prevent the row click event from triggering
            e.stopPropagation();
            toggleGroupExpansion(this.getAttribute('data-gi-time'));
        });
        
        // Add click event to the entire row for expanding/collapsing (mobile friendly)
        headerRow.addEventListener('click', function() {
            const giTime = this.querySelector('.group-toggle-btn').getAttribute('data-gi-time');
            toggleGroupExpansion(giTime);
        });
        
        // If this group is expanded, show its items
        if (isExpanded) {
            groupItems.forEach(item => {
                const itemRow = document.createElement('tr');
                itemRow.className = 'group-item';
                
                // Add click event to show detail modal
                itemRow.addEventListener('click', () => {
                    showDeliveryDetails(item);
                });
                
                // Get the priority class for styling
                const priorityClass = getPriorityClass(item['DELIVERY PRIORITY']);
                
                // Get country flag - make sure it's displayed properly
                const countryFlag = getCountryFlag(item.COUNTRY);
                const countryDisplay = countryFlag ? `${countryFlag} ${item.COUNTRY || ''}` : (item.COUNTRY || '');
                
                // Add cells for each column we want to display
                itemRow.innerHTML = `
                    <td class="col-delivery">${item.DELIVERY || ''}</td>
                    <td class="col-priority"><div class="priority-square ${priorityClass}">${item['DELIVERY PRIORITY'] || ''}</div></td>
                    <td class="col-status">${item.STATUS || ''}</td>
                    <td class="col-created">${item.CREATED || ''}</td>
                    <td class="col-time">${item.TIME || ''}</td>
                    <td class="col-gidate">${item['GI DATE'] || ''}</td>
                    <td class="col-gitime">${item['GI TIME'] || ''}</td>
                    <td class="col-country">${countryDisplay}</td>
                    <td class="col-hus">${item.HUS || ''}</td>
                `;
                
                tableBody.appendChild(itemRow);
            });
        }
    }
}
let map;
let markers = [];
let polyline;
let processedData = null; // Variable to store the processed data

// Custom marker icons
const originIcon = L.icon({
    iconUrl: '/static/img/location-pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -32]
});

const destinationIcon = L.icon({
    iconUrl: '/static/img/location-pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -32]
});

const waypointIcon = L.icon({
    iconUrl: '/static/img/pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -32]
});

const tollBoothIcon = L.icon({
    iconUrl: '/static/img/toll.png',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
}

function showAlert(message) {
    const alert = document.getElementById('validation-alert');
    alert.textContent = message;
    alert.classList.add('show');
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function clearMap() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    if (polyline) {
        map.removeLayer(polyline);
    }
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(price);
}

function addMarker(lat, lng, title, type = 'default', tooltipData = null) {
    let icon;
    switch(type) {
        case 'origin':
            icon = originIcon;
            break;
        case 'destination':
            icon = destinationIcon;
            break;
        case 'waypoint':
            icon = waypointIcon;
            break;
        case 'toll':
            icon = tollBoothIcon;
            break;
        default:
            icon = originIcon;
    }

    const marker = L.marker([lat, lng], {
        icon: icon,
        title: title
    }).addTo(map);
    
    if (tooltipData) {
        const tooltipContent = `
            <div class="marker-tooltip">
                <h4>${tooltipData.name}</h4>
                ${tooltipData.address ? `<p>${tooltipData.address}</p>` : ''}
                ${tooltipData.price ? `<p class="toll-price">${formatPrice(tooltipData.price)}</p>` : ''}
            </div>
        `;
        marker.bindPopup(tooltipContent);
    } else if (title) {
        marker.bindPopup(title);
    }
    
    markers.push(marker);
    return marker;
}

function drawRoute(coordinates) {
    if (polyline) {
        map.removeLayer(polyline);
    }
    polyline = L.polyline(coordinates, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Fit map to show all markers and route
    const bounds = polyline.getBounds();
    markers.forEach(marker => bounds.extend(marker.getLatLng()));
    map.fitBounds(bounds, { padding: [50, 50] });
}

function validateInputs() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const waypoints = Array.from(document.querySelectorAll('.waypoint-input'))
        .map(input => input.value)
        .filter(value => value.trim() !== '');
        
    if (!origin || !destination) {
        showAlert('Please enter both origin and destination');
        return false;
    }

    // Check if no via points are entered
    if (waypoints.length === 0) {
        showAlert('Please enter at least one via point');
        return false;
    }
    
    return true;
}

async function calculateToll() {
    if (!validateInputs()) return;

    const button = document.getElementById('search-button');
    setLoading(button, true);
    clearMap();

    try {
        const origin = document.getElementById('origin').value;
        const destination = document.getElementById('destination').value;
        const journeyType = document.getElementById('journey-type').value;
        
        const waypoints = Array.from(document.querySelectorAll('.waypoint-input'))
            .map(input => input.value)
            .filter(value => value.trim() !== '');

        const response = await fetch('/get_toll_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                origin,
                destination,
                waypoints,
                journey_type: journeyType
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMessage;
            
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || 'Failed to calculate toll';
            } else {
                const text = await response.text();
                errorMessage = text || 'Failed to calculate toll';
            }
            
            if (response.status === 400) {
                showAlert(`Invalid request: ${errorMessage}. Please check your inputs.`);
            } else {
                showAlert(errorMessage);
            }
            return;
        }

        const data = await response.json();
        
        // Validate required data
        if (!data.origin_coords || !data.destination_coords || !data.route_coordinates) {
            showAlert('Could not plot the route. Please try different locations.');
            return;
        }
        
        // Add markers and draw route
        try {
            // Add origin marker
            if (Array.isArray(data.origin_coords) && data.origin_coords.length === 2) {
                addMarker(data.origin_coords[0], data.origin_coords[1], origin, 'origin');
            }
            
            // Add waypoint markers
            if (data.waypoint_coords && Array.isArray(data.waypoint_coords)) {
                waypoints.forEach((waypoint, index) => {
                    const coords = data.waypoint_coords[index];
                    if (Array.isArray(coords) && coords.length === 2) {
                        addMarker(coords[0], coords[1], waypoint, 'waypoint');
                    }
                });
            }
            
            // Add toll booth markers
            if (data.toll_booths && Array.isArray(data.toll_booths)) {
                data.toll_booths.forEach(booth => {
                    if (booth.coords && Array.isArray(booth.coords) && booth.coords.length === 2) {
                        addMarker(booth.coords[0], booth.coords[1], booth.name, 'toll', booth);
                    }
                });
            }
            
            // Add destination marker
            if (Array.isArray(data.destination_coords) && data.destination_coords.length === 2) {
                addMarker(data.destination_coords[0], data.destination_coords[1], destination, 'destination');
            }
            
            // Draw the route if coordinates are valid
            if (Array.isArray(data.route_coordinates) && data.route_coordinates.length > 0) {
                drawRoute(data.route_coordinates);
            }

            // Update toll info with safe defaults
            document.getElementById('total-tolls').textContent = data.toll_count || '0';
            document.getElementById('total-price').textContent = formatPrice(data.total_toll_price || 0);
            document.querySelector('.toll-info').classList.add('visible');
        } catch (markerError) {
            console.error('Error adding markers:', markerError);
            showAlert('Error displaying route on map');
        }

    } catch (error) {
        console.error('Error:', error);
        showAlert('Network error. Please try again.');
    } finally {
        setLoading(button, false);
    }
}

function addWaypointInput() {
    const container = document.getElementById('waypoints-container');
    const waypointDiv = document.createElement('div');
    waypointDiv.className = 'waypoint-container';
    
    // Check if this is the first via point
    const isFirstViaPoint = container.children.length === 0;
    
    waypointDiv.innerHTML = `
        <input type="text" class="waypoint-input" placeholder="Enter via point">
        ${!isFirstViaPoint ? `
        <button type="button" class="waypoint-btn remove-waypoint">
            <span class="material-icons">remove</span>
        </button>
        ` : ''}
    `;
    
    container.appendChild(waypointDiv);
    
    // Only add remove event listener if it's not the first via point
    if (!isFirstViaPoint) {
        waypointDiv.querySelector('.remove-waypoint').addEventListener('click', function() {
            container.removeChild(waypointDiv);
        });
    }
}

// Handle coordinates toggle
document.addEventListener('DOMContentLoaded', function() {
    const coordinatesToggle = document.getElementById('coordinates-toggle');
    const locationInput = document.getElementById('location-input');
    const coordinatesInput = document.getElementById('coordinates-input');

    coordinatesToggle.addEventListener('change', function() {
        if (this.checked) {
            locationInput.style.display = 'none';
            coordinatesInput.style.display = 'block';
        } else {
            locationInput.style.display = 'block';
            coordinatesInput.style.display = 'none';
        }
    });
});

async function getFuelPrice() {
    const isUsingCoordinates = document.getElementById('coordinates-toggle').checked;
    const fuelType = document.getElementById('fuel-type').value;
    let location;
    
    if (isUsingCoordinates) {
        const lat = document.getElementById('fuel-lat').value.trim();
        const lng = document.getElementById('fuel-lng').value.trim();
        
        if (!lat || !lng) {
            showAlert('Please enter both latitude and longitude');
            return;
        }
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            showAlert('Please enter valid coordinates');
            return;
        }
        
        location = `${lat},${lng}`;
    } else {
        location = document.getElementById('fuel-location').value.trim();
        if (!location) {
            showAlert('Please enter a location');
            return;
        }
    }
    
    const button = document.getElementById('fuel-search-button');
    setLoading(button, true);
    
    try {
        const response = await fetch('/get_fuel_price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location,
                fuel_type: fuelType,
                is_coordinates: isUsingCoordinates
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            showAlert(data.error || 'Failed to fetch fuel price');
            return;
        }

        // Get the city data from the response
        const cityKey = Object.keys(data)[0];
        const cityData = data[cityKey];
        
        if (!cityData) {
            showAlert('No fuel price data available for this location');
            return;
        }

        // Get the price based on fuel type
        const price = cityData[`${fuelType}_price`];
        
        if (price === null || price === undefined) {
            showAlert(`${fuelType.toUpperCase()} price not available for this location`);
            return;
        }

        // Hide toll info if visible
        const tollInfo = document.querySelector('.toll-info');
        if (tollInfo) {
            tollInfo.classList.remove('visible');
        }

        // Update and show fuel price info
        const fuelPriceInfo = document.querySelector('.fuel-price-info');
        const locationElement = fuelPriceInfo.querySelector('.fuel-location');
        const typeElement = fuelPriceInfo.querySelector('.fuel-type');
        const priceElement = fuelPriceInfo.querySelector('.fuel-price');
        
        locationElement.textContent = isUsingCoordinates ? location : location.toUpperCase();
        typeElement.textContent = `${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Price`;
        priceElement.textContent = `₹${price.toFixed(2)}`;
        
        fuelPriceInfo.classList.add('visible');
        
        // Clear any previous map markers
        clearMap();
        
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to fetch fuel price');
    } finally {
        setLoading(button, false);
    }
}

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    const tollTab = document.getElementById('toll-tab');
    const fuelTab = document.getElementById('fuel-tab');
    const bulkTab = document.getElementById('bulk-tab');
    const tollForm = document.getElementById('toll-form');
    const fuelForm = document.getElementById('fuel-form');
    const bulkForm = document.getElementById('bulk-form');
    const tollInfo = document.querySelector('.toll-info');
    const fuelPriceInfo = document.querySelector('.fuel-price-info');
    
    // Initialize the UI state
    fuelForm.style.display = 'none';
    bulkForm.style.display = 'none';
    
    function switchToTab(activeTab) {
        // Remove active class from all tabs
        [tollTab, fuelTab, bulkTab].forEach(tab => tab.classList.remove('active'));
        
        // Hide all forms
        tollForm.style.display = 'none';
        fuelForm.style.display = 'none';
        bulkForm.style.display = 'none';
        
        // Hide info panels
        if (tollInfo) tollInfo.classList.remove('visible');
        if (fuelPriceInfo) fuelPriceInfo.classList.remove('visible');
        
        // Show active tab content
        activeTab.classList.add('active');
        
        // Show corresponding form
        switch(activeTab.id) {
            case 'toll-tab':
                tollForm.style.display = 'block';
                if (tollInfo) tollInfo.classList.add('visible');
                break;
            case 'fuel-tab':
                fuelForm.style.display = 'block';
                break;
            case 'bulk-tab':
                bulkForm.style.display = 'block';
                break;
        }
        
        // Reset map view
        clearMap();
        map.setView([20.5937, 78.9629], 5);
    }
    
    // Add click handlers for tabs
    tollTab.addEventListener('click', () => {
        switchToTab(tollTab);
        isPasswordVerified = false; // Reset bulk password verification
    });
    
    fuelTab.addEventListener('click', () => {
        switchToTab(fuelTab);
        isPasswordVerified = false; // Reset bulk password verification
    });
    
    bulkTab.addEventListener('click', () => {
        switchToTab(bulkTab);
        
        // Reset password field and hide options if not verified
        if (!isPasswordVerified) {
            const passwordInput = document.getElementById('bulk-password');
            if (passwordInput) passwordInput.value = '';
            const bulkOptions = document.getElementById('bulk-options');
            const bulkPasswordSection = document.getElementById('bulk-password-section');
            if (bulkOptions) bulkOptions.style.display = 'none';
            if (bulkPasswordSection) bulkPasswordSection.style.display = 'block';
        }
    });
    
    // Add click handler for fuel search button
    const fuelSearchButton = document.getElementById('fuel-search-button');
    if (fuelSearchButton) {
        fuelSearchButton.addEventListener('click', getFuelPrice);
    }
    
    // Add click handler for toll search button
    const tollSearchButton = document.getElementById('search-button');
    if (tollSearchButton) {
        tollSearchButton.addEventListener('click', calculateToll);
    }
    
    // Add waypoint button
    const addWaypointButton = document.getElementById('add-waypoint');
    if (addWaypointButton) {
        addWaypointButton.addEventListener('click', addWaypointInput);
    }
    
    // Add initial via point without remove button
    if (document.getElementById('waypoints-container').children.length === 0) {
        addWaypointInput();
    }
});

// Remove the old event listeners
const oldTollTab = document.getElementById('toll-tab');
const oldFuelTab = document.getElementById('fuel-tab');
const oldBulkTab = document.getElementById('bulk-tab');

if (oldTollTab) {
    const oldClone = oldTollTab.cloneNode(true);
    oldTollTab.parentNode.replaceChild(oldClone, oldTollTab);
}

if (oldFuelTab) {
    const oldClone = oldFuelTab.cloneNode(true);
    oldFuelTab.parentNode.replaceChild(oldClone, oldFuelTab);
}

if (oldBulkTab) {
    const oldClone = oldBulkTab.cloneNode(true);
    oldBulkTab.parentNode.replaceChild(oldClone, oldBulkTab);
}

// Initialize map
initMap();

// Bulk Operations Password Protection
let isPasswordVerified = false;

// Valid journey types
const VALID_JOURNEY_TYPES = [
    '4TO6AX_SJ', '4TO6AX_RJ', '4TO6AX_MP',
    'HCM_EME_SJ', 'HCM_EME_RJ', 'HCM_EME_MP',
    '7AX_SJ', '7AX_RJ', '7AX_MP'
];

document.getElementById('bulk-tab').addEventListener('click', async function() {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    this.classList.add('active');
    
    document.getElementById('toll-form').style.display = 'none';
    document.getElementById('fuel-form').style.display = 'none';
    document.getElementById('bulk-form').style.display = 'block';
    
    try {
        const response = await fetch('/check_bulk_access');
        const data = await response.json();
        
        if (data.verified) {
            isPasswordVerified = true;
            document.getElementById('bulk-password-section').style.display = 'none';
            const bulkOptions = document.getElementById('bulk-options');
            bulkOptions.style.display = 'block';
            bulkOptions.classList.add('visible');
        } else {
            isPasswordVerified = false;
            document.getElementById('bulk-password').value = '';
            document.getElementById('bulk-options').style.display = 'none';
            document.getElementById('bulk-password-section').style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking bulk access:', error);
        isPasswordVerified = false;
        document.getElementById('bulk-password').value = '';
        document.getElementById('bulk-options').style.display = 'none';
        document.getElementById('bulk-password-section').style.display = 'block';
    }
});

// Password verification function
async function verifyPassword(password) {
    try {
        const response = await fetch('/verify_bulk_password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();
        return {
            success: response.ok,
            message: data.message
        };
    } catch (error) {
        console.error('Password verification error:', error);
        return {
            success: false,
            message: 'An error occurred during password verification'
        };
    }
}

// Check bulk access function
async function checkBulkAccess() {
    try {
        const response = await fetch('/check_bulk_access');
        const data = await response.json();
        return data.verified;
    } catch (error) {
        console.error('Bulk access check error:', error);
        return false;
    }
}

// Update password verification event listener
document.getElementById('verify-password').addEventListener('click', async function() {
    const passwordInput = document.getElementById('bulk-password');
    const password = passwordInput.value.trim();
    
    if (!password) {
        showError('Please enter the password');
        return;
    }
    
    const result = await verifyPassword(password);
    if (result.success) {
        document.getElementById('bulk-password-section').style.display = 'none';
        document.getElementById('bulk-options').style.display = 'block';
        passwordInput.value = '';
    } else {
        showError(result.message);
    }
});

// Update bulk tab click handler
document.getElementById('bulk-tab').addEventListener('click', async function() {
    const hasAccess = await checkBulkAccess();
    if (hasAccess) {
        document.getElementById('bulk-password-section').style.display = 'none';
        document.getElementById('bulk-options').style.display = 'block';
    } else {
        document.getElementById('bulk-password-section').style.display = 'block';
        document.getElementById('bulk-options').style.display = 'none';
    }
});

// File Upload Handling
document.addEventListener('DOMContentLoaded', function() {
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('bulk-file');
    const browseButton = document.getElementById('browse-files');
    const processButton = document.getElementById('process-bulk');
    const fileInfo = document.querySelector('.file-info');
    const fileName = document.querySelector('.file-name');

    if (!dropzone || !fileInput || !browseButton || !processButton || !fileInfo || !fileName) {
        console.error('Some elements are missing:', {
            dropzone: !!dropzone,
            fileInput: !!fileInput,
            browseButton: !!browseButton,
            processButton: !!processButton,
            fileInfo: !!fileInfo,
            fileName: !!fileName
        });
        return;
    }

    console.log('File upload elements initialized');

    // Handle drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
        console.log('File drag over');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
        console.log('File drag leave');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
        console.log('File dropped');
        
        const files = e.dataTransfer.files;
        if (files.length) {
            console.log('Dropped file:', files[0].name);
            handleFileSelection(files[0]);
        }
    });

    // Handle browse button
    browseButton.addEventListener('click', () => {
        console.log('Browse button clicked');
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        console.log('File input changed');
        if (e.target.files.length) {
            console.log('Selected file:', e.target.files[0].name);
            handleFileSelection(e.target.files[0]);
        }
    });

    // Handle file removal
    const removeFileButton = document.querySelector('.remove-file');
    if (removeFileButton) {
        removeFileButton.addEventListener('click', () => {
            console.log('Removing file');
            fileInput.value = '';
            fileInfo.style.display = 'none';
            processButton.disabled = true;
            dropzone.querySelector('.dropzone-content').style.display = 'flex';
        });
    }

    function handleFileSelection(file) {
        console.log('Handling file selection:', file.name);
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showAlert('Please upload a CSV file');
            return;
        }
        
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
        dropzone.querySelector('.dropzone-content').style.display = 'none';
        processButton.disabled = false;
        
        // Store the file in the input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
    }

    // Handle bulk processing
    processButton.addEventListener('click', function() {
        console.log('Process button clicked');
        console.log('File input files:', fileInput.files);
        
        const file = fileInput.files[0];
        if (!file) {
            console.error('No file selected');
            showAlert('Please select a file to process');
            return;
        }
        
        console.log('Processing file:', file.name);
        processCSVFile(file);
    });
});

// Parse CSV with proper handling of quoted values and commas
function parseCSV(text) {
    const rows = text.split(/\r?\n/);
    const result = [];
    
    for (let row of rows) {
        if (!row.trim()) continue; // Skip empty rows
        
        const cells = [];
        let cell = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            
            if (char === '"') {
                if (inQuotes && row[i + 1] === '"') {
                    // Handle escaped quotes
                    cell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                cells.push(cell.trim());
                cell = '';
            } else {
                cell += char;
            }
        }
        
        cells.push(cell.trim());
        if (cells.some(cell => cell !== '')) { // Only add non-empty rows
            result.push(cells);
        }
    }
    
    return result;
}

// Validate CSV data with enhanced checks
function validateCSVData(data) {
    const errors = [];
    const requiredColumns = ['origin', 'destination', 'journey_type', 'way_points'];
    
    if (!data || data.length < 2) {
        return { isValid: false, errors: ['File is empty or contains no data rows'] };
    }
    
    // Check header
    const header = data[0].map(col => col.toLowerCase());
    requiredColumns.forEach(col => {
        if (!header.includes(col)) {
            errors.push(`Missing required column: ${col}`);
        }
    });
    
    if (errors.length) return { isValid: false, errors, invalidRows: [] };
    
    // Validate each row
    const invalidRows = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;
        const rowErrors = [];
        
        // Skip empty rows
        if (row.every(cell => !cell.trim())) {
            continue;
        }
        
        // Check if row has correct number of columns
        if (row.length !== header.length) {
            rowErrors.push(`Invalid number of columns (expected ${header.length}, got ${row.length})`);
            invalidRows.push({ rowNum, row, errors: rowErrors });
            continue;
        }
        
        const originIdx = header.indexOf('origin');
        const destIdx = header.indexOf('destination');
        const journeyTypeIdx = header.indexOf('journey_type');
        const waypointsIdx = header.indexOf('way_points');
        
        // Validate origin and destination
        if (!row[originIdx] || !row[originIdx].trim()) {
            rowErrors.push('Origin is required');
        } else if (isCoordinates(row[originIdx])) {
            if (!validateCoordinates(row[originIdx])) {
                rowErrors.push('Invalid origin coordinates format (should be "lat,lng" with valid ranges)');
            }
        }
        
        if (!row[destIdx] || !row[destIdx].trim()) {
            rowErrors.push('Destination is required');
        } else if (isCoordinates(row[destIdx])) {
            if (!validateCoordinates(row[destIdx])) {
                rowErrors.push('Invalid destination coordinates format (should be "lat,lng" with valid ranges)');
            }
        }
        
        // Validate waypoints - make at least one via point mandatory
        if (!row[waypointsIdx] || !row[waypointsIdx].trim()) {
            rowErrors.push('At least one via point is required');
        } else {
            const waypoints = row[waypointsIdx].split(',').map(wp => wp.trim()).filter(wp => wp);
            if (waypoints.length === 0) {
                rowErrors.push('At least one via point is required');
            } else {
                for (let wp of waypoints) {
                    if (isCoordinates(wp) && !validateCoordinates(wp)) {
                        rowErrors.push(`Invalid via point coordinates format: ${wp}`);
                    }
                }
            }
        }
        
        // Validate journey type
        if (!row[journeyTypeIdx] || !VALID_JOURNEY_TYPES.includes(row[journeyTypeIdx])) {
            rowErrors.push(`Invalid journey type: ${row[journeyTypeIdx] || 'empty'}. Must be one of: ${VALID_JOURNEY_TYPES.join(', ')}`);
        }
        
        if (rowErrors.length) {
            invalidRows.push({ rowNum, row, errors: rowErrors });
        }
    }
    
    return {
        isValid: invalidRows.length === 0,
        errors: [],
        invalidRows
    };
}

// Helper function to check if a string represents coordinates
function isCoordinates(str) {
    return /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(str.trim());
}

// Helper function to validate coordinate ranges
function validateCoordinates(str) {
    const [lat, lng] = str.split(',').map(coord => parseFloat(coord.trim()));
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
}

// Create error CSV with highlighting
function createErrorCSV(data, validation) {
    const header = [...data[0], 'Validation Errors', 'Status'];
    const rows = [header];
    
    // Process each row
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const invalidRow = validation.invalidRows.find(r => r.rowNum === i + 1);
        
        if (invalidRow) {
            // Add error information for invalid rows
            rows.push([
                ...row,
                invalidRow.errors.join('; '),
                'ERROR'
            ]);
        } else {
            // Add row without errors
            rows.push([...row, '', 'VALID']);
        }
    }
    
    return rows.map(row => row.map(cell => {
        if (cell === null || cell === undefined) return '';
        // Escape special characters and wrap in quotes if needed
        const cellStr = cell.toString();
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    }).join(',')).join('\n');
}

// Process the CSV file
async function processCSVFile(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const text = e.target.result;
        const data = parseCSV(text);
        
        // Show validation progress
        const validationProgress = document.querySelector('.validation-progress');
        validationProgress.style.display = 'block';
        const validationFill = validationProgress.querySelector('.progress-fill');
        validationFill.style.width = '30%';
        
        try {
            // Validate data
            const validation = validateCSVData(data);
            validationFill.style.width = '100%';
            
            if (!validation.isValid) {
                // Create error CSV
                const errorCSV = createErrorCSV(data, validation);
                downloadCSV(errorCSV, 'toll_calculation_validation_errors.csv');
                
                const errorMessage = validation.invalidRows.length === 1 
                    ? '1 row contains errors.' 
                    : `${validation.invalidRows.length} rows contain errors.`;
                    
                showAlert(`Validation failed. ${errorMessage} Check downloaded error report.`);
                validationProgress.style.display = 'none';
                return;
            }
            
            // Hide validation progress
            setTimeout(() => {
                validationProgress.style.display = 'none';
                
                // Show processing progress
                const processingProgress = document.querySelector('.processing-progress');
                processingProgress.style.display = 'block';
                const progressFill = processingProgress.querySelector('.progress-fill');
                const progressCount = processingProgress.querySelector('.progress-count');
                
                // Process each row
                processRows(data, progressFill, progressCount).then(processedData => {
                    // Download result
                    downloadCSV(processedData, 'toll_calculation_results.csv');
                    processingProgress.style.display = 'none';
                    
                    // Show success message below the process button
                    const successMessage = document.createElement('div');
                    successMessage.className = 'success-message';
                    successMessage.style.cssText = 'color: #059669; margin-top: 10px; text-align: center; font-size: 14px;';
                    successMessage.innerHTML = `
                        <span class="material-icons" style="vertical-align: middle; font-size: 16px; margin-right: 4px;">check_circle</span>
                        Processing complete. Results downloaded successfully.
                    `;
                    
                    // Insert after the process button
                    const processButton = document.getElementById('process-bulk');
                    processButton.parentNode.insertBefore(successMessage, processButton.nextSibling);
                    
                    // Remove the message after 5 seconds
                    setTimeout(() => {
                        if (successMessage.parentNode) {
                            successMessage.parentNode.removeChild(successMessage);
                        }
                    }, 5000);
                    
                }).catch(error => {
                    console.error('Error processing rows:', error);
                    showAlert('Error processing file. Please check the downloaded error report.');
                    processingProgress.style.display = 'none';
                });
            }, 1000);
        } catch (error) {
            console.error('Error processing file:', error);
            showAlert('Error processing file. Please try again.');
            validationProgress.style.display = 'none';
        }
    };
    
    reader.onerror = function() {
        showAlert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

// Process rows with better error handling
async function processRows(data, progressFill, progressCount) {
    const header = [...data[0], 'number_of_tolls', 'total_toll_price', 'status', 'error_message'];
    const rows = [header];
    const total = data.length - 1;
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const progress = (i / total) * 100;
        progressFill.style.width = `${progress}%`;
        progressCount.textContent = `${i}/${total}`;
        
        try {
            // Process row with retry logic
            let retries = 3;
            let result;
            let error = null;
            
            while (retries > 0) {
                try {
                    result = await processSingleRow(row, data[0]);
                    break;
                } catch (err) {
                    error = err;
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (result) {
                rows.push([
                    ...row,
                    result.toll_count || 0,
                    result.total_toll_price || 0,
                    'SUCCESS',
                    ''
                ]);
            } else {
                throw error || new Error('Failed to process row after retries');
            }
        } catch (error) {
            console.error(`Error processing row ${i}:`, error);
            rows.push([
                ...row,
                0,
                0,
                'ERROR',
                error.message || 'Unknown error'
            ]);
        }
    }
    
    return rows.map(row => row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const cellStr = cell.toString();
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    }).join(',')).join('\n');
}

// Process single row with better error handling
async function processSingleRow(row, header) {
    const originIndex = header.indexOf('origin');
    const destinationIndex = header.indexOf('destination');
    const waypointsIndex = header.indexOf('way_points');
    const journeyTypeIndex = header.indexOf('journey_type');
    
    // Get values directly without parsing coordinates
    const origin = row[originIndex].trim();
    const destination = row[destinationIndex].trim();
    
    // Parse waypoints
    let waypoints = [];
    if (waypointsIndex >= 0 && row[waypointsIndex]) {
        // Split waypoints by comma, but handle quoted values
        waypoints = row[waypointsIndex]
            .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map(wp => wp.trim().replace(/^"|"$/g, ''))
            .filter(wp => wp); // Remove empty waypoints
    }
    
    const requestData = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        journey_type: row[journeyTypeIndex].trim()
    };
    
    try {
        const response = await fetch('/get_toll_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMessage;
            
            try {
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error || 'Unknown error';
                } else {
                    const text = await response.text();
                    errorMessage = text || response.statusText || 'Unknown error';
                }
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (!result) {
            throw new Error('Empty response from server');
        }
        
        return result;
    } catch (error) {
        console.error('Row processing error:', {
            requestData,
            error: error.message
        });
        throw new Error(`Failed to process row: ${error.message}`);
    }
}

// Download CSV with proper encoding
function downloadCSV(csv, filename) {
    // Add BOM for Excel compatibility
    const csvContent = '\ufeff' + csv;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showDownloadSection(data) {
    processedData = data;
    document.querySelector('.download-results').classList.add('visible');
}

function hideDownloadSection() {
    document.querySelector('.download-results').classList.remove('visible');
    processedData = null;
}

function downloadResults() {
    if (!processedData) return;
    
    const blob = new Blob([processedData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `toll_results_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Add event listeners
document.getElementById('download-results').addEventListener('click', downloadResults);

// Update your existing file upload and processing code
function handleFileUpload(file) {
    // ... existing file upload code ...
    
    // Hide download section when new file is uploaded
    hideDownloadSection();
}

async function processBulkFile() {
    // ... existing processing code ...
    
    try {
        // After successful processing
        showDownloadSection(processedData);
    } catch (error) {
        console.error('Processing failed:', error);
        showAlert('Failed to process file. Please try again.');
    }
} 
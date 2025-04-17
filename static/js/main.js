let map;
let markers = [];
let polyline;

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

    // Check if no waypoints are entered
    if (waypoints.length === 0) {
        return confirm(
            'You haven\'t entered any waypoints. Without waypoints, there might be multiple possible routes between your origin and destination, which could affect toll calculations.\n\nAre you sure you want to continue?'
        );
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
    
    waypointDiv.innerHTML = `
        <input type="text" class="waypoint-input" placeholder="Enter waypoint">
        <button type="button" class="waypoint-btn remove-waypoint">
            <span class="material-icons">remove</span>
        </button>
    `;
    
    container.appendChild(waypointDiv);
    
    waypointDiv.querySelector('.remove-waypoint').addEventListener('click', function() {
        container.removeChild(waypointDiv);
    });
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
    const tollForm = document.getElementById('toll-form');
    const fuelForm = document.getElementById('fuel-form');
    const tollInfo = document.querySelector('.toll-info');
    const fuelPriceInfo = document.querySelector('.fuel-price-info');
    
    // Initialize the UI state
    fuelForm.style.display = 'none';
    
    tollTab.addEventListener('click', () => {
        tollTab.classList.add('active');
        fuelTab.classList.remove('active');
        tollForm.style.display = 'block';
        fuelForm.style.display = 'none';
        
        // Show toll info, hide fuel info
        if (tollInfo) tollInfo.classList.add('visible');
        if (fuelPriceInfo) fuelPriceInfo.classList.remove('visible');
        
        clearMap();
        map.setView([20.5937, 78.9629], 5);
    });
    
    fuelTab.addEventListener('click', () => {
        fuelTab.classList.add('active');
        tollTab.classList.remove('active');
        fuelForm.style.display = 'block';
        tollForm.style.display = 'none';
        
        // Hide toll info, show fuel info if there's data
        if (tollInfo) tollInfo.classList.remove('visible');
        
        clearMap();
        map.setView([20.5937, 78.9629], 5);
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
    document.getElementById('add-waypoint').addEventListener('click', addWaypointInput);
    
    // Add initial waypoint
    addWaypointInput();
});

// Initialize map
initMap(); 
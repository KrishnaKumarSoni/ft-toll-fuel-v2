from flask import Flask, render_template, request, jsonify
import requests
import os
import json
from datetime import datetime
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Keys
API_KEY = os.environ.get('LEPTON_API_KEY')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')

logger.info(f"Lepton API Key present: {'Yes' if API_KEY else 'No'}")
logger.info(f"Google Maps API Key present: {'Yes' if GOOGLE_MAPS_API_KEY else 'No'}")

# Replace with your actual API key or use environment variable
# WARNING: Do not commit your actual API key to version control!
# Recommended: Set the LEPTON_API_KEY environment variable instead
# Example: export LEPTON_API_KEY="your_actual_api_key_here"

# Sample data to use when API key is not provided
SAMPLE_TOLL_DATA = {
    "route": {
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [77.2090, 28.6139],  # Delhi
                [77.4700, 28.4400],  # Faridabad
                [77.3000, 27.9500],  # Mathura
                [76.8500, 27.2000],  # Bharatpur
                [76.7800, 26.9200]   # Jaipur
            ]
        }
    },
    "booths": [
        {
            "name": "Delhi-Faridabad Toll Plaza",
            "price": 65.0,
            "address": "NH-2, Delhi-Faridabad Border",
            "location": {"coordinates": [77.3200, 28.5000], "type": "Point"}
        },
        {
            "name": "Faridabad-Mathura Toll Plaza",
            "price": 95.0,
            "address": "NH-2, Faridabad-Mathura Road",
            "location": {"coordinates": [77.4000, 28.1500], "type": "Point"}
        },
        {
            "name": "Mathura-Bharatpur Toll Plaza",
            "price": 85.0,
            "address": "NH-2, Mathura-Bharatpur Border",
            "location": {"coordinates": [77.0500, 27.5000], "type": "Point"}
        },
        {
            "name": "Bharatpur-Jaipur Toll Plaza",
            "price": 105.0,
            "address": "NH-11, Bharatpur-Jaipur Road",
            "location": {"coordinates": [76.8000, 27.0500], "type": "Point"}
        }
    ],
    "totalTollPrice": 350.0,
    "totalTollBooths": 4
}

SAMPLE_FUEL_DATA = {
    "price": 102.50,
    "fuel_type": "petrol",
    "last_updated": datetime.now().strftime('%Y-%m-%d'),
    "location": {
        "coordinates": [77.2090, 28.6139],
        "type": "Point"
    }
}

@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=GOOGLE_MAPS_API_KEY)

@app.route('/get_toll_data', methods=['POST'])
def get_toll_data():
    # 1. Log incoming request data
    data = request.json
    logger.info("=== INCOMING REQUEST DATA ===")
    logger.info(json.dumps(data, indent=2))
    
    origin = data.get('origin', '').strip()
    destination = data.get('destination', '').strip()
    waypoints = data.get('waypoints', [])
    journey_type = data.get('journey_type')
    
    logger.info("=== PARSED REQUEST DATA ===")
    logger.info(f"Origin: {origin}")
    logger.info(f"Destination: {destination}")
    logger.info(f"Waypoints: {waypoints}")
    logger.info(f"Journey Type: {journey_type}")
    
    # Input validation
    if not origin or not destination:
        return jsonify({'error': 'Origin and destination are required'}), 400
        
    # If no API key, use sample data
    if not API_KEY:
        logger.warning("No API key found, using sample data")
        sample_result = {
            'toll_count': SAMPLE_TOLL_DATA['totalTollBooths'],
            'total_toll_price': SAMPLE_TOLL_DATA['totalTollPrice'],
            'toll_booths': [{
                'name': booth['name'],
                'price': float(booth['price']),
                'address': booth['address'],
                'coords': [float(booth['location']['coordinates'][1]), float(booth['location']['coordinates'][0])]
            } for booth in SAMPLE_TOLL_DATA['booths']],
            'route_coordinates': [[float(coord[1]), float(coord[0])] for coord in SAMPLE_TOLL_DATA['route']['geometry']['coordinates']],
            'waypoint_coords': [],
            'origin_coords': [float(SAMPLE_TOLL_DATA['route']['geometry']['coordinates'][0][1]), 
                            float(SAMPLE_TOLL_DATA['route']['geometry']['coordinates'][0][0])],
            'destination_coords': [float(SAMPLE_TOLL_DATA['route']['geometry']['coordinates'][-1][1]), 
                                 float(SAMPLE_TOLL_DATA['route']['geometry']['coordinates'][-1][0])]
        }
        return jsonify(sample_result)
    
    # Build API URL
    api_url = "https://api.leptonmaps.com/v1/toll"
    
    # Common city name corrections
    city_corrections = {
        'belary': 'bellary',
        'banglore': 'bangalore',
        'bengaluru': 'bangalore',
        'bombay': 'mumbai',
        'calcutta': 'kolkata',
        'poona': 'pune'
    }
    
    # Sanitize input
    origin = city_corrections.get(origin.lower(), origin)
    destination = city_corrections.get(destination.lower(), destination)
    waypoints = [city_corrections.get(wp.lower(), wp) for wp in waypoints]
    
    # 2. Log location formatting
    logger.info("=== ORIGINAL LOCATIONS ===")
    logger.info(f"Original Origin: {origin}")
    logger.info(f"Original Destination: {destination}")
    logger.info(f"Original Waypoints: {waypoints}")
    
    # Format locations - try without state names first
    params = {
        'origin': origin,
        'destination': destination,
        'journey_type': journey_type,
        'include_route': True,
        'include_route_metadata': True,
        'include_booths': True,
        'include_booths_locations': True
    }
    
    if waypoints:
        # Format waypoints as pipe-separated string
        params['waypoints'] = '|'.join(str(wp).strip() for wp in waypoints)
    
    logger.info("=== API REQUEST DETAILS ===")
    logger.info(f"API URL: {api_url}")
    logger.info(f"Request Parameters: {json.dumps(params, indent=2)}")
    
    headers = {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        # Make API request using GET method with query parameters
        response = requests.get(api_url, params=params, headers=headers)
        
        logger.info("=== API RESPONSE DETAILS ===")
        logger.info(f"Response Status Code: {response.status_code}")
        logger.info(f"Response Headers: {dict(response.headers)}")
        logger.info(f"Response Content Type: {response.headers.get('content-type', 'Not specified')}")
        
        # Log raw response content for debugging
        logger.info("=== RAW API RESPONSE ===")
        raw_response = response.text
        logger.info(f"Raw response content: {raw_response}")
        logger.info(f"Response length: {len(raw_response)}")
        
        if not raw_response or raw_response.isspace():
            logger.error("Empty response from API")
            return jsonify({'error': 'Empty response received from API'}), 500
            
        try:
            response_data = response.json()
            logger.info("=== PARSED API RESPONSE ===")
            logger.info(json.dumps(response_data, indent=2))
            with open('response_data.json', 'w') as f: json.dump(response_data, f, indent=2)

            
            if response.status_code != 200:
                error_msg = response_data.get('message', 'API request failed')
                logger.error(f"API Error: {error_msg}")
                return jsonify({'error': error_msg}), response.status_code
                
            if not isinstance(response_data, dict):
                logger.error(f"Unexpected response format. Expected dict, got {type(response_data)}")
                return jsonify({'error': 'Invalid response format from API'}), 500
                
            # Process toll booths
            toll_booths = []
            total_toll = 0
            
            if 'toll_booths' in response_data:
                toll_booths = response_data['toll_booths']
                logger.info("=== TOLL BOOTH DATA ===")
                logger.info(f"Raw toll booth data: {json.dumps(toll_booths[0] if toll_booths else 'No toll booths', indent=2)}")
                
                # Transform toll booth data
                transformed_booths = []
                for booth in toll_booths:
                    logger.info(f"Processing booth: {json.dumps(booth, indent=2)}")
                    
                    try:
                        # Extract direct latitude/longitude fields
                        lat = booth.get('latitude')
                        lng = booth.get('longitude')
                        
                        if lat is not None and lng is not None:
                            transformed_booth = {
                                'name': booth.get('name', 'Unknown Toll Booth'),
                                'price': float(booth.get('price', 0)),
                                'address': booth.get('route_name', ''),  # Use route_name as address
                                'coords': [float(lat), float(lng)]  # [latitude, longitude] format
                            }
                            transformed_booths.append(transformed_booth)
                            logger.info(f"Successfully transformed booth: {json.dumps(transformed_booth, indent=2)}")
                        else:
                            logger.warning(f"Missing latitude/longitude in booth: {booth}")
                            
                    except Exception as e:
                        logger.error(f"Error processing booth {booth}: {str(e)}")
                        continue
                
                # Calculate total toll
                total_toll = sum(float(booth.get('price', 0)) for booth in toll_booths)
                logger.info(f"Total toll calculated: {total_toll}")
                logger.info(f"Transformed {len(transformed_booths)} out of {len(toll_booths)} toll booths")
            
            # Process route data
            route_coordinates = []
            if 'route' in response_data and isinstance(response_data['route'], list):
                # Lepton returns coordinates as [longitude, latitude] pairs
                # Convert to [latitude, longitude] for our frontend
                route_coordinates = [[float(coord[1]), float(coord[0])] for coord in response_data['route']]
                logger.info(f"Extracted {len(route_coordinates)} route coordinates from Lepton route array")
            elif 'routes' in response_data and response_data['routes']:
                # Fallback to Google Maps format if present
                route = response_data['routes'][0]
                logger.info("=== ROUTE DATA ===")
                logger.info(f"Route data available: {bool(route)}")
                
                try:
                    import polyline
                    if 'overview_polyline' in route and 'points' in route['overview_polyline']:
                        points = polyline.decode(route['overview_polyline']['points'])
                        route_coordinates = points
                        logger.info(f"Extracted {len(route_coordinates)} route coordinates from overview_polyline")
                    else:
                        if 'legs' in route:
                            for leg in route['legs']:
                                if 'steps' in leg:
                                    for step in leg['steps']:
                                        if 'polyline' in step and 'points' in step['polyline']:
                                            points = polyline.decode(step['polyline']['points'])
                                            route_coordinates.extend(points)
                            logger.info(f"Extracted {len(route_coordinates)} route coordinates from step polylines")
                except Exception as e:
                    logger.error(f"Error processing route data: {str(e)}")
            else:
                logger.warning("No route data found in response")
            
            # If we have toll booth coordinates but no route, create a simple route through the toll booths
            if not route_coordinates and transformed_booths:
                logger.info("Creating route through toll booths")
                # Sort toll booths by distance_to_origin
                sorted_booths = sorted(toll_booths, key=lambda x: float(x.get('distance_to_origin', 0)))
                route_coordinates = [booth['coords'] for booth in transformed_booths]
                logger.info(f"Created route with {len(route_coordinates)} points through toll booths")
            
            # Prepare final response
            result = {
                'toll_count': len(transformed_booths),
                'total_toll_price': total_toll,
                'toll_booths': transformed_booths,
                'route_coordinates': route_coordinates,
                'waypoint_coords': [],  # We'll handle waypoints later if needed
                'origin_coords': route_coordinates[0] if route_coordinates else None,
                'destination_coords': route_coordinates[-1] if route_coordinates else None
            }
            
            logger.info("=== FINAL RESPONSE ===")
            logger.info(json.dumps(result, indent=2))
            
            return jsonify(result)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON Decode Error: {str(e)}")
            logger.error(f"Response text: {raw_response}")
            logger.error(f"Response status code: {response.status_code}")
            return jsonify({
                'error': 'Failed to parse API response',
                'details': str(e),
                'status_code': response.status_code
            }), 500
            
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Data Processing Error: {str(e)}")
            logger.error(f"Response text: {raw_response}")
            return jsonify({'error': f'Failed to process API response: {str(e)}'}), 500
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Request Error: {str(e)}")
        return jsonify({'error': f'API request failed: {str(e)}'}), 500

@app.route('/get_fuel_price', methods=['POST'])
def get_fuel_price():
    data = request.json
    logger.info("=== INCOMING FUEL PRICE REQUEST ===")
    logger.info(json.dumps(data, indent=2))
    
    location = data.get('location', '').strip()
    fuel_type = data.get('fuel_type', 'petrol').strip()
    is_coordinates = data.get('is_coordinates', False)
    date = datetime.now().strftime('%Y-%m-%d')
    
    if not location:
        return jsonify({'error': 'Location is required'}), 400
        
    # If no API key, use sample data
    if not API_KEY:
        logger.warning("No API key found, using sample fuel data")
        return jsonify({location.lower(): {
            f'{fuel_type}_price': 102.50,
            'diesel_price': None if fuel_type == 'petrol' else 95.20,
            'petrol_price': None if fuel_type == 'diesel' else 102.50
        }})
    
    try:
        # If not using coordinates, geocode the location first
        if not is_coordinates:
            if not GOOGLE_MAPS_API_KEY:
                logger.error("Google Maps API key not found")
                return jsonify({'error': 'Geocoding service unavailable'}), 503
                
            try:
                # Add region bias for India
                geocode_url = (
                    "https://maps.googleapis.com/maps/api/geocode/json"
                    f"?address={location}"
                    "&region=in"  # Bias results to India
                    "&components=country:IN"  # Restrict to India
                    f"&key={GOOGLE_MAPS_API_KEY}"
                )
                
                logger.info(f"Geocoding request URL: {geocode_url}")
                geocode_response = requests.get(geocode_url)
                geocode_data = geocode_response.json()
                
                logger.info(f"Geocoding response: {json.dumps(geocode_data, indent=2)}")
                
                if geocode_data['status'] == 'OK' and geocode_data['results']:
                    lat = geocode_data['results'][0]['geometry']['location']['lat']
                    lng = geocode_data['results'][0]['geometry']['location']['lng']
                    location = f"{lat},{lng}"
                    logger.info(f"Successfully geocoded to coordinates: {location}")
                else:
                    error_msg = geocode_data.get('error_message', 'Could not find coordinates for this location')
                    logger.error(f"Geocoding failed: {error_msg}")
                    return jsonify({'error': error_msg}), 400
            except Exception as e:
                logger.error(f"Geocoding error: {str(e)}")
                return jsonify({'error': 'Failed to geocode location'}), 500
        
        # Make request to the Lepton Fuel API
        fuel_api_url = 'https://api.leptonmaps.com/v1/fuel/prices'
        fuel_params = {
            'query': location,
            'date': date,
            'fuel_type': fuel_type
        }
        
        logger.info(f"Fuel API request - URL: {fuel_api_url}, Params: {json.dumps(fuel_params, indent=2)}")
        
        response = requests.get(
            fuel_api_url,
            params=fuel_params,
            headers={'x-api-key': API_KEY},
            timeout=10
        )
        
        logger.info(f"Fuel API Response Status: {response.status_code}")
        logger.info(f"Response Content: {response.text}")
        
        if response.status_code == 200:
            try:
                response_data = response.json()
                # Use the location as key for the response
                key = location.lower()
                
                # Ensure the response uses the correct key
                if response_data and isinstance(response_data, dict):
                    first_key = next(iter(response_data))
                    if first_key != key:
                        response_data = {key: response_data[first_key]}
                        
                return jsonify(response_data)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in successful response: {response.text}")
                return jsonify({'error': 'Invalid response from fuel price API'}), 500
        else:
            error_msg = 'No fuel price data available for this location'
            if response.status_code == 422:
                error_msg = 'Invalid location. Please check the coordinates or city name.'
            logger.error(f"Fuel API error: {error_msg}")
            return jsonify({'error': error_msg}), response.status_code
            
    except requests.exceptions.Timeout:
        logger.error("Timeout while calling Lepton Fuel API")
        return jsonify({'error': 'Request timed out'}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed: {str(e)}")
        return jsonify({'error': 'Failed to fetch fuel price'}), 500

if __name__ == '__main__':
    app.run(debug=True) 
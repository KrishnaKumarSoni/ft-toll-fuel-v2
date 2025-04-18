# FT Toll & Fuel Tracker

A Flask web application to track toll costs and fuel prices for routes in India.

<img width="1409" alt="image" src="https://github.com/user-attachments/assets/3e0e573d-3df2-4cd5-93f9-10f375178e69" />


## Features

- Calculate toll costs between origin and destination
- Support for multiple waypoints
- Visualize routes on OpenStreetMap
- Display toll booth locations with detailed information
- Get fuel prices for locations in India

## Setup Instructions

1. Create and activate a virtual environment:
   ```
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

2. Install required dependencies:
   ```
   pip install flask requests
   ```

3. Set your Lepton API key:
   ```
   export LEPTON_API_KEY="your_api_key_here"  # On Windows use: set LEPTON_API_KEY="your_api_key_here"
   ```
   
   **Note:** If you don't have a Lepton API key, the application will use sample data for demonstration purposes.

4. Run the application:
   ```
   python app.py
   ```

5. Open your browser and navigate to: `http://127.0.0.1:5000/`

## Usage

1. Enter origin and destination locations
2. Select the vehicle type
3. Optionally add waypoints using the "+" button
4. Click "Search Toll" to calculate toll costs and display the route
5. View toll booths and prices on the map

## API Integration

This application uses the Lepton Maps API for:
- Toll calculations based on route, vehicle type, and journey type
- Fuel price information for locations across India

## Error Handling

The application includes robust error handling for:
- API connection issues
- Invalid responses
- JSON parsing errors
- Missing API keys (falls back to sample data)

## License

MIT License 

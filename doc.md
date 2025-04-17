Toll API
The Lepton Maps Toll API calculates toll costs for various vehicle types and journey options. It provides detailed toll information, including route and toll booth locations.


Playground

get
/toll

Send
origin
Delhi
destination
Jaipur
waypoints
Enter waypoints
encoded_polyline
Enter encoded_polyline
Journey Type
PV_SJ
include_route
include_route_metadata
include_booths
include_booths_locations
Parameters
origin

Specifies the start point of the route. Accepts a place name (e.g., "Connaught Place, Delhi") or a latitude-longitude pair as a string (e.g., "28.6329, 77.2195" )

destination

Defines the end point of the route. Accepts a place name (e.g., "Hawa Mahal, Jaipur") or a latitude-longitude pair as a string (e.g., "26.9239, 75.8267")

waypoints

Specifies an array of intermediate waypoints. Accepts a place name (e.g., "Hawa Mahal, Jaipur|Kota") or a latitude-longitude pair as a string (e.g., "26.9239, 75.8267|25.2138, 75.8648")

encoded_polyline

Specifies the route as an encoded polyline format

journey_type

Supported journey_type Options
2W_SJ: Two Wheeler, Single Journey

2W_RJ: Two Wheeler, Return Journey

2W_MP: Two Wheeler, Monthly Pass

PV_SJ: Personal Vehicle, Single Journey

PV_RJ: Personal Vehicle, Return Journey

PV_MP: Personal Vehicle, Monthly Pass

LCV_SJ: Light Commercial Vehicle, Single Journey

LCV_RJ: Light Commercial Vehicle, Return Journey

LCV_MP: Light Commercial Vehicle, Monthly Journey

BUS_SJ: Bus/Truck, Single Journey

BUS_RJ: Bus/Truck, Return Journey

BUS_MP: Bus/Truck, Monthly Journey

3AX_SJ: Up to 3 Axle Vehicle, Single Journey

3AX_RJ: Up to 3 Axle Vehicle, Return Journey

3AX_MP: Up to 3 Axle Vehicle, Monthly Journey

4TO6AX_SJ: 4 to 6 Axle Vehicle, Single Journey

4TO6AX_RJ: 4 to 6 Axle Vehicle, Return Journey

4TO6AX_MP: 4 to 6 Axle Vehicle, Monthly Journey

HCM_EME_SJ: HCM/EME Vehicle, Single Journey

HCM_EME_RJ: HCM/EME Vehicle, Return Journey

HCM_EME_MP: HCM/EME Vehicle, Monthly Journey

7AX_SJ: 7 or More Axle Vehicle, Single Journey

7AX_RJ: 7 or More Axle Vehicle, Return Journey

7AX_MP: 7 or More Axle Vehicle, Monthly Journey

include_route

boolean

Boolean to include route details in the response

include_route_metadata

boolean

Boolean to include route metadata in the response. This includes the distance and duration of the route

include_booths

boolean

Boolean to include toll booth infromation in the response

include_booths_locations

boolean

Boolean to include toll booth coordinates in the response

Responses
Successful Response

200
application/json

Validation Error

422
application/json


Map View

Snippet

Javascript

axios
copy
1import axios from 'axios';
2const options = {
3method: 'get',
4headers = {"x-api-key":"****************************************************************"}
5}; 
6axios('"https://api.leptonmaps.com/v1/toll?origin=Delhi&destination=Jaipur&waypoints=<waypoints>&encoded_polyline=<encoded_polyline>&journey_type=PV_SJ&include_route=<include_route>&include_route_metadata=<include_route_metadata>&include_booths=<include_booths>&include_booths_locations=<include_booths_locations>"', options)
7.then((response) => console.log(response.data))
8.catch((error) => console.error(error));
9





Get Fuel Price API
Get the latest fuel price for any location acorss India.


Playground

get
/fuel/prices

Send
query
Enter query
date

Pick a Date
Fuel Type

Parameters
query

string

Location name or corresponding latitude-longitude to get it's fuel price

date

string

Date for which you want to get fuel price for

fuel_type

Fuel type to get corresponding price: petrol/diesel

Responses
Successful Response

200
application/json

Validation Error

422
application/json


Map View

Snippet

Javascript

axios
copy
1import axios from 'axios';
2const options = {
3method: 'get',
4headers = {"x-api-key":"****************************************************************"}
5}; 
6axios('"https://api.leptonmaps.com/v1/fuel/prices?query=<query>&date=<date>&fuel_type=<fuel_type>"', options)
7.then((response) => console.log(response.data))
8.catch((error) => console.error(error));
9

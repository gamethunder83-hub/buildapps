# Campus Bus Tracker

A Vercel-ready campus bus tracking web app for students, faculty, and drivers.

## What it includes

- No-login role selection for student or driver
- Route cards for switching between predefined buses
- Full-screen Leaflet map with OpenStreetMap tiles and a live orange bus marker
- Driver Start and Stop controls using device GPS
- Firebase Realtime Database sync for live route movement
- Firestore plus Realtime Database attendance check-ins
- Automatic geofence attendance when a student enters the bus radius
- Responsive mobile-first UI with a clean RailOne-inspired feel

## Files

- `index.html` for the application shell
- `styles.css` for the complete UI design
- `app.js` for route tracking, live sync, and geofence attendance
- `firebase-config.js` for your Firebase keys and campus defaults
- `vercel.json` for static deployment

## Setup

1. Create a Firebase project.
2. Enable Realtime Database and Firestore.
3. Replace the placeholders in `firebase-config.js`.
4. Deploy this folder to Vercel as a static site.

## Firebase shape

Suggested Realtime Database structure:

```json
{
  "routes": {
    "route-1": {
      "live": {
        "routeId": "route-1",
        "routeName": "Route 1",
        "lat": 12.9716,
        "lng": 77.5946,
        "speed": 6.4,
        "heading": 90,
        "active": true,
        "updatedAt": 1710000000000
      }
    }
  }
}
```

Suggested Firestore collections:

- `routes`
- `attendance`

Example `routes` document:

```json
{
  "name": "Route 1",
  "label": "North Gate Loop",
  "description": "Main Gate -> Library -> Engineering Block -> Hostel",
  "center": { "lat": 12.9716, "lng": 77.5946 },
  "path": [
    { "lat": 12.9716, "lng": 77.5946 },
    { "lat": 12.9731, "lng": 77.5925 }
  ]
}
```

## Notes

- The app falls back to built-in demo routes if Firestore route data is not present.
- HTTPS is required in production for browser geolocation.
- The current version is intentionally auth-free, so tighten Firebase rules before production rollout.
- The map uses Leaflet with OpenStreetMap tiles, so no Google Maps key is required.

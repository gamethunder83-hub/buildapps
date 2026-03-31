import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp as firestoreTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const fallbackRoutes = [
  {
    id: "route-1",
    name: "Route 1",
    label: "North Gate Loop",
    description: "Main Gate -> Library -> Engineering Block -> Hostel",
    center: { lat: 12.9716, lng: 77.5946 },
    path: [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9731, lng: 77.5925 },
      { lat: 12.9751, lng: 77.5942 },
      { lat: 12.9742, lng: 77.5972 }
    ]
  },
  {
    id: "route-2",
    name: "Route 2",
    label: "South Campus Express",
    description: "Admin Block -> Auditorium -> Medical Centre -> Faculty Quarters",
    center: { lat: 12.9675, lng: 77.6001 },
    path: [
      { lat: 12.9675, lng: 77.6001 },
      { lat: 12.9661, lng: 77.6028 },
      { lat: 12.9642, lng: 77.6015 },
      { lat: 12.9654, lng: 77.5984 }
    ]
  },
  {
    id: "route-3",
    name: "Route 3",
    label: "East Residence Shuttle",
    description: "Hostel Block A -> Stadium -> Cafeteria -> East Parking",
    center: { lat: 12.9781, lng: 77.6012 },
    path: [
      { lat: 12.9781, lng: 77.6012 },
      { lat: 12.9799, lng: 77.6037 },
      { lat: 12.9816, lng: 77.6021 },
      { lat: 12.9808, lng: 77.5996 }
    ]
  }
];

const appState = {
  role: "student",
  routes: fallbackRoutes,
  selectedRouteId: null,
  selectedRouteLive: null,
  watchId: null,
  geofenceWatchId: null,
  routeUnsubscribe: null,
  map: null,
  busMarker: null,
  studentMarker: null,
  geofenceCircle: null,
  routePolyline: null,
  database: null,
  firestore: null,
  hasFirebase: false,
  geofenceCheckinKey: null
};

const els = {
  roleSwitch: document.getElementById("roleSwitch"),
  routeList: document.getElementById("routeList"),
  connectionBadge: document.getElementById("connectionBadge"),
  selectedRouteTitle: document.getElementById("selectedRouteTitle"),
  routeMetaBadge: document.getElementById("routeMetaBadge"),
  studentPanel: document.getElementById("studentPanel"),
  driverPanel: document.getElementById("driverPanel"),
  studentName: document.getElementById("studentName"),
  geofenceRadius: document.getElementById("geofenceRadius"),
  geofenceRadiusValue: document.getElementById("geofenceRadiusValue"),
  studentStatus: document.getElementById("studentStatus"),
  attendanceState: document.getElementById("attendanceState"),
  busSpeed: document.getElementById("busSpeed"),
  driverStatus: document.getElementById("driverStatus"),
  startTrackingBtn: document.getElementById("startTrackingBtn"),
  stopTrackingBtn: document.getElementById("stopTrackingBtn"),
  driverTrackingState: document.getElementById("driverTrackingState"),
  driverLastPing: document.getElementById("driverLastPing"),
  map: document.getElementById("map")
};

const mapsConfig = window.APP_CONFIG || {};
const defaultRadius = Number(mapsConfig.geofenceRadiusMeters) || 20;
els.geofenceRadius.value = String(defaultRadius);
els.geofenceRadiusValue.textContent = `${defaultRadius} meters`;

boot();

async function boot() {
  setupRoleSwitch();
  setupActions();
  try {
    await initializeLeafletMap();
  } catch (error) {
    console.error("Leaflet failed to load.", error);
    els.connectionBadge.textContent = "Map unavailable";
    els.studentStatus.textContent =
      "The map could not load. Check your network connection and try again.";
  }
  await initializeFirebase();
  await loadRoutes();
  renderRoutes();
  selectRoute(appState.routes[0]?.id ?? null);
}

function setupRoleSwitch() {
  els.roleSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-role]");
    if (!button) return;
    setRole(button.dataset.role);
  });
}

function setupActions() {
  els.startTrackingBtn.addEventListener("click", startDriverTracking);
  els.stopTrackingBtn.addEventListener("click", stopDriverTracking);
  els.geofenceRadius.addEventListener("input", () => {
    els.geofenceRadiusValue.textContent = `${els.geofenceRadius.value} meters`;
    drawGeofence();
    maybeCheckInStudent();
  });
}

function setRole(role) {
  appState.role = role;
  document.querySelectorAll(".role-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.role === role);
  });
  els.studentPanel.classList.toggle("hidden", role !== "student");
  els.driverPanel.classList.toggle("hidden", role !== "driver");
  if (role === "student") {
    createStudentWatcher();
  }
  updateStatusCopy();
}

async function initializeLeafletMap() {
  await loadScript(
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  );

  const center = mapsConfig.campusCenter || fallbackRoutes[0].center;
  appState.map = L.map(els.map, {
    zoomControl: true,
    attributionControl: true
  }).setView([center.lat, center.lng], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(appState.map);
}

async function initializeFirebase() {
  const config = mapsConfig.firebase;
  if (!config || !config.apiKey || config.apiKey.startsWith("YOUR_")) {
    els.connectionBadge.textContent = "Demo mode";
    return;
  }

  const firebaseApp = initializeApp(config);
  appState.database = getDatabase(firebaseApp);
  appState.firestore = getFirestore(firebaseApp);
  appState.hasFirebase = true;
  els.connectionBadge.textContent = "Realtime connected";
}

async function loadRoutes() {
  if (!appState.firestore) return;

  try {
    const snapshot = await getDocs(collection(appState.firestore, "routes"));
    if (!snapshot.empty) {
      appState.routes = snapshot.docs.map((routeDoc) => ({
        id: routeDoc.id,
        ...routeDoc.data()
      }));
    }
  } catch (error) {
    console.warn("Using fallback routes.", error);
  }
}

function renderRoutes() {
  els.routeList.innerHTML = "";
  appState.routes.forEach((route) => {
    const card = document.createElement("button");
    card.className = "route-card";
    card.type = "button";
    card.dataset.routeId = route.id;
    card.innerHTML = `
      <strong>${route.name}</strong>
      <span>${route.label}</span>
      <span>${route.description}</span>
      <small>${route.path?.length || 0} stops mapped</small>
    `;
    card.addEventListener("click", () => selectRoute(route.id));
    els.routeList.appendChild(card);
  });
}

function selectRoute(routeId) {
  if (!routeId) return;
  appState.selectedRouteId = routeId;
  appState.geofenceCheckinKey = null;
  els.attendanceState.textContent = "Idle";
  document.querySelectorAll(".route-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.routeId === routeId);
  });

  const route = getSelectedRoute();
  if (!route) return;

  els.selectedRouteTitle.textContent = `${route.name} - ${route.label}`;
  els.routeMetaBadge.textContent = route.description;
  fitRoute(route);
  subscribeToRoute(route.id);
  updateStatusCopy();
}

function getSelectedRoute() {
  return appState.routes.find((route) => route.id === appState.selectedRouteId);
}

function subscribeToRoute(routeId) {
  if (appState.routeUnsubscribe) {
    appState.routeUnsubscribe();
    appState.routeUnsubscribe = null;
  }

  const route = getSelectedRoute();
  if (!route) return;

  if (!appState.hasFirebase) {
    appState.selectedRouteLive = {
      lat: route.center.lat,
      lng: route.center.lng,
      speed: 0,
      active: false,
      updatedAt: null
    };
    updateBusMarker(appState.selectedRouteLive);
    return;
  }

  const routeRef = ref(appState.database, `routes/${routeId}/live`);
  appState.routeUnsubscribe = onValue(routeRef, (snapshot) => {
    const live = snapshot.val();
    appState.selectedRouteLive = live;
    updateBusMarker(live);
    updateStatusCopy();
    maybeCheckInStudent();
  });
}

function updateBusMarker(live) {
  const route = getSelectedRoute();
  if (!route || !appState.map) return;

  clearPolyline();
  if (route.path?.length) {
    appState.routePolyline = L.polyline(
      route.path.map((point) => [point.lat, point.lng]),
      {
        color: "#ef7d18",
        opacity: 0.88,
        weight: 5
      }
    ).addTo(appState.map);
  }

  const position = live?.lat && live?.lng ? { lat: live.lat, lng: live.lng } : route.center;
  if (!appState.busMarker) {
    appState.busMarker = L.marker([position.lat, position.lng], {
      icon: createBusIcon()
    })
      .addTo(appState.map)
      .bindPopup("Campus Bus");
  } else {
    appState.busMarker.setLatLng([position.lat, position.lng]);
  }

  appState.map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
  drawGeofence();
  els.busSpeed.textContent =
    typeof live?.speed === "number" && !Number.isNaN(live.speed)
      ? `${Math.round(live.speed * 3.6)} km/h`
      : "--";
}

function drawGeofence() {
  if (!appState.map || !appState.busMarker) return;

  const radius = Number(els.geofenceRadius.value);
  if (!appState.geofenceCircle) {
    appState.geofenceCircle = L.circle([0, 0], {
      radius,
      color: "#ef7d18",
      opacity: 0.9,
      weight: 2,
      fillColor: "#ef7d18",
      fillOpacity: 0.12
    }).addTo(appState.map);
  }

  appState.geofenceCircle.setLatLng(appState.busMarker.getLatLng());
  appState.geofenceCircle.setRadius(radius);
}

function fitRoute(route) {
  if (!appState.map || !route?.path?.length) return;
  const bounds = route.path.map((point) => [point.lat, point.lng]);
  appState.map.fitBounds(bounds, { padding: [60, 60] });
}

function updateStatusCopy() {
  const route = getSelectedRoute();
  const live = appState.selectedRouteLive;
  const isActive = Boolean(live?.active);
  const updatedAt = live?.updatedAt ? new Date(live.updatedAt) : null;

  if (appState.role === "student") {
    if (!route) {
      els.studentStatus.textContent = "Select a route to start watching the bus.";
      return;
    }

    els.studentStatus.textContent = isActive
      ? `${route.name} is live. The orange bus marker updates automatically for everyone watching this route.`
      : `${route.name} is selected. Waiting for the driver to start live tracking.`;
  }

  if (appState.role === "driver") {
    if (!route) {
      els.driverStatus.textContent = "Select your assigned route first.";
      return;
    }

    els.driverStatus.textContent = isActive
      ? `${route.name} is broadcasting live. Students on this route are seeing your location now.`
      : `Route locked to ${route.name}. Tap Start to begin live GPS sharing.`;

    els.driverTrackingState.textContent = isActive ? "Live" : "Offline";
    els.driverLastPing.textContent = updatedAt ? updatedAt.toLocaleTimeString() : "--";
  }
}

async function startDriverTracking() {
  const route = getSelectedRoute();
  if (!route) {
    els.driverStatus.textContent = "Choose a route before starting live tracking.";
    return;
  }

  if (!appState.hasFirebase) {
    els.driverStatus.textContent =
      "Firebase config is missing. Add credentials in firebase-config.js to enable live broadcasting.";
    return;
  }

  if (!navigator.geolocation) {
    els.driverStatus.textContent = "Geolocation is not available on this device.";
    return;
  }

  els.startTrackingBtn.disabled = true;
  els.stopTrackingBtn.disabled = false;
  els.driverTrackingState.textContent = "Starting";

  appState.watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const payload = {
        routeId: route.id,
        routeName: route.name,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading ?? null,
        speed: position.coords.speed ?? 0,
        active: true,
        updatedAt: Date.now(),
        serverUpdatedAt: serverTimestamp()
      };

      await set(ref(appState.database, `routes/${route.id}/live`), payload);
      appState.selectedRouteLive = payload;
      updateBusMarker(payload);
      updateStatusCopy();
    },
    (error) => {
      console.error(error);
      els.driverStatus.textContent = `Unable to access GPS: ${error.message}`;
      els.startTrackingBtn.disabled = false;
      els.stopTrackingBtn.disabled = true;
      els.driverTrackingState.textContent = "Offline";
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000
    }
  );
}

async function stopDriverTracking() {
  const route = getSelectedRoute();
  if (appState.watchId !== null) {
    navigator.geolocation.clearWatch(appState.watchId);
    appState.watchId = null;
  }

  if (appState.hasFirebase && route) {
    await update(ref(appState.database, `routes/${route.id}/live`), {
      active: false,
      stoppedAt: Date.now(),
      serverStoppedAt: serverTimestamp()
    });
  }

  els.startTrackingBtn.disabled = false;
  els.stopTrackingBtn.disabled = true;
  els.driverTrackingState.textContent = "Offline";
  updateStatusCopy();
}

function maybeCheckInStudent() {
  const route = getSelectedRoute();
  const live = appState.selectedRouteLive;
  const radius = Number(els.geofenceRadius.value);

  if (
    appState.role !== "student" ||
    !route ||
    !live?.active ||
    !appState.studentMarker ||
    !appState.hasFirebase
  ) {
    return;
  }

  const studentPosition = appState.studentMarker.getLatLng();
  const busPosition = appState.busMarker?.getLatLng();
  if (!studentPosition || !busPosition) return;

  const distance = appState.map.distance(studentPosition, busPosition);

  if (distance <= radius) {
    checkInStudent(route, live, distance).catch((error) => console.error(error));
  } else {
    els.attendanceState.textContent = `Outside geofence (${Math.round(distance)}m)`;
  }
}

async function checkInStudent(route, live, distance) {
  const sessionKey = `${route.id}-${new Date().toISOString().slice(0, 10)}`;
  if (appState.geofenceCheckinKey === sessionKey) return;

  const deviceId = getDeviceId();
  const name = els.studentName.value.trim() || "Anonymous rider";
  const payload = {
    deviceId,
    name,
    routeId: route.id,
    routeName: route.name,
    busLat: live.lat,
    busLng: live.lng,
    studentLat: appState.studentMarker.getLatLng().lat,
    studentLng: appState.studentMarker.getLatLng().lng,
    distanceMeters: Math.round(distance),
    checkedInAt: firestoreTimestamp(),
    source: "geofence"
  };

  await setDoc(doc(appState.firestore, "attendance", `${sessionKey}-${deviceId}`), payload);
  await set(ref(appState.database, `attendance/${route.id}/${deviceId}`), {
    ...payload,
    checkedInAt: Date.now()
  });

  appState.geofenceCheckinKey = sessionKey;
  els.attendanceState.textContent = `Present (${Math.round(distance)}m)`;
}

function createStudentWatcher() {
  if (!navigator.geolocation || appState.geofenceWatchId !== null) return;

  appState.geofenceWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const current = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      if (!appState.studentMarker && appState.map) {
        appState.studentMarker = L.circleMarker([current.lat, current.lng], {
          radius: 9,
          fillColor: "#1d1c1a",
          fillOpacity: 1,
          color: "#ffffff",
          weight: 3
        })
          .addTo(appState.map)
          .bindPopup("You");
      } else {
        appState.studentMarker?.setLatLng([current.lat, current.lng]);
      }

      maybeCheckInStudent();
    },
    (error) => {
      console.warn("Student geofence tracking disabled.", error);
      els.attendanceState.textContent = "Location permission needed";
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    }
  );
}

function getDeviceId() {
  const stored = localStorage.getItem("campus-bus-device-id");
  if (stored) return stored;
  const deviceId = crypto.randomUUID();
  localStorage.setItem("campus-bus-device-id", deviceId);
  return deviceId;
}

function clearPolyline() {
  if (appState.routePolyline) {
    appState.routePolyline.remove();
    appState.routePolyline = null;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function createBusIcon() {
  return L.divIcon({
    className: "bus-marker-icon",
    html: `
      <div style="width:56px;height:56px;border-radius:999px;background:#ef7d18;display:grid;place-items:center;box-shadow:0 12px 24px rgba(239,125,24,0.35);border:3px solid rgba(255,248,239,0.95);">
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
          <path fill="#fff8ef" d="M20 19h24a5 5 0 0 1 5 5v13a6 6 0 0 1-4 5.65V47a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2v-3H26v3a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2v-4.35A6 6 0 0 1 15 37V24a5 5 0 0 1 5-5Zm1 5v7h22v-7H21Zm2.5 15.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm17 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
        </svg>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -20]
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && appState.role === "student") {
    createStudentWatcher();
  }
});

window.addEventListener("load", () => {
  if (appState.role === "student") {
    createStudentWatcher();
  }
});

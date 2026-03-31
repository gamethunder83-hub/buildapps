import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
  getDoc,
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
  role: null,
  authMode: "signin",
  signupRole: "student",
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
  auth: null,
  currentUser: null,
  currentProfile: null,
  database: null,
  firestore: null,
  hasFirebase: false,
  geofenceCheckinKey: null
};

const els = {
  authLayout: document.getElementById("authLayout"),
  appDashboard: document.getElementById("appDashboard"),
  authModeSwitch: document.getElementById("authModeSwitch"),
  authRoleSwitch: document.getElementById("authRoleSwitch"),
  authForm: document.getElementById("authForm"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  authStatus: document.getElementById("authStatus"),
  nameField: document.getElementById("nameField"),
  roleField: document.getElementById("roleField"),
  sessionName: document.getElementById("sessionName"),
  sessionRole: document.getElementById("sessionRole"),
  logoutBtn: document.getElementById("logoutBtn"),
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
  setupAuthUi();
  setupAppActions();

  try {
    await initializeLeafletMap();
  } catch (error) {
    console.error("Leaflet failed to load.", error);
    els.connectionBadge.textContent = "Map unavailable";
    els.authStatus.textContent =
      "The map could not load. Check your network connection and try again.";
  }

  await initializeFirebase();
  await loadRoutes();
  renderRoutes();
  selectRoute(appState.routes[0]?.id ?? null);
}

function setupAuthUi() {
  els.authModeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-auth-mode]");
    if (!button) return;
    setAuthMode(button.dataset.authMode);
  });

  els.authRoleSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-signup-role]");
    if (!button) return;
    setSignupRole(button.dataset.signupRole);
  });

  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.logoutBtn.addEventListener("click", handleLogout);
  setAuthMode("signin");
  setSignupRole("student");
}

function setupAppActions() {
  els.startTrackingBtn.addEventListener("click", startDriverTracking);
  els.stopTrackingBtn.addEventListener("click", stopDriverTracking);
  els.geofenceRadius.addEventListener("input", () => {
    els.geofenceRadiusValue.textContent = `${els.geofenceRadius.value} meters`;
    drawGeofence();
    maybeCheckInStudent();
  });
}

function setAuthMode(mode) {
  appState.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.authMode === mode);
  });
  els.nameField.classList.toggle("hidden", mode !== "signup");
  els.roleField.classList.toggle("hidden", mode !== "signup");
  els.authSubmitBtn.textContent = mode === "signup" ? "Create Account" : "Sign In";
  els.authStatus.textContent =
    mode === "signup"
      ? "Create a campus account and choose whether this user is a student or a driver."
      : "Use your campus account details to enter the tracker.";
}

function setSignupRole(role) {
  appState.signupRole = role;
  document.querySelectorAll("[data-signup-role]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.signupRole === role);
  });
}

async function initializeLeafletMap() {
  await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

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
    els.connectionBadge.textContent = "Add Firebase config";
    els.authStatus.textContent =
      "Add your Firebase project values in firebase-config.js to enable login and realtime tracking.";
    return;
  }

  const firebaseApp = initializeApp(config);
  appState.auth = getAuth(firebaseApp);
  appState.database = getDatabase(firebaseApp);
  appState.firestore = getFirestore(firebaseApp);
  appState.hasFirebase = true;
  els.connectionBadge.textContent = "Realtime connected";

  onAuthStateChanged(appState.auth, async (user) => {
    if (!user) {
      await handleSignedOutState();
      return;
    }

    try {
      const profile = await ensureUserProfile(user);
      handleSignedInState(user, profile);
    } catch (error) {
      console.error("Failed to load user profile.", error);
      els.authStatus.textContent =
        "We could not load your account role. Please sign in again.";
      await signOut(appState.auth);
    }
  });
}

async function ensureUserProfile(user) {
  const userRef = doc(appState.firestore, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data();
  }

  const fallbackProfile = {
    name: user.displayName || user.email?.split("@")[0] || "Campus user",
    email: user.email || "",
    role: "student",
    createdAt: firestoreTimestamp()
  };
  await setDoc(userRef, fallbackProfile);
  return fallbackProfile;
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!appState.auth) {
    els.authStatus.textContent =
      "Firebase Authentication is not ready yet. Check your Firebase config.";
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const name = els.authName.value.trim();

  if (!email || !password) {
    els.authStatus.textContent = "Email and password are required.";
    return;
  }

  els.authSubmitBtn.disabled = true;
  els.authStatus.textContent =
    appState.authMode === "signup" ? "Creating your account..." : "Signing you in...";

  try {
    if (appState.authMode === "signup") {
      if (!name) {
        throw new Error("Full name is required for new accounts.");
      }

      const credentials = await createUserWithEmailAndPassword(appState.auth, email, password);
      await updateProfile(credentials.user, { displayName: name });
      await setDoc(doc(appState.firestore, "users", credentials.user.uid), {
        name,
        email,
        role: appState.signupRole,
        createdAt: firestoreTimestamp()
      });
      els.authStatus.textContent = "Account created. Loading your dashboard...";
    } else {
      await signInWithEmailAndPassword(appState.auth, email, password);
      els.authStatus.textContent = "Signed in. Loading your dashboard...";
    }
  } catch (error) {
    console.error(error);
    els.authStatus.textContent = normalizeAuthError(error);
  } finally {
    els.authSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  if (!appState.auth) return;
  els.logoutBtn.disabled = true;
  try {
    if (appState.watchId !== null) {
      await stopDriverTracking();
    }
    await signOut(appState.auth);
  } finally {
    els.logoutBtn.disabled = false;
  }
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

function handleSignedInState(user, profile) {
  appState.currentUser = user;
  appState.currentProfile = profile;
  appState.role = profile.role;

  els.authLayout.classList.add("hidden");
  els.appDashboard.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
  els.sessionName.textContent = profile.name || user.displayName || user.email || "Campus user";
  els.sessionRole.textContent = `${capitalize(profile.role)} account - ${user.email || ""}`;
  els.studentName.value = profile.name || user.displayName || "";
  els.studentName.disabled = profile.role === "student";

  els.studentPanel.classList.toggle("hidden", profile.role !== "student");
  els.driverPanel.classList.toggle("hidden", profile.role !== "driver");

  if (profile.role === "student") {
    createStudentWatcher();
  }

  updateStatusCopy();
}

async function handleSignedOutState() {
  if (appState.watchId !== null) {
    navigator.geolocation.clearWatch(appState.watchId);
    appState.watchId = null;
  }
  if (appState.geofenceWatchId !== null) {
    navigator.geolocation.clearWatch(appState.geofenceWatchId);
    appState.geofenceWatchId = null;
  }
  if (appState.studentMarker) {
    appState.studentMarker.remove();
    appState.studentMarker = null;
  }

  appState.currentUser = null;
  appState.currentProfile = null;
  appState.role = null;
  els.authLayout.classList.remove("hidden");
  els.appDashboard.classList.add("hidden");
  els.logoutBtn.classList.add("hidden");
  els.sessionName.textContent = "Signed out";
  els.sessionRole.textContent = "Choose a role and sign in";
  els.studentPanel.classList.add("hidden");
  els.driverPanel.classList.add("hidden");
  els.authPassword.value = "";
  updateStatusCopy();
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
  const busIsMoving = Boolean(live?.active) && Number(live?.speed || 0) > 0.8;
  if (!appState.busMarker) {
    appState.busMarker = L.marker([position.lat, position.lng], {
      icon: createBusIcon(busIsMoving)
    })
      .addTo(appState.map)
      .bindPopup("Campus Bus");
  } else {
    appState.busMarker.setLatLng([position.lat, position.lng]);
    appState.busMarker.setIcon(createBusIcon(busIsMoving));
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
  if (appState.role !== "driver") {
    els.driverStatus.textContent = "Only signed-in driver accounts can start live tracking.";
    return;
  }

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
        driverUid: appState.currentUser?.uid || null,
        driverName: appState.currentProfile?.name || appState.currentUser?.email || "Driver",
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
    !appState.hasFirebase ||
    !appState.currentUser
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

  const user = appState.currentUser;
  const profile = appState.currentProfile;
  const payload = {
    userId: user.uid,
    deviceId: getDeviceId(),
    name: profile?.name || user.displayName || "Campus rider",
    email: user.email || "",
    role: profile?.role || "student",
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

  await setDoc(doc(appState.firestore, "attendance", `${sessionKey}-${user.uid}`), payload);
  await set(ref(appState.database, `attendance/${route.id}/${user.uid}`), {
    ...payload,
    checkedInAt: Date.now()
  });

  appState.geofenceCheckinKey = sessionKey;
  els.attendanceState.textContent = `Present (${Math.round(distance)}m)`;
}

function createStudentWatcher() {
  if (
    appState.role !== "student" ||
    !navigator.geolocation ||
    appState.geofenceWatchId !== null
  ) {
    return;
  }

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

function createBusIcon(isMoving) {
  const background = isMoving ? "#1f9d55" : "#d64545";
  const shadow = isMoving
    ? "0 12px 24px rgba(31,157,85,0.35)"
    : "0 12px 24px rgba(214,69,69,0.35)";
  return L.divIcon({
    className: "bus-marker-icon",
    html: `
      <div style="width:56px;height:56px;border-radius:999px;background:${background};display:grid;place-items:center;box-shadow:${shadow};border:3px solid rgba(255,248,239,0.95);">
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

function normalizeAuthError(error) {
  const message = error?.message || "Authentication failed.";
  if (message.includes("auth/email-already-in-use")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (message.includes("auth/invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password must be at least 6 characters.";
  }
  if (message.includes("Full name is required")) {
    return message;
  }
  return message.replace("Firebase: ", "");
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

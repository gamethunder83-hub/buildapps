import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const fallbackRoutes = {
  "route-1": {
    id: "route-1",
    name: "Bus 01",
    label: "North Gate Loop",
    description: "Main Gate Loop",
    center: { lat: 12.9716, lng: 77.5946 },
    path: [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9731, lng: 77.5925 },
      { lat: 12.9751, lng: 77.5942 },
      { lat: 12.9742, lng: 77.5972 }
    ],
    stops: ["Main Gate", "Library", "Engineering Block", "Hostel"]
  },
  "route-2": {
    id: "route-2",
    name: "Bus 02",
    label: "South Campus Express",
    description: "South Campus Express",
    center: { lat: 12.9675, lng: 77.6001 },
    path: [
      { lat: 12.9675, lng: 77.6001 },
      { lat: 12.9661, lng: 77.6028 },
      { lat: 12.9642, lng: 77.6015 },
      { lat: 12.9654, lng: 77.5984 }
    ],
    stops: ["Admin Block", "Auditorium", "Medical Centre", "Faculty Quarters"]
  },
  "route-3": {
    id: "route-3",
    name: "Bus 03",
    label: "East Residence Shuttle",
    description: "East Residence Shuttle",
    center: { lat: 12.9781, lng: 77.6012 },
    path: [
      { lat: 12.9781, lng: 77.6012 },
      { lat: 12.9799, lng: 77.6037 },
      { lat: 12.9816, lng: 77.6021 },
      { lat: 12.9808, lng: 77.5996 }
    ],
    stops: ["Hostel Block A", "Stadium", "Cafeteria", "East Parking"]
  },
  "route-4": {
    id: "route-4",
    name: "Bus 04",
    label: "West Residence Loop",
    description: "West Residence Loop",
    center: { lat: 12.9704, lng: 77.5895 },
    path: [
      { lat: 12.9704, lng: 77.5895 },
      { lat: 12.9722, lng: 77.5906 },
      { lat: 12.9733, lng: 77.5937 },
      { lat: 12.9714, lng: 77.5954 }
    ],
    stops: ["Hostel West", "Sports Complex", "Lab Block", "Main Gate"]
  },
  "route-5": {
    id: "route-5",
    name: "Bus 05",
    label: "City Connector",
    description: "City Connector",
    center: { lat: 12.9688, lng: 77.5964 },
    path: [
      { lat: 12.9688, lng: 77.5964 },
      { lat: 12.9697, lng: 77.5989 },
      { lat: 12.9712, lng: 77.6007 },
      { lat: 12.9728, lng: 77.5984 }
    ],
    stops: ["Metro Stop", "Commerce Block", "Auditorium", "North Gate"]
  },
  "route-6": {
    id: "route-6",
    name: "Bus 06",
    label: "Faculty Quarters Shuttle",
    description: "Faculty Quarters Shuttle",
    center: { lat: 12.9657, lng: 77.6033 },
    path: [
      { lat: 12.9657, lng: 77.6033 },
      { lat: 12.9664, lng: 77.6011 },
      { lat: 12.9683, lng: 77.5995 },
      { lat: 12.9702, lng: 77.5979 }
    ],
    stops: ["Faculty Quarters", "Medical Centre", "Admin Block", "Library"]
  },
  "route-7": {
    id: "route-7",
    name: "Bus 07",
    label: "North Hostel Connector",
    description: "North Hostel Connector",
    center: { lat: 12.9791, lng: 77.5982 },
    path: [
      { lat: 12.9791, lng: 77.5982 },
      { lat: 12.9782, lng: 77.6001 },
      { lat: 12.9766, lng: 77.5985 },
      { lat: 12.9744, lng: 77.5967 }
    ],
    stops: ["North Hostel", "Innovation Center", "Stadium", "Main Gate"]
  },
  "route-8": {
    id: "route-8",
    name: "Bus 08",
    label: "Library Ring",
    description: "Library Ring",
    center: { lat: 12.9738, lng: 77.5998 },
    path: [
      { lat: 12.9738, lng: 77.5998 },
      { lat: 12.9754, lng: 77.6016 },
      { lat: 12.9771, lng: 77.6002 },
      { lat: 12.9756, lng: 77.5979 }
    ],
    stops: ["Library", "Research Park", "Engineering Block", "Cafeteria"]
  },
  "route-9": {
    id: "route-9",
    name: "Bus 09",
    label: "Evening Drop Route",
    description: "Evening Drop Route",
    center: { lat: 12.9673, lng: 77.6061 },
    path: [
      { lat: 12.9673, lng: 77.6061 },
      { lat: 12.9689, lng: 77.6044 },
      { lat: 12.9708, lng: 77.6028 },
      { lat: 12.9725, lng: 77.6005 }
    ],
    stops: ["Admin Block", "East Gate", "City Stop", "Hostel Return"]
  }
};

const config = window.APP_CONFIG?.firebase;
const refs = {
  routeSelect: document.getElementById("routeSelect"),
  driverPanel: document.getElementById("driverPanel"),
  studentPanel: document.getElementById("studentPanel"),
  driverStopsList: document.getElementById("driverStopsList"),
  driverStopInput: document.getElementById("driverStopInput"),
  driverAddStopBtn: document.getElementById("driverAddStopBtn"),
  driverSaveStopsBtn: document.getElementById("driverSaveStopsBtn"),
  driverStopsStatus: document.getElementById("driverStopsStatus"),
  studentStopSelect: document.getElementById("studentStopSelect")
};

const state = {
  role: null,
  routes: { ...fallbackRoutes },
  editingStops: []
};

if (config?.apiKey && refs.routeSelect && refs.driverStopsList && refs.studentStopSelect) {
  const app = initializeApp(config, "driver-stops-patch");
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  refs.routeSelect.addEventListener("change", syncUiFromRoute);
  refs.driverAddStopBtn?.addEventListener("click", addStop);
  refs.driverSaveStopsBtn?.addEventListener("click", () => saveStops(firestore));

  onSnapshot(collection(firestore, "routes"), (snapshot) => {
    snapshot.forEach((item) => {
      state.routes[item.id] = { id: item.id, ...state.routes[item.id], ...item.data() };
    });
    syncUiFromRoute();
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.role = null;
      return;
    }
    const userSnap = await getDoc(doc(firestore, "users", user.uid));
    state.role = userSnap.exists() ? userSnap.data().role || null : null;
    syncUiFromRoute();
  });
}

function getCurrentRoute() {
  const routeId = refs.routeSelect?.value;
  return routeId ? state.routes[routeId] || fallbackRoutes[routeId] || null : null;
}

function syncUiFromRoute() {
  const route = getCurrentRoute();
  if (!route) return;

  if (state.role === "driver" && !refs.driverPanel.classList.contains("hidden")) {
    state.editingStops = [...(route.stops || [])];
    renderDriverStops();
  }

  if (state.role === "student" && !refs.studentPanel.classList.contains("hidden")) {
    populateStudentStops(route.stops || []);
  }
}

function renderDriverStops() {
  refs.driverStopsList.innerHTML = "";
  if (!state.editingStops.length) {
    refs.driverStopsList.innerHTML = '<div class="info-card compact"><p>No stops added yet.</p></div>';
    return;
  }

  state.editingStops.forEach((stopName, index) => {
    const row = document.createElement("div");
    row.className = "driver-stop-item";
    row.innerHTML = `
      <span>${escapeHtml(stopName)}</span>
      <button class="action-button muted driver-stop-delete" type="button">Delete</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      state.editingStops.splice(index, 1);
      refs.driverStopsStatus.textContent = "Stop removed locally. Save to publish the change.";
      renderDriverStops();
    });
    refs.driverStopsList.appendChild(row);
  });
}

function addStop() {
  const name = refs.driverStopInput.value.trim();
  if (!name) {
    refs.driverStopsStatus.textContent = "Enter a stop name first.";
    return;
  }
  state.editingStops.push(name);
  refs.driverStopInput.value = "";
  refs.driverStopsStatus.textContent = "Stop added locally. Save to publish it to students.";
  renderDriverStops();
}

async function saveStops(firestore) {
  const route = getCurrentRoute();
  if (!route || state.role !== "driver") return;

  refs.driverSaveStopsBtn.disabled = true;
  refs.driverStopsStatus.textContent = "Saving stops...";
  try {
    await setDoc(
      doc(firestore, "routes", route.id),
      {
        name: route.name,
        label: route.label,
        description: route.description,
        center: route.center,
        path: route.path,
        stops: state.editingStops
      },
      { merge: true }
    );
    state.routes[route.id] = { ...route, stops: [...state.editingStops] };
    populateStudentStops(state.editingStops);
    refs.driverStopsStatus.textContent = "Stops saved. Students can now see the updated route stops.";
  } catch (error) {
    console.error(error);
    refs.driverStopsStatus.textContent = "Could not save stops. Check Firestore rules and try again.";
  } finally {
    refs.driverSaveStopsBtn.disabled = false;
  }
}

function populateStudentStops(stops) {
  const currentValue = refs.studentStopSelect.value;
  refs.studentStopSelect.innerHTML = '<option value="">Select a stop</option>';
  stops.forEach((stopName, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = stopName;
    refs.studentStopSelect.appendChild(option);
  });
  if ([...refs.studentStopSelect.options].some((option) => option.value === currentValue)) {
    refs.studentStopSelect.value = currentValue;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ══════════════════════════════════════════════════
//  CULTOS DE BARRIOS – IPUC Vista Hermosa
//  app.js  |  Firebase Realtime DB + Leaflet
//  Modo público por defecto; botón ADMIN desbloquea edición
// ══════════════════════════════════════════════════

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Firebase ─────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDZnodReTPWRhyI0Tu3uLX5MgnLWy79jNI",
  authDomain:        "cultos-de-barrios.firebaseapp.com",
  databaseURL:       "https://cultos-de-barrios-default-rtdb.firebaseio.com",
  projectId:         "cultos-de-barrios",
  storageBucket:     "cultos-de-barrios.firebasestorage.app",
  messagingSenderId: "324648983908",
  appId:             "1:324648983908:web:88a342015d2c5479db6e71"
};
const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

// ── Credenciales fijas ───────────────────────────
const ADMIN_USER     = "IPUC";
const ADMIN_PASSWORD = "VISTAHERMOSA2026";

// ── Coordenadas de la iglesia principal ──────────
const IGLESIA_LAT = 10.377678;
const IGLESIA_LNG = -75.494506;
const IGLESIA_ZOOM = 15;

// ── Estado ───────────────────────────────────────
let map;
let markers        = {};
let cultosData     = {};
let editandoId     = null;
let eliminandoId   = null;
let modoAdmin      = false;
let modoPickCoord  = false;   // ← true cuando el form está abierto y esperamos clic en mapa
let pinTemporal    = null;    // marcador provisional al hacer clic

// ════════════════════════════════════════════════
//  ELEMENTOS DOM
// ════════════════════════════════════════════════
const adminActions  = document.getElementById("adminActions");
const btnAdminFloat = document.getElementById("btnAdminFloat");
const loginModal    = document.getElementById("loginModal");
const formModal     = document.getElementById("formModal");
const confirmModal  = document.getElementById("confirmModal");
const modalTitle    = document.getElementById("modalTitle");
const formError     = document.getElementById("formError");

// ── Banner "Toca el mapa para ubicar" ────────────
const bannerPickCoord = document.createElement("div");
bannerPickCoord.id = "bannerPickCoord";
bannerPickCoord.innerHTML = `
  <span>📍 Toca el mapa para fijar la ubicación del culto</span>
  <button id="btnCancelPick">✕ Cancelar</button>
`;
bannerPickCoord.style.cssText = `
  display:none; position:fixed; bottom:0; left:0; right:0; z-index:9999;
  background:#1a56db; color:#fff; padding:12px 16px;
  font-family:Inter,sans-serif; font-size:14px; font-weight:500;
  display:none; align-items:center; justify-content:space-between; gap:12px;
`;
document.body.appendChild(bannerPickCoord);

const btnCancelPick = document.getElementById("btnCancelPick");
btnCancelPick.style.cssText = `
  background:rgba(255,255,255,0.2); border:none; color:#fff;
  padding:4px 10px; border-radius:6px; cursor:pointer; font-size:13px;
`;

// ── Botón "Elegir en mapa" dentro del form ────────
// Lo insertamos justo debajo de los campos latitud/longitud
function insertarBotonElegirEnMapa() {
  const latField = document.getElementById("latitud").closest(".field");
  // Crear botón si no existe aún
  if (document.getElementById("btnElegirEnMapa")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id   = "btnElegirEnMapa";
  btn.textContent = "🗺️ Elegir en el mapa";
  btn.style.cssText = `
    grid-column: span 2; margin-top:2px; padding:9px 14px;
    background:#1a56db; color:#fff; border:none; border-radius:8px;
    font-family:Inter,sans-serif; font-size:13px; font-weight:500;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .2s;
  `;
  btn.onmouseenter = () => btn.style.background = "#1648c0";
  btn.onmouseleave = () => btn.style.background = "#1a56db";

  // Insertar después del campo longitud
  const lngField = document.getElementById("longitud").closest(".field");
  lngField.insertAdjacentElement("afterend", btn);

  btn.addEventListener("click", iniciarPickCoord);
}

// ════════════════════════════════════════════════
//  MODO ADMIN – ACTIVAR / DESACTIVAR
// ════════════════════════════════════════════════
function activarAdmin() {
  modoAdmin = true;
  localStorage.setItem("ipuc_admin", "ok");
  adminActions.classList.remove("hidden");
  btnAdminFloat.classList.add("active");
  btnAdminFloat.innerHTML = `<span class="admin-icon">🔓</span><span class="admin-label">ADMIN</span>`;
  btnAdminFloat.title = "Salir del modo administrador";
  refrescarMarcadores();
}

function desactivarAdmin() {
  modoAdmin = false;
  localStorage.removeItem("ipuc_admin");
  adminActions.classList.add("hidden");
  btnAdminFloat.classList.remove("active");
  btnAdminFloat.innerHTML = `<span class="admin-icon">🔑</span><span class="admin-label">ADMIN</span>`;
  btnAdminFloat.title = "Acceso Administrador";
  refrescarMarcadores();
}

btnAdminFloat.addEventListener("click", () => {
  if (modoAdmin) desactivarAdmin();
  else abrirLoginModal();
});

document.getElementById("btnSalirAdmin").addEventListener("click", desactivarAdmin);

// ════════════════════════════════════════════════
//  MODAL LOGIN ADMIN
// ════════════════════════════════════════════════
function abrirLoginModal() {
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginError").textContent = "";
  loginModal.classList.remove("hidden");
  setTimeout(() => document.getElementById("loginUser").focus(), 100);
}

function cerrarLoginModal() {
  loginModal.classList.add("hidden");
}

document.getElementById("btnCerrarLogin").addEventListener("click", cerrarLoginModal);
document.getElementById("btnCancelarLogin").addEventListener("click", cerrarLoginModal);

document.getElementById("btnLogin").addEventListener("click", () => {
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value;
  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
    cerrarLoginModal();
    activarAdmin();
  } else {
    document.getElementById("loginError").textContent = "Usuario o contraseña incorrectos.";
  }
});

document.getElementById("loginPass").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnLogin").click();
});

// ════════════════════════════════════════════════
//  MAPA
// ════════════════════════════════════════════════
function initMap() {
  if (map) return;
  // ← Centro en la iglesia IPUC Vista Hermosa
  map = L.map("map", {
    zoomControl: true,
    preferCanvas: false,
    fadeAnimation: true,
    zoomAnimation: true
  }).setView([IGLESIA_LAT, IGLESIA_LNG], IGLESIA_ZOOM);

  const satelital = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics", maxZoom: 20 }
  );
  const etiquetas = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, opacity: 1 }
  );
  const callejero = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
  );
  const grupoSatelite = L.layerGroup([satelital, etiquetas]);
  const fondoOscuro = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    { attribution: "", maxZoom: 20, opacity: 0.01, zIndex: 0 }
  );
  fondoOscuro.addTo(map);
  grupoSatelite.addTo(map);

  L.control.layers(
    { "🛰️ Satélite": grupoSatelite, "🗺️ Callejero": callejero },
    {},
    { position: "topright", collapsed: false }
  ).addTo(map);

  // ── Marcador fijo: Sede principal (Iglesia) ──
  L.marker([IGLESIA_LAT, IGLESIA_LNG], {
    icon: makeIcon({ tipo: "iglesia", color: "#c5882a" })
  })
    .addTo(map)
    .bindPopup(`
      <div class="popup-wrap">
        <div class="popup-foto-placeholder">📚</div>
        <div class="popup-body">
          <div class="popup-barrio">⛪ IPUC Vista Hermosa</div>
          <div class="popup-row"><strong>Tipo:</strong><span>Sede principal (Iglesia)</span></div>
          <div class="popup-chips">
            <span class="chip chip-gold">Templo central</span>
          </div>
        </div>
      </div>
    `, { maxWidth: 240 });

  // ── Clic en mapa: captura coordenadas si el form está abierto ──
  map.on("click", (e) => {
    if (!modoPickCoord) return;
    const { lat, lng } = e.latlng;
    document.getElementById("latitud").value  = lat.toFixed(6);
    document.getElementById("longitud").value = lng.toFixed(6);

    // Pin temporal
    if (pinTemporal) pinTemporal.remove();
    pinTemporal = L.marker([lat, lng], { icon: makeIconTemp() })
      .addTo(map)
      .bindPopup("📍 Ubicación seleccionada")
      .openPopup();

    // Volver al form
    terminarPickCoord();
  });
}

function lightenColor(hex, amount) {
  try {
    const c = hex.replace("#","");
    const num = parseInt(c, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return "#" + (r.toString(16).padStart(2,"0")) + (g.toString(16).padStart(2,"0")) + (b.toString(16).padStart(2,"0"));
  } catch { return hex; }
}

function makeIcon(culto = {}) {
  const color   = culto.color || "#c5882a";
  const colorLt = lightenColor(color, 35);
  const esIglesia = culto.tipo === "iglesia";
  const esRefan   = culto.tipo === "refan";
  const pinClass  = esIglesia ? "custom-pin-iglesia" : "custom-pin";
  const symbol    = esIglesia ? "📚" : (esRefan ? "R" : "📚");
  const size = esIglesia ? 42 : 36;
  const anchorY = esIglesia ? 42 : 36;
  return L.divIcon({
    className: "",
    html: `<div class="custom-pin-wrap" style="--pin-color:${color}; --pin-color-lt:${colorLt};"><div class="${pinClass}" data-symbol="${symbol}"></div></div>`,
    iconSize:   [size, size],
    iconAnchor: [size/2, anchorY],
    popupAnchor:[0, -38]
  });
}

// Icono diferente para el pin temporal de selección
function makeIconTemp() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:20px;height:20px;background:#1a56db;border:3px solid #fff;
      border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);
      transform:translate(-50%,-50%);
    "></div>`,
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
    popupAnchor:[0, -14]
  });
}

// ════════════════════════════════════════════════
//  PICK COORD – activar / terminar
// ════════════════════════════════════════════════
function iniciarPickCoord() {
  modoPickCoord = true;
  // Ocultar el modal del form (sin cerrarlo)
  formModal.style.opacity = "0";
  formModal.style.pointerEvents = "none";
  // Mostrar banner
  bannerPickCoord.style.display = "flex";
  // Cambiar cursor del mapa
  map.getContainer().style.cursor = "crosshair";
}

function terminarPickCoord() {
  modoPickCoord = false;
  // Restaurar modal
  formModal.style.opacity = "1";
  formModal.style.pointerEvents = "";
  // Ocultar banner
  bannerPickCoord.style.display = "none";
  // Restaurar cursor
  map.getContainer().style.cursor = "";
}

btnCancelPick.addEventListener("click", () => {
  terminarPickCoord();
});

// ════════════════════════════════════════════════
//  POPUPS Y MARCADORES
// ════════════════════════════════════════════════
function buildPopup(id, c) {
  const foto = c.foto
    ? `<img class="popup-foto" src="${c.foto}" alt="Foto del culto" onerror="this.style.display='none'" />`
    : `<div class="popup-foto-placeholder">📚</div>`;

  const obs = c.observaciones
    ? `<div class="popup-row"><strong>Observaciones:</strong><span>${c.observaciones}</span></div>`
    : "";

  const dir   = encodeURIComponent(`${c.direccion}, Cartagena, Colombia`);
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dir}`;

  const botonesAdmin = modoAdmin ? `
    <button class="btn-map-edit"   onclick="window._editarCulto('${id}')">✏ Editar</button>
    <button class="btn-map-delete" onclick="window._confirmarEliminar('${id}')">🗑 Eliminar</button>
  ` : "";

  return `
  <div class="popup-wrap">
    ${foto}
    <div class="popup-body">
      <div class="popup-barrio">📚 ${c.barrio}</div>
      <div class="popup-row"><strong>Dirección:</strong><span>${c.direccion}</span></div>
      <div class="popup-row"><strong>Responsables:</strong><span>${c.responsables}</span></div>
      <div class="popup-chips">
        <span class="chip" style="background:${c.color || '#c5882a'}22; border-color:${c.color || '#c5882a'}55; color:${c.color || '#c5882a'};">
          ${c.tipo === "iglesia" ? "⛪ Iglesia Principal" : (c.tipo === "refan" ? "🔥 REFAN" : "🏠 Culto de Barrio")}
        </span>
        <span class="chip">👥 ${c.hermanos || 0} hermanos</span>
        <span class="chip">🙋 ${c.visitas || 0} visitas</span>
        <span class="chip chip-gold">📅 ${c.dia} ${c.hora}</span>
      </div>
      ${obs}
      <div class="popup-actions">
        <a class="btn-map-dir" href="${gmaps}" target="_blank" rel="noopener">📍 Cómo llegar</a>
        ${botonesAdmin}
      </div>
    </div>
  </div>`;
}

function agregarMarcador(id, culto) {
  if (!map) return;
  if (markers[id]) markers[id].remove();
  const lat = parseFloat(culto.latitud);
  const lng = parseFloat(culto.longitud);
  if (isNaN(lat) || isNaN(lng)) return;

  const marker = L.marker([lat, lng], {
      icon: makeIcon(culto),
      draggable: modoAdmin
    })
    .addTo(map)
    .bindPopup(buildPopup(id, culto), { maxWidth: 280 });

  if (modoAdmin) {
    marker.on("dragend", async (e) => {
      const { lat: newLat, lng: newLng } = e.target.getLatLng();
      try {
        await update(ref(db, `cultos/${id}`), {
          latitud:  newLat,
          longitud: newLng
        });
      } catch (err) {
        alert("Error al actualizar ubicación: " + err.message);
      }
    });
  }

  markers[id] = marker;
}

function eliminarMarcador(id) {
  if (markers[id]) { markers[id].remove(); delete markers[id]; }
}

function refrescarMarcadores() {
  // Recrear marcadores para aplicar/quitar arrastre y actualizar popups
  Object.entries(cultosData).forEach(([id, culto]) => {
    agregarMarcador(id, culto);
  });
}

// ════════════════════════════════════════════════
//  FIREBASE LISTENER
// ════════════════════════════════════════════════
function listenCultos() {
  onValue(ref(db, "cultos"), snapshot => {
    Object.values(markers).forEach(m => m.remove());
    markers    = {};
    cultosData = {};
    let total = 0, hermanos = 0, visitas = 0;

    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const id    = child.key;
        const culto = child.val();
        cultosData[id] = culto;
        agregarMarcador(id, culto);
        total++;
        hermanos += parseInt(culto.hermanos || 0);
        visitas  += parseInt(culto.visitas  || 0);
      });
    }

    document.getElementById("statTotal").textContent    = total;
    document.getElementById("statHermanos").textContent = hermanos;
    document.getElementById("statVisitas").textContent  = visitas;
  });
}

// ════════════════════════════════════════════════
//  MODAL FORM CULTO
// ════════════════════════════════════════════════
const campos = ["barrio","direccion","responsables","fotoUrl","tipo","color","hermanos","visitas","dia","hora","latitud","longitud","observaciones"];

function limpiarForm() {
  campos.forEach(c => { const el = document.getElementById(c); if (el) el.value = ""; });
  document.getElementById("tipo").value  = "culto";
  document.getElementById("color").value = "#c5882a";
  formError.textContent = "";
  editandoId = null;
  // Quitar pin temporal al limpiar
  if (pinTemporal) { pinTemporal.remove(); pinTemporal = null; }
}

function abrirModalNuevo() {
  limpiarForm();
  modalTitle.textContent = "Registrar Culto";
  formModal.classList.remove("hidden");
  // Insertar botón "Elegir en mapa" si no existe
  setTimeout(insertarBotonElegirEnMapa, 0);
}

function abrirModalEditar(id) {
  limpiarForm();
  editandoId = id;
  const c = cultosData[id];
  if (!c) return;
  modalTitle.textContent = "Editar Culto";
  document.getElementById("barrio").value        = c.barrio        || "";
  document.getElementById("direccion").value     = c.direccion     || "";
  document.getElementById("responsables").value  = c.responsables  || "";
  document.getElementById("fotoUrl").value       = c.foto          || "";
  document.getElementById("tipo").value          = c.tipo          || "culto";
  document.getElementById("color").value         = c.color         || "#c5882a";
  document.getElementById("hermanos").value      = c.hermanos      || "";
  document.getElementById("visitas").value       = c.visitas       || "";
  document.getElementById("dia").value           = c.dia           || "";
  document.getElementById("hora").value          = c.hora          || "";
  document.getElementById("latitud").value       = c.latitud       || "";
  document.getElementById("longitud").value      = c.longitud      || "";
  document.getElementById("observaciones").value = c.observaciones || "";
  formModal.classList.remove("hidden");
  setTimeout(insertarBotonElegirEnMapa, 0);
}

function cerrarModal() {
  // Si estaba en modo pick, cancelarlo primero
  if (modoPickCoord) terminarPickCoord();
  formModal.classList.add("hidden");
  formModal.style.opacity = "1";
  formModal.style.pointerEvents = "";
  limpiarForm();
}

document.getElementById("btnNuevoCulto").addEventListener("click", abrirModalNuevo);
document.getElementById("btnCerrarModal").addEventListener("click", cerrarModal);
document.getElementById("btnCancelar").addEventListener("click", cerrarModal);

document.getElementById("btnGuardar").addEventListener("click", async () => {
  formError.textContent = "";
  const barrio       = document.getElementById("barrio").value.trim();
  const direccion    = document.getElementById("direccion").value.trim();
  const responsables = document.getElementById("responsables").value.trim();
  const dia          = document.getElementById("dia").value;
  const hora         = document.getElementById("hora").value.trim();
  const latitud      = parseFloat(document.getElementById("latitud").value);
  const longitud     = parseFloat(document.getElementById("longitud").value);

  if (!barrio || !direccion || !responsables || !dia || !hora) {
    formError.textContent = "Completa los campos obligatorios (*)"; return;
  }
  if (isNaN(latitud) || isNaN(longitud)) {
    formError.textContent = "Ingresa coordenadas válidas o elige en el mapa."; return;
  }

  const culto = {
    barrio, direccion, responsables,
    foto:          document.getElementById("fotoUrl").value.trim(),
    tipo:          document.getElementById("tipo").value || "culto",
    color:         document.getElementById("color").value || "#c5882a",
    hermanos:      parseInt(document.getElementById("hermanos").value) || 0,
    visitas:       parseInt(document.getElementById("visitas").value)  || 0,
    dia, hora, latitud, longitud,
    observaciones: document.getElementById("observaciones").value.trim(),
    fechaRegistro: new Date().toISOString()
  };

  try {
    if (editandoId) {
      await update(ref(db, `cultos/${editandoId}`), culto);
    } else {
      await push(ref(db, "cultos"), culto);
    }
    cerrarModal();
  } catch (err) {
    formError.textContent = "Error al guardar: " + err.message;
  }
});

// ════════════════════════════════════════════════
//  CONFIRMAR ELIMINAR
// ════════════════════════════════════════════════
function confirmarEliminar(id) {
  eliminandoId = id;
  confirmModal.classList.remove("hidden");
}

document.getElementById("btnCerrarConfirm").addEventListener("click", () => {
  confirmModal.classList.add("hidden"); eliminandoId = null;
});
document.getElementById("btnCancelDelete").addEventListener("click", () => {
  confirmModal.classList.add("hidden"); eliminandoId = null;
});
document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
  if (!eliminandoId) return;
  try {
    await remove(ref(db, `cultos/${eliminandoId}`));
    eliminarMarcador(eliminandoId);
    delete cultosData[eliminandoId];
    eliminandoId = null;
    confirmModal.classList.add("hidden");
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
});

window._editarCulto       = (id) => { map.closePopup(); abrirModalEditar(id); };
window._confirmarEliminar = (id) => { map.closePopup(); confirmarEliminar(id); };

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
initMap();
listenCultos();

if (localStorage.getItem("ipuc_admin") === "ok") {
  activarAdmin();
}
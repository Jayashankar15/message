// ====== UI elements ======

const toggleTrackingBtn = document.getElementById('toggleTracking');

const statusEl = document.getElementById('status');

const coordsEl = document.getElementById('coords');

const addressEl = document.getElementById('address');

const lastUpdateEl = document.getElementById('lastUpdate');

const centerJhBtn = document.getElementById('centerJh');

const emergencyBtn = document.getElementById('emergencyBtn');



const contactsModal = document.getElementById('contactsModal');

const openContactsBtn = document.getElementById('openContacts');

const closeContactsBtn = document.querySelector('.modal-close');

const contactsForm = document.getElementById('contactsForm');

const contactEmailsInput = document.getElementById('contactEmails');

const contactTelegramInput = document.getElementById('contactTelegram');

const defaultMessageInput = document.getElementById('defaultMessage');

const autoSendBackendInput = document.getElementById('autoSendBackend');

const lastLogPre = document.getElementById('lastLog');



// ====== Local storage keys ======

const STORAGE_KEY = 'dj_emergency_contacts_v1';

const LOG_KEY = 'dj_emergency_log_v1';



// ====== Map & Geolocation state ======

let map, userMarker;

let watchId = null;

let lastPosition = null;



// ====== Defaults (you can edit these later in the Contacts modal) ======

function loadContacts(){

  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return {

    emails: '',

    teleIds: '',

    message: 'I need help. My location:',

    autoSendBackend: false

  };

  try { return JSON.parse(raw); } catch(e){ return {

    emails: '', teleIds:'', message:'I need help. My location:', autoSendBackend:false

  }}

}

function saveContacts(obj){

  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));

}



function loadLastLog(){

  return localStorage.getItem(LOG_KEY) || 'No emergency sent yet.';

}

function saveLastLog(text){

  localStorage.setItem(LOG_KEY, text);

  lastLogPre.textContent = text;

}



// initialize UI from storage

(function initContactsUI(){

  const c = loadContacts();

  contactEmailsInput.value = c.emails || '';

  contactTelegramInput.value = c.teleIds || '';

  defaultMessageInput.value = c.message || '';

  autoSendBackendInput.checked = !!c.autoSendBackend;

  lastLogPre.textContent = loadLastLog();

})();



// ====== Initialize Leaflet map ======

function initMap(){

  if (map) return;

  // center Jharkhand default

  map = L.map('map').setView([23.6102,85.2799], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{

    attribution: '© OpenStreetMap contributors'

  }).addTo(map);

}



// center Jharkhand button

centerJhBtn.addEventListener('click', () => {

  initMap();

  map.setView([23.6102,85.2799], 7);

});



// ====== Tracking controls ======

toggleTrackingBtn.addEventListener('click', () => {

  if (watchId) {

    stopTracking();

  } else {

    startTracking();

  }

});



function startTracking(){

  if (!('geolocation' in navigator)) { alert('Geolocation not supported'); return; }

  initMap();

  toggleTrackingBtn.textContent = 'Stop Tracking';

  statusEl.textContent = 'Tracking: on';

  watchId = navigator.geolocation.watchPosition(position => {

    handlePosition(position);

  }, err => {

    alert('Error getting location: ' + (err.message || err.code));

    console.error(err);

  }, {enableHighAccuracy:true, maximumAge:1000, timeout:10000});

}



function stopTracking(){

  if (watchId) navigator.geolocation.clearWatch(watchId);

  watchId = null;

  toggleTrackingBtn.textContent = 'Start Tracking';

  statusEl.textContent = 'Tracking: off';

}



function handlePosition(position){

  const lat = position.coords.latitude;

  const lon = position.coords.longitude;

  const ts = new Date(position.timestamp).toLocaleString();



  lastPosition = {lat, lon, ts, accuracy: position.coords.accuracy};



  coordsEl.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)} (±${Math.round(position.coords.accuracy)}m)`;

  lastUpdateEl.textContent = ts;



  // reverse geocode via Nominatim

  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)

    .then(r => r.json()).then(data => {

      addressEl.textContent = data.display_name || '-';

    }).catch(e => {

      addressEl.textContent = '-';

    });



  // update marker on map

  initMap();

  if (!userMarker) {

    userMarker = L.marker([lat,lon]).addTo(map).bindPopup('You are here').openPopup();

  } else {

    userMarker.setLatLng([lat,lon]);

  }

  // keep map view tuned to user

  map.setView([lat,lon], 16);

}



// ====== Emergency behavior ======

openContactsBtn.addEventListener('click', (e) => {

  e.preventDefault();

  contactsModal.style.display = 'flex';

});



closeContactsBtn.addEventListener('click', () => {

  contactsModal.style.display = 'none';

});

document.getElementById('closeContacts').addEventListener('click', () => {

  contactsModal.style.display = 'none';

});



// save contacts form

contactsForm.addEventListener('submit', (e) => {

  e.preventDefault();

  const obj = {

    emails: contactEmailsInput.value.trim(),

    teleIds: contactTelegramInput.value.trim(),

    message: defaultMessageInput.value.trim(),

    autoSendBackend: autoSendBackendInput.checked

  };

  saveContacts(obj);

  alert('Saved contacts & settings.');

  contactsModal.style.display = 'none';

});



// close modal by clicking outside

window.addEventListener('click', (ev) => {

  if (ev.target === contactsModal) contactsModal.style.display = 'none';

});



// The emergency button

emergencyBtn.addEventListener('click', async () => {

  // capture latest position; if no lastPosition, try to get a single position

  let pos = lastPosition;

  if (!pos) {

    try {

      const p = await new Promise((res, rej) => {

        navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:10000});

      });

      pos = {lat: p.coords.latitude, lon: p.coords.longitude, ts: new Date().toLocaleString(), accuracy: p.coords.accuracy};

    } catch (err) {

      alert('Unable to get location. Please enable location & try again.');

      return;

    }

  }



  // build message

  const contacts = loadContacts();

  const emailList = (contacts.emails || '').split(',').map(s=>s.trim()).filter(Boolean);

  const teleList = (contacts.teleIds || '').split(',').map(s=>s.trim()).filter(Boolean);

  const msgBody = `${contacts.message || 'I need help. My location:'}\n\nCoordinates: ${pos.lat}, ${pos.lon}\nTime: ${pos.ts}\nAccuracy: ${pos.accuracy ? Math.round(pos.accuracy)+'m' : 'unknown'}\n\nMap: https://www.openstreetmap.org/?mlat=${pos.lat}&mlon=${pos.lon}#map=18/${pos.lat}/${pos.lon}`;



  // log the event locally (editable later)

  const logText = `EMERGENCY SENT\nTime: ${new Date().toLocaleString()}\nCoords: ${pos.lat},${pos.lon}\nEmails: ${emailList.join(';')}\nTeleIDs: ${teleList.join(';')}\nMessage: ${contacts.message}\n\n`;

  saveLastLog(logText);

  alert('Emergency captured locally. Sending options will now be attempted.');



  // Option A: open mail client with mailto (works without server)

  if (emailList.length) {

    const to = encodeURIComponent(emailList.join(','));

    const subject = encodeURIComponent('EMERGENCY - Need Help');

    const body = encodeURIComponent(msgBody);

    // open mail client

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

  } else {

    console.warn('No emails configured for mailto.');

  }



  // Option B: If backend is enabled in contacts, POST to your server endpoint

  if (contacts.autoSendBackend) {

    // IMPORTANT: Replace the URL below with your deployed backend URL when you deploy the server (see instructions)

    const BACKEND_URL = '/api/send-emergency'; // change to full URL like 'https://your-server.com/api/send-emergency' after deployment



    fetch(BACKEND_URL, {

      method: 'POST',

      headers: {'Content-Type':'application/json'},

      body: JSON.stringify({

        emails: emailList,

        teleIds: teleList,

        message: contacts.message,

        coords: {lat: pos.lat, lon: pos.lon, ts: pos.ts}

      })

    }).then(r => {

      if (r.ok) return r.json();

      throw new Error('Server responded with ' + r.status);

    }).then(data => {

      alert('Server send successful (email/telegram).');

      const newLog = loadLastLog() + '\nServer response: ' + JSON.stringify(data);

      saveLastLog(newLog);

    }).catch(err => {

      console.error('Backend send failed', err);

      saveLastLog(loadLastLog() + '\nBackend send failed: ' + err.message);

    });

  }

});
// ==========================================
// [MOD-005] GESTOR DE RED Y SINCRONIZACIÓN
// ==========================================
import { State } from './state.js';

const API_URL = "https://script.google.com/macros/s/AKfycbzGnFrAB1Bn8mHuZbhvQB8wopyAnNh_UtKo2heQ3EcM_PUHSzyEF5WvYwNuLn1NE2ek9w/exec"; 

export function guardarEnCola(accion, datos) {
    let cola = JSON.parse(localStorage.getItem('planet_queue') || "[]");
    cola.push({ action: accion, data: datos, timestamp: Date.now() });
    localStorage.setItem('planet_queue', JSON.stringify(cola));
}

export async function sincronizarCola(callbackReCarga) {
    let cola = JSON.parse(localStorage.getItem('planet_queue') || "[]");
    if (cola.length === 0) return;
    
    let nuevaCola = [];
    for (let item of cola) {
        try {
            const response = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: item.action, data: item.data }) 
            });
            const res = await response.json(); 
            if (!res.exito) throw new Error(res.error);
        } catch (e) { nuevaCola.push(item); }
    }
    
    localStorage.setItem('planet_queue', JSON.stringify(nuevaCola));
    if (nuevaCola.length === 0 && typeof callbackReCarga === 'function') {
        callbackReCarga(true);
    }
}

export async function callAPI(action, data = null) {
  if (data && typeof data === 'object') data.aliasOperador = State.currentUserAlias; 
  
  if (!navigator.onLine && action !== 'obtenerDatosCompletos') { 
      guardarEnCola(action, data); 
      return { exito: true, offline: true }; 
  }
  
  try {
    const response = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: action, data: data }) 
    });
    return await response.json();
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
        alert("⚠️ BLOQUEO DE GOOGLE (CORS) DETECTADO.\n\nEl servidor rechazó la conexión porque detectó funciones nuevas sin autorización en la URL pública.");
    } else if (action !== 'obtenerDatosCompletos') { 
        guardarEnCola(action, data); 
        return { exito: true, offline: true }; 
    }
    return { exito: false, error: e.toString() };
  }
}

export function updateOnlineStatus(callbackReCarga) {
    const status = document.getElementById('offline-indicator');
    if(navigator.onLine) { 
        if(status) status.style.display = 'none'; 
        sincronizarCola(callbackReCarga); 
    } else { 
        if(status) status.style.display = 'block'; 
    }
}

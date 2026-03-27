// ==========================================
// [MOD-006] NÚCLEO UTILITARIO Y TRANSVERSAL
// ==========================================
import { State } from './state.js';

export const COP = new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
});

export function showToast(msg, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
    toast.role = 'alert';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function nav(v, btn){
    document.querySelectorAll('.view-sec').forEach(e => e.style.display='none');
    var view = document.getElementById('view-'+v);
    if(view) view.style.display='block';
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
    if(btn) btn.classList.add('active');
    localStorage.setItem('planet_view', v);
}

export function verificarIdentidad() {
    var alias = localStorage.getItem('planet_alias');
    if (!alias) { 
        if(State.modals.login) State.modals.login.show(); 
    } else { 
        State.currentUserAlias = alias; 
        var display = document.getElementById('user-display');
        if(display) display.innerText = alias; 
    }
}

export function guardarIdentidad() {
    var alias = document.getElementById('login-alias').value.trim();
    if (alias.length < 3) return alert("Mínimo 3 letras.");
    localStorage.setItem('planet_alias', alias); 
    State.currentUserAlias = alias;
    if(State.modals.login) State.modals.login.hide(); 
    var display = document.getElementById('user-display');
    if(display) display.innerText = State.currentUserAlias;
}

export function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); 
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image(); 
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas'); 
                const scaleFactor = maxWidth / img.width;
                elem.width = maxWidth; 
                elem.height = img.height * scaleFactor;
                const ctx = elem.getContext('2d'); 
                ctx.drawImage(img, 0, 0, elem.width, elem.height);
                resolve(elem.toDataURL(file.type, quality));
            }
            img.onerror = error => reject(error);
        }
        reader.onerror = error => reject(error);
    });
}

export function fixDriveLink(url) {
    if (!url) return "";
    var match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) { match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); }
    if (match && match[1]) { return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000"; }
    return url.split(' ')[0];
}

export async function getFileFromUrlAsync(url, defaultName) {
    try {
        if (url.startsWith('data:image')) {
            var arr = url.split(','); 
            var mime = arr[0].match(/:(.*?);/)[1]; 
            var bstr = atob(arr[1]); 
            var n = bstr.length; 
            var u8arr = new Uint8Array(n);
            while(n--){ u8arr[n] = bstr.charCodeAt(n); } 
            return new File([u8arr], defaultName + ".jpg", {type: mime});
        } else {
            const response = await fetch(url, { mode: 'cors' }); 
            const blob = await response.blob(); 
            return new File([blob], defaultName + ".jpg", {type: blob.type || "image/jpeg"});
        }
    } catch(e) { return null; }
}

export function copyingDato(txt) {
    if(!txt || txt === 'undefined' || txt === '0') return alert("Dato vacío o no disponible");
    navigator.clipboard.writeText(txt).then(() => { showToast("Copiado: " + String(txt).substring(0,10) + "..."); });
}

export function previewFile(inputId, imgId){ 
    var f=document.getElementById(inputId).files[0]; 
    if(f){
        var r=new FileReader();
        r.onload=e=>{
            document.getElementById(imgId).src=e.target.result;
            document.getElementById(imgId).style.display='block';
        };
        r.readAsDataURL(f);
    } 
}

import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast, fixDriveLink, compressImage, previewFile } from '../core.js';

export function renderInv(){ 
    var c = document.getElementById('inv-list'); 
    var q = document.getElementById('inv-search').value.toLowerCase();
    var htmlContent = '';
    State.data.inv.filter(p=> p.nombre.toLowerCase().includes(q)).slice(0,50).forEach(p=>{
        var imgHtml = p.foto ? `<img src="${fixDriveLink(p.foto)}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? COP.format(p.publico) : 'N/A';
        var btnAddCart = `<button class="btn btn-sm text-white w-100 fw-bold d-flex align-items-center justify-content-center gap-1" style="background:var(--primary); border:none;" onclick="window.POS.agregarAlCarritoDesdeInv('${p.id}')"><i class="fas fa-cart-plus"></i> Añadir a Carrito</button>`;
        var btnShareNative = `<button class="btn btn-sm text-white w-100 fw-bold d-flex align-items-center justify-content-center gap-1 mt-1" style="background:#38a169; border:none;" onclick="window.POS.shareProductNative('${p.id}')"><i class="fab fa-whatsapp"></i> Compartir WA</button>`;
        htmlContent += `<div class="card-catalog"><div class="cat-img-box">${imgHtml}<div class="btn-edit-float" onclick="window.Inventory.openEdit('${p.id}')"><i class="fas fa-pencil-alt"></i></div></div><div class="cat-body"><div class="cat-title text-truncate" style="white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.nombre}</div><div class="cat-price">${precioDisplay}</div><small class="text-muted" style="font-size:0.7rem;">Costo: ${COP.format(p.costo)}</small></div><div class="p-2 bg-light border-top">${btnAddCart}${btnShareNative}</div></div>`;
    });
    c.innerHTML = htmlContent;
}

export function abrirModalNuevo() { document.getElementById('new-file-foto').value = ""; document.getElementById('img-preview-new').style.display='none'; if(State.modals.nuevo) State.modals.nuevo.show(); }

export function crearProducto() {
    if (document.activeElement) document.activeElement.blur();
    var n = document.getElementById('new-nombre').value; var c = document.getElementById('new-costo').value; var p = document.getElementById('new-publico').value;
    if(!n || !p) return alert("Falta nombre o precio");
    var d = { id: 'GEN-'+Date.now(), nombre: n, categoria: document.getElementById('new-categoria').value, costo: c, publico: p, descripcion: document.getElementById('new-desc').value, proveedor: "General" };
    var f = document.getElementById('new-file-foto').files[0];
    
    var processApiCall = function(payload) {
        if(State.modals.nuevo) State.modals.nuevo.hide();
        showToast("⚡ Creando producto. Subiendo a la nube...", "info");
        State.data.inv.unshift({ id: payload.id, nombre: payload.nombre, cat: payload.categoria, costo: payload.costo, publico: payload.publico, prov: payload.proveedor, foto: '' });
        renderInv();
        callAPI('crearProductoManual', payload).then(r=> { if(r.exito) { showToast("✅ Producto subido", "success"); if(window.App && window.App.loadData) window.App.loadData(true); } });
    };

    var promise = f ? compressImage(f) : Promise.resolve(null);
    promise.then(b64 => {
        if(b64) { d.imagenBase64 = b64.split(',')[1]; d.mimeType = f.type; d.nombreArchivo = f.name; }
        processApiCall(d);
    });
}

export function openEdit(id) {
    State.prodEdit = State.data.inv.find(x=>x.id===id);
    document.getElementById('inp-edit-nombre').value = State.prodEdit.nombre; document.getElementById('inp-edit-categoria').value = State.prodEdit.cat; document.getElementById('inp-edit-costo').value = State.prodEdit.costo; document.getElementById('inp-edit-publico').value = State.prodEdit.publico;
    var m = 30; if(State.prodEdit.costo > 0 && State.prodEdit.publico > 0) m = ((State.prodEdit.publico / State.prodEdit.costo) - 1) * 100;
    document.getElementById('inp-edit-margen').value = m.toFixed(1);
    document.getElementById('inp-edit-desc').value = State.prodEdit.desc || ""; document.getElementById('inp-file-foto').value = ""; document.getElementById('img-preview-box').style.display='none'; 
    var fixedUrl = fixDriveLink(State.prodEdit.foto); if(fixedUrl){ document.getElementById('img-preview-box').src=fixedUrl; document.getElementById('img-preview-box').style.display='block';} 
    if(State.modals.edicion) State.modals.edicion.show();
}

export function guardarCambiosAvanzado() {
    if (document.activeElement) document.activeElement.blur();
    var p = { id: State.prodEdit.id, nombre: document.getElementById('inp-edit-nombre').value, categoria: document.getElementById('inp-edit-categoria').value, costo: document.getElementById('inp-edit-costo').value, publico: document.getElementById('inp-edit-publico').value, descripcion: document.getElementById('inp-edit-desc').value, proveedor: State.prodEdit.prov, urlExistente: State.prodEdit.foto || "" };
    var f = document.getElementById('inp-file-foto').files[0]; 
    
    var processApiCall = function(payload) {
        if(State.modals.edicion) State.modals.edicion.hide();
        showToast("⚡ Actualizando catálogo en la nube...", "info");
        if(State.prodEdit) { State.prodEdit.nombre = payload.nombre; State.prodEdit.publico = payload.publico; State.prodEdit.costo = payload.costo; renderInv(); }
        callAPI('guardarProductoAvanzado', payload).then(r=> { showToast("✅ Catálogo actualizado", "success"); if(window.App && window.App.loadData) window.App.loadData(true); });
    };

    var promise = f ? compressImage(f) : Promise.resolve(null);
    promise.then(b64 => { 
        if(b64) { p.imagenBase64 = b64.split(',')[1]; p.mimeType = f.type; p.nombreArchivo = f.name; } 
        processApiCall(p);
    });
}

export function calcGain(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var margen = parseFloat(document.getElementById(idMargen).value) || 0;
    if(costo > 0) { document.getElementById(idPublico).value = Math.round(costo * (1 + (margen/100))); }
}

export function calcMargen(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var publico = parseFloat(document.getElementById(idPublico).value) || 0;
    if(costo > 0 && publico > 0) { document.getElementById(idMargen).value = (((publico / costo) - 1) * 100).toFixed(1); }
}

export function abrirModalProv() { renderProvs(); if(State.modals.prov) State.modals.prov.show(); }

export function renderProvs() {
    var c = document.getElementById('list-provs'); if(!c) return;
    c.innerHTML='';
    State.data.proveedores.forEach(p => {
        var waLink = p.tel ? `https://wa.me/57${p.tel.replace(/\D/g,'')}` : '#';
        var btn = p.tel ? `<a href="${waLink}" target="_blank" class="btn btn-sm btn-success text-white"><i class="fab fa-whatsapp"></i></a>` : '<span class="text-muted">-</span>';
        c.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><div><strong>${p.nombre}</strong><br><small class="text-muted">${p.tel||'Sin numero'}</small></div><div class="d-flex gap-2">${btn}<button class="btn btn-sm btn-light border" onclick="window.Inventory.editarProv('${p.nombre}')">✏️</button></div></div>`;
    });
}

export function guardarProvManual(){ 
    var n = document.getElementById('new-prov-name').value; var t = document.getElementById('new-prov-tel').value; 
    if(!n) return; 
    callAPI('registrarProveedor', {nombre:n, tel:t}).then(r=>{ document.getElementById('new-prov-name').value=''; document.getElementById('new-prov-tel').value=''; if(window.App && window.App.loadData) window.App.loadData(true); }); 
}

export function editarProv(nombre){ var t = prompt("Nuevo teléfono para "+nombre+":"); if(t) { callAPI('registrarProveedor', {nombre:nombre, tel:t}).then(()=> { if(window.App && window.App.loadData) window.App.loadData(true); }); } }

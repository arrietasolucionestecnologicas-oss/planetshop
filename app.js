const API_URL = "https://script.google.com/macros/s/AKfycbzGnFrAB1Bn8mHuZbhvQB8wopyAnNh_UtKo2heQ3EcM_PUHSzyEF5WvYwNuLn1NE2ek9w/exec"; 

var D = {inv:[], provs:[], deud:[], hist:[], cats:[], proveedores:[], ultimasVentas:[], cotizaciones:[], pasivos:[]};
var CART = [];
var myModalEdit, myModalNuevo, myModalLogin, myModalRefinanciar, myModalEditItem, myModalManualItem;
var prodEdit = null; var refEditId = null; var refSaldoActual = 0;
var calculatedValues = { total: 0, inicial: 0, base: 0, descuento: 0 };
var currentUserAlias = "Anonimo"; var usuarioForzoInicial = false;

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

function verificarIdentidad() {
    var alias = localStorage.getItem('planet_alias');
    if (!alias) { myModalLogin.show(); } else { currentUserAlias = alias; document.getElementById('user-display').innerText = alias; }
}

function guardarIdentidad() {
    var alias = document.getElementById('login-alias').value.trim();
    if (alias.length < 3) return alert("Mínimo 3 letras.");
    localStorage.setItem('planet_alias', alias); currentUserAlias = alias;
    myModalLogin.hide(); document.getElementById('user-display').innerText = currentUserAlias;
}

function showToast(msg, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
    toast.role = 'alert';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateOnlineStatus() {
    const status = document.getElementById('offline-indicator');
    if(navigator.onLine) { status.style.display = 'none'; sincronizarCola(); } 
    else { status.style.display = 'block'; }
}
window.addEventListener('online', updateOnlineStatus); window.addEventListener('offline', updateOnlineStatus);

function guardarEnCola(accion, datos) {
    let cola = JSON.parse(localStorage.getItem('planet_queue') || "[]");
    cola.push({ action: accion, data: datos, timestamp: Date.now() });
    localStorage.setItem('planet_queue', JSON.stringify(cola));
}

async function sincronizarCola() {
    let cola = JSON.parse(localStorage.getItem('planet_queue') || "[]");
    if (cola.length === 0) return;
    let nuevaCola = [];
    for (let item of cola) {
        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: item.action, data: item.data }) });
            const res = await response.json(); if (!res.exito) throw new Error(res.error);
        } catch (e) { nuevaCola.push(item); }
    }
    localStorage.setItem('planet_queue', JSON.stringify(nuevaCola));
    if (nuevaCola.length === 0) loadData(true);
}

async function callAPI(action, data = null) {
  if (data && typeof data === 'object') data.aliasOperador = currentUserAlias; 
  if (!navigator.onLine && action !== 'obtenerDatosCompletos') { guardarEnCola(action, data); return { exito: true, offline: true }; }
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: action, data: data }) });
    return await response.json();
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
        alert("⚠️ BLOQUEO DE GOOGLE (CORS) DETECTADO.\n\nEl servidor rechazó la conexión porque detectó funciones nuevas sin autorización en la URL pública.\n\nSOLUCIÓN TÉCNICA:\n1. Ve a Apps Script\n2. 'Implementar' > 'Gestionar implementaciones'\n3. Clic en el Lápiz (Editar)\n4. En 'Versión', cambia a 'Nueva versión'\n5. Clic en 'Implementar'.");
    } else if (action !== 'obtenerDatosCompletos') { 
        guardarEnCola(action, data); 
        return { exito: true, offline: true }; 
    }
    return { exito: false, error: e.toString() };
  }
}

function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas'); const scaleFactor = maxWidth / img.width;
                elem.width = maxWidth; elem.height = img.height * scaleFactor;
                const ctx = elem.getContext('2d'); ctx.drawImage(img, 0, 0, elem.width, elem.height);
                resolve(elem.toDataURL(file.type, quality));
            }
            img.onerror = error => reject(error);
        }
        reader.onerror = error => reject(error);
    });
}

function previewFile(inputId, imgId){ 
    var f=document.getElementById(inputId).files[0]; 
    if(f){var r=new FileReader();r.onload=e=>{document.getElementById(imgId).src=e.target.result;document.getElementById(imgId).style.display='block';};r.readAsDataURL(f);} 
}

function fixDriveLink(url) {
    if (!url) return "";
    var match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!match) { match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); }
    if (match && match[1]) { return "https://lh3.googleusercontent.com/d/" + match[1] + "=w1000"; }
    return url.split(' ')[0];
}

async function getFileFromUrlAsync(url, defaultName) {
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

function calcGain(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var margen = parseFloat(document.getElementById(idMargen).value) || 0;
    if(costo > 0) { 
        var ganancia = costo * (1 + (margen/100)); 
        document.getElementById(idPublico).value = Math.round(ganancia); 
    }
}
function calcMargen(idCosto, idPublico, idMargen) {
    var costo = parseFloat(document.getElementById(idCosto).value) || 0;
    var publico = parseFloat(document.getElementById(idPublico).value) || 0;
    if(costo > 0 && publico > 0) { 
        var margen = ((publico / costo) - 1) * 100; 
        document.getElementById(idMargen).value = margen.toFixed(1); 
    }
}

// === CONTROLADOR DE CARRITO (NO AUTO-OPEN) ===
function toggleMobileCart() { 
    var mc = document.getElementById('mobile-cart'); 
    if(mc) { 
        mc.classList.toggle('visible'); 
        updateCartUI(true); 
    } 
}

window.onload = function() {
  myModalEdit = new bootstrap.Modal(document.getElementById('modalEdicion'));
  myModalNuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  myModalLogin = new bootstrap.Modal(document.getElementById('modalLoginApp'));
  myModalRefinanciar = new bootstrap.Modal(document.getElementById('modalRefinanciar'));
  myModalEditItem = new bootstrap.Modal(document.getElementById('modalEditItem'));
  myModalManualItem = new bootstrap.Modal(document.getElementById('modalManualItem'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;
  
  document.querySelectorAll('#c-inicial').forEach(el => { el.removeAttribute('disabled'); el.oninput = calcCart; });
  var lastView = localStorage.getItem('planet_view') || 'pos';
  nav(lastView, document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`));
  
  verificarIdentidad(); updateOnlineStatus(); loadData();
};

function loadData(silent = false){
  if(!silent && D.inv.length === 0) document.getElementById('loader').style.display='flex';
  callAPI('obtenerDatosCompletos').then(res => {
    if(res && res.inventario) { localStorage.setItem('planet_data', JSON.stringify(res)); renderData(res); }
    document.getElementById('loader').style.display='none';
  }).catch(() => {
    const raw = localStorage.getItem('planet_data');
    if(raw) renderData(JSON.parse(raw));
    document.getElementById('loader').style.display='none';
  });
}

function renderData(res) {
    D = res; D.inv = res.inventario || []; D.deudores = res.deudores || []; D.historial = res.historial || [];
    if(res.metricas) { document.getElementById('bal-caja').innerText = COP.format(res.metricas.saldo||0); }
    renderPos(); renderInv(); renderFin(); renderCartera();
}

function nav(v, btn){
  document.querySelectorAll('.view-sec').forEach(e => e.style.display='none');
  document.getElementById('view-'+v).style.display='block';
  document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
  if(btn) btn.classList.add('active');
  localStorage.setItem('planet_view', v);
}

function renderPos(){
  var q = document.getElementById('pos-search').value.toLowerCase().trim();
  var c = document.getElementById('pos-list'); 
  c.innerHTML='';
  if(!q) { document.getElementById('pos-placeholder').style.display='block'; return; }
  document.getElementById('pos-placeholder').style.display='none';

  var res = D.inv.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));
  res.slice(0,20).forEach(p => {
    var active = CART.some(x=>x.id===p.id) ? 'active' : '';
    c.innerHTML += `<div class="pos-row-lite ${active}" onclick="toggleCart('${p.id}')"><div class="info"><div class="name">${p.nombre}</div><div class="meta">${p.cat}</div></div><div class="price">${COP.format(p.publico||p.costo)}</div></div>`;
  });
}

function toggleCart(id) {
   var p = D.inv.find(x => x.id === id);
   var idx = CART.findIndex(x=>x.id===id);
   if(idx > -1) { CART.splice(idx,1); } 
   else { 
       var item = Object.assign({}, p); item.cantidad = 1; item.conIva = false;
       if (item.publico > 0) { 
           item.precioUnitarioFinal = item.publico; 
           item.margenIndividual = item.costo > 0 ? ((item.publico/item.costo)-1)*100 : 100; 
           item.modificadoManualmente = true; 
       } 
       else { 
           var gUtil = parseFloat(document.getElementById('c-util').value)||30; 
           item.margenIndividual = gUtil; 
           item.precioUnitarioFinal = (item.costo||0)*(1+gUtil/100); 
       }
       item.descuentoIndividual = 0; CART.push(item); 
   }
   updateCartUI();
   showToast("🛒 Carrito actualizado", "info");
}

// === NUEVO MODAL DE ITEM MANUAL (UX MEJORADA) ===
function abrirModalItemManual() {
    document.getElementById('man-nombre').value = '';
    document.getElementById('man-publico').value = '';
    document.getElementById('man-costo').value = '';
    myModalManualItem.show();
}

function confirmarItemManual() {
    var nombre = document.getElementById('man-nombre').value.trim();
    if (!nombre) return alert("Ingrese el nombre del ítem.");
    var precio = parseFloat(document.getElementById('man-publico').value);
    if (isNaN(precio) || precio <= 0) return alert("Precio de venta inválido.");
    var costo = parseFloat(document.getElementById('man-costo').value) || 0;

    CART.push({ id: 'MAN-'+Date.now(), nombre: nombre, cat: 'Manual', costo: costo, publico: precio, cantidad: 1, manual: true, modificadoManualmente: true, margenIndividual: costo>0?((precio/costo)-1)*100:100, descuentoIndividual: 0, precioUnitarioFinal: precio });
    
    myModalManualItem.hide();
    updateCartUI();
    showToast("🛒 Ítem manual agregado", "success");
}

function abrirEditorItem(id) {
    var item = CART.find(x => x.id === id);
    if (!item) return;
    document.getElementById('edit-item-id').value = item.id; 
    document.getElementById('edit-item-nombre').value = item.nombre;
    document.getElementById('edit-item-costo').value = item.costo || 0;
    document.getElementById('edit-item-margen').value = item.margenIndividual.toFixed(1);
    document.getElementById('edit-item-desc').value = item.descuentoIndividual || 0;
    var pactadoEl = document.getElementById('edit-item-precio-pactado');
    if (pactadoEl) pactadoEl.value = '';
    calcEditorItem(); 
    myModalEditItem.show();
}

function calcEditorItem() {
    var id = document.getElementById('edit-item-id').value;
    var item = CART.find(x => x.id === id);
    if (!item) return;
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0;
    var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    var descPrc = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
    
    var precioLista = costo * (1 + margen/100);
    var descuentoMonto = precioLista * (descPrc / 100);
    var precioNeto = precioLista - descuentoMonto;
    
    if (precioNeto < 0) precioNeto = 0;
    document.getElementById('edit-item-total').innerText = COP.format(Math.round(precioNeto));
}

function aplicarPrecioPactado() {
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0;
    var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    var precioPactado = parseFloat(document.getElementById('edit-item-precio-pactado').value) || 0;

    if (precioPactado <= 0) {
        document.getElementById('edit-item-desc').value = 0;
        calcEditorItem();
        return;
    }

    var precioLista = costo * (1 + margen/100);
    if (precioLista > 0) {
        var descuentoRequeridoMonto = precioLista - precioPactado;
        var descuentoRequeridoPrc = (descuentoRequeridoMonto / precioLista) * 100;
        
        if (descuentoRequeridoPrc < 0) {
             descuentoRequeridoPrc = 0;
             var nuevoMargen = ((precioPactado / costo) - 1) * 100;
             document.getElementById('edit-item-margen').value = nuevoMargen.toFixed(1);
        }
        document.getElementById('edit-item-desc').value = descuentoRequeridoPrc.toFixed(2);
    }
    calcEditorItem();
}

function guardarEditorItem() {
    var id = document.getElementById('edit-item-id').value;
    var item = CART.find(x => x.id === id);
    item.nombre = document.getElementById('edit-item-nombre').value;
    item.margenIndividual = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    item.descuentoIndividual = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
    item.modificadoManualmente = true; 
    myModalEditItem.hide(); updateCartUI();
}

function changeQty(id, delta) {
    var item = CART.find(x => x.id === id);
    if (item) { item.cantidad += delta; if (item.cantidad <= 0) CART.splice(CART.findIndex(x=>x.id===id), 1); updateCartUI(true); }
}

function updateCartUI(keepOpen=false) {
   var count = CART.reduce((a, b) => a + (b.cantidad || 1), 0);
   var btnFloat = document.getElementById('btn-float-cart');
   if(btnFloat) {
       btnFloat.style.display = count > 0 ? 'block' : 'none';
       btnFloat.innerText = "🛒 " + count;
   }

   var panels = [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')];
   panels.forEach(p => {
       if(!p) return;
       var listContainer = p.querySelector('#cart-items-list');
       if(CART.length === 0) { listContainer.innerHTML = 'Vacío...'; p.querySelector('#c-concepto').style.display='block'; } 
       else { p.querySelector('#c-concepto').style.display='none'; listContainer.innerHTML = CART.map(x => `<div class="d-flex justify-content-between mb-1 border-bottom pb-1"><div style="flex:1"><small class="fw-bold">${x.nombre}</small><br><small>${COP.format(x.precioUnitarioFinal||0)} c/u</small></div><div><button class="btn btn-sm btn-light py-0 px-2" onclick="abrirEditorItem('${x.id}')">✏️</button><button class="btn btn-sm py-0 px-2" onclick="changeQty('${x.id}', -1)">-</button> <b>${x.cantidad}</b> <button class="btn btn-sm py-0 px-2" onclick="changeQty('${x.id}', 1)">+</button></div></div>`).join(''); }
   });

   if(CART.length === 0 && !keepOpen) { var mc = document.getElementById('mobile-cart'); if(mc) mc.classList.remove('visible'); }
   calcCart();
}

function toggleIni() { usuarioForzoInicial = false; calcCart(); }

function calcCart() {
   var parent = document.getElementById('desktop-cart-container');
   var targetVal = parseFloat(parent.querySelector('#c-target').value);
   var cuotas = parseInt(parent.querySelector('#c-cuotas').value)||1;
   var metodo = parent.querySelector('#c-metodo').value;
   var utilG = parseFloat(parent.querySelector('#c-util').value)||30; 
   var descG = parseFloat(parent.querySelector('#c-desc').value)||0; 
   var intG = parseFloat(parent.querySelector('#c-int').value)||5; 
   
   var totalFinal = 0; var base = 0;
   if(CART.length>0){
       CART.forEach(i=>{
           if(i.manual) { totalFinal += (i.precioUnitarioFinal * i.cantidad); base += (i.precioUnitarioFinal * i.cantidad); }
           else {
               var m = i.modificadoManualmente ? i.margenIndividual : utilG;
               var px = (i.costo * (1 + m/100)) * (1 - (descG>0?descG:(i.descuentoIndividual||0))/100);
               i.precioUnitarioFinal = Math.max(0,px);
               totalFinal += (i.precioUnitarioFinal * i.cantidad); base += (i.costo * i.cantidad);
           }
       });
   }

   if(!isNaN(targetVal) && targetVal > 0) totalFinal = targetVal;
   else if (metodo === "Crédito") { var saldoTemp = totalFinal - (totalFinal*0.3); totalFinal += (saldoTemp * (intG/100) * cuotas); }

   calculatedValues.total = totalFinal; calculatedValues.base = base;
   var inpIni = parent.querySelector('#c-inicial');
   if(document.activeElement === inpIni) { usuarioForzoInicial = true; }
   var inicial = usuarioForzoInicial ? (parseFloat(inpIni.value)||0) : (totalFinal * 0.3);
   calculatedValues.inicial = inicial;
   
   [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(p => {
       if(!p) return;
       p.querySelector('#res-cont').innerText = COP.format(totalFinal);
       if(metodo==="Crédito") {
           p.querySelector('#row-cred').style.display='block';
           p.querySelector('#c-inicial').style.display='block';
           if(!usuarioForzoInicial) p.querySelector('#c-inicial').value = inicial;
           p.querySelector('#res-ini').innerText = COP.format(inicial);
           p.querySelector('#res-cuota-val').innerText = COP.format(Math.max(0, (totalFinal-inicial)/cuotas));
       } else { p.querySelector('#row-cred').style.display='none'; p.querySelector('#c-inicial').style.display='none'; }
   });
}

function finalizarVenta() {
   var p = document.getElementById('desktop-cart-container');
   var cli = p.querySelector('#c-cliente').value; if(!cli) return alert("Falta Cliente");
   var tel = p.querySelector('#c-tel').value || "";
   if(calculatedValues.total <= 0) return alert("Precio inválido");
   
   var items = CART.length>0 ? CART.map(i=>({ nombre:i.nombre, cat:i.cat, costo:i.costo, precioVenta:i.precioUnitarioFinal })) : [{nombre:p.querySelector('#c-concepto').value||"Venta", cat:"General", costo:calculatedValues.base, precioVenta:calculatedValues.total}];
   var d = { items: items, cliente: cli, telefono: tel, metodo: p.querySelector('#c-metodo').value, inicial: calculatedValues.inicial, cuotas: p.querySelector('#c-cuotas').value, vendedor: currentUserAlias };
   
   p.querySelector('#btn-vender-main').disabled = true;
   callAPI('procesarVentaCarrito', d).then(r => {
       p.querySelector('#btn-vender-main').disabled = false;
       if(r.exito) { clearCart(); loadData(true); } else alert(r.error);
   });
}

function clearCart() { CART=[]; usuarioForzoInicial=false; [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(p=>{ if(p) { p.querySelector('#c-inicial').value=''; p.querySelector('#c-cliente').value=''; p.querySelector('#c-tel').value=''; } }); updateCartUI(); }

function embellecerDescripcion(texto) {
    if (!texto) return "";
    return texto.split('\n').map(l => l.trim() ? "• " + l.replace(/^[-•*🔹]\s*/, '') : "").filter(l => l !== "").join('\n');
}

async function shareProductNative(id) {
    var loader = document.getElementById('loader');
    if(loader) loader.style.display = 'flex';
    
    try {
        var p = D.inv.find(x => x.id === id);
        if (!p) { if(loader) loader.style.display = 'none'; return alert("Producto no encontrado"); }
        
        var nombre = p.nombre.toUpperCase();
        var precio = p.publico > 0 ? COP.format(p.publico) : 'Consultar';
        var desc = embellecerDescripcion(p.desc);
        
        var shareText = `🪐 *Planet.shop by GamePlanet*\n\n🛍️ *Producto:* ${nombre}\n💳 *Inversión:* ${precio}\n\n`;
        if (desc) { shareText += `📋 *Detalles:*\n${desc}\n\n`; }
        shareText += `🤝 _Quedamos a tu entera disposición._`;
        
        var shareData = { title: nombre, text: shareText };
        var hasImage = false;
        var fixedUrl = fixDriveLink(p.foto);
        
        if (fixedUrl && fixedUrl.length > 5) {
            var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            var file = await getFileFromUrlAsync(fixedUrl, cleanName);
            if (file) { shareData.files = [file]; hasImage = true; }
        }
        
        if(loader) loader.style.display = 'none';

        if (navigator.canShare && navigator.share) {
            if (hasImage && !navigator.canShare({ files: shareData.files })) {
                delete shareData.files;
            }
            await navigator.share(shareData);
            showToast("¡Compartido con éxito!", "success");
        } else {
            shareProdWhatsApp(id); // Fallback
        }
    } catch(error) {
        if(loader) loader.style.display = 'none';
        if (error.name !== 'AbortError') { shareProdWhatsApp(id); } 
    }
}

function shareProdWhatsApp(id) {
    var p = D.inv.find(x => x.id === id); if (!p) return;
    var msg = `🪐 *Planet.shop by GamePlanet*\n\n🛍️ *Producto:* ${p.nombre.toUpperCase()}\n💳 *Inversión:* ${COP.format(p.publico)}\n\n`;
    var linkFoto = fixDriveLink(p.foto);
    if(linkFoto && linkFoto.length > 10) { msg += `🖼️ *Imagen:* ${linkFoto}\n\n`; }
    var desc = embellecerDescripcion(p.desc); if (desc) { msg += `📋 *Detalles:*\n${desc}\n\n`; }
    msg += `🤝 _Quedamos a tu entera disposición._`; 
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), '_blank');
}

function shareQuote() {
   var p = document.getElementById('desktop-cart-container');
   var cli = p.querySelector('#c-cliente').value || "Cliente";
   var tel = p.querySelector('#c-tel').value;
   var msg = `🪐 *Planet.shop by GamePlanet*\n\nHola *${cli}*, tu cotización:\n\n`;
   
   if(CART.length>0) {
       CART.forEach(x=> {
           var itemInv = D.inv.find(inv => inv.id === x.id); 
           var desc = itemInv ? itemInv.desc : (x.desc || "");
           var linkFoto = itemInv ? fixDriveLink(itemInv.foto) : "";
           
           msg+=`🛍️ *${x.cantidad}x ${x.nombre.toUpperCase()}*\n`;
           if(linkFoto && linkFoto.length>10) msg += `🖼️ Ver imagen: ${linkFoto}\n`;
           var descBonita = embellecerDescripcion(desc);
           if (descBonita) msg += `📋 *Detalles:*\n${descBonita}\n\n`; else msg += `\n`;
       });
   } else { msg+=`📦 Varios\n`; }
   
   if(p.querySelector('#c-metodo').value === "Crédito") { msg += `\n💰 Total Financiado: ${COP.format(calculatedValues.total)}\n• Inicial: ${COP.format(calculatedValues.inicial)}`; } 
   else { msg += `\n💰 Total Contado: ${COP.format(calculatedValues.total)}`; }
   
   var waUrl = "https://wa.me/";
   if(tel) { waUrl += `57${tel.replace(/\D/g,'')}`; }
   window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

// === CRUD INVENTARIO (RENDERIZADO OPTIMIZADO) ===
function agregarAlCarritoDesdeInv(id) {
    var p = D.inv.find(x => x.id === id);
    if (!p) return showToast("Producto no encontrado", "danger");
    
    var idx = CART.findIndex(x => x.id === p.id);
    if (idx > -1) { 
        CART[idx].cantidad++; 
    } else { 
        var item = Object.assign({}, p);
        item.cantidad = 1;
        item.conIva = false;
        item.modificadoManualmente = false; 
        
        if (item.publico > 0) {
            item.precioUnitarioFinal = item.publico; 
            if(item.costo > 0) {
                item.margenIndividual = ((item.publico / item.costo) - 1) * 100;
            } else {
                item.margenIndividual = 100;
            }
            item.modificadoManualmente = true; 
        } else {
            var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30;
            item.margenIndividual = globalUtil; 
            item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil/100);
        }
        
        item.descuentoIndividual = 0;
        CART.push(item); 
    }
    
    updateCartUI();
    showToast("🛒 Agregado al carrito: " + p.nombre, "success");
}

function renderInv(){ 
    var c = document.getElementById('inv-list'); 
    var q = document.getElementById('inv-search').value.toLowerCase();
    var htmlContent = '';
    
    D.inv.filter(p=> p.nombre.toLowerCase().includes(q)).slice(0,50).forEach(p=>{
        var imgHtml = p.foto ? `<img src="${fixDriveLink(p.foto)}">` : `<i class="bi bi-box-seam" style="font-size:3rem; color:#eee;"></i>`;
        var precioDisplay = p.publico > 0 ? COP.format(p.publico) : 'N/A';
        
        var btnAddCart = `<button class="btn btn-sm text-white w-100 fw-bold d-flex align-items-center justify-content-center gap-1" style="background:var(--primary); border:none;" onclick="agregarAlCarritoDesdeInv('${p.id}')"><i class="fas fa-cart-plus"></i> Añadir a Carrito</button>`;
        var btnShareNative = `<button class="btn btn-sm text-white w-100 fw-bold d-flex align-items-center justify-content-center gap-1 mt-1" style="background:#25D366; border:none;" onclick="shareProductNative('${p.id}')"><i class="fab fa-whatsapp"></i> Compartir WA</button>`;

        htmlContent += `<div class="card-catalog"><div class="cat-img-box">${imgHtml}<div class="btn-edit-float" onclick="openEdit('${p.id}')"><i class="fas fa-pencil-alt"></i></div></div><div class="cat-body"><div class="cat-title text-truncate" style="white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.nombre}</div><div class="cat-price">${precioDisplay}</div><small class="text-muted" style="font-size:0.7rem;">Costo: ${COP.format(p.costo)}</small></div><div class="p-2 bg-light border-top">${btnAddCart}${btnShareNative}</div></div>`;
    });
    
    c.innerHTML = htmlContent;
}

function abrirModalNuevo() { 
    document.getElementById('new-file-foto').value = ""; document.getElementById('img-preview-new').style.display='none';
    myModalNuevo.show(); 
}

function crearProducto() {
    if (document.activeElement) document.activeElement.blur();
    var d = { id: 'GEN-'+Date.now(), nombre: document.getElementById('new-nombre').value, categoria: document.getElementById('new-categoria').value, costo: document.getElementById('new-costo').value, publico: document.getElementById('new-publico').value, descripcion: document.getElementById('new-desc').value, proveedor: "General" };
    var f = document.getElementById('new-file-foto').files[0];
    var promise = f ? compressImage(f) : Promise.resolve(null);
    promise.then(b64 => {
        if(b64) { d.imagenBase64 = b64.split(',')[1]; d.mimeType = f.type; d.nombreArchivo = f.name; }
        callAPI('crearProductoManual', d).then(r=> { if(r.exito) { myModalNuevo.hide(); loadData(true); } });
    });
}

function openEdit(id) {
    prodEdit = D.inv.find(x=>x.id===id);
    document.getElementById('inp-edit-nombre').value = prodEdit.nombre;
    document.getElementById('inp-edit-categoria').value = prodEdit.cat;
    document.getElementById('inp-edit-costo').value = prodEdit.costo;
    document.getElementById('inp-edit-publico').value = prodEdit.publico;
    
    var m = 30;
    if(prodEdit.costo > 0 && prodEdit.publico > 0) m = ((prodEdit.publico / prodEdit.costo) - 1) * 100;
    document.getElementById('inp-edit-margen').value = m.toFixed(1);

    document.getElementById('inp-edit-desc').value = prodEdit.desc || "";
    document.getElementById('inp-file-foto').value = ""; document.getElementById('img-preview-box').style.display='none'; 
    var fixedUrl = fixDriveLink(prodEdit.foto);
    if(fixedUrl){ document.getElementById('img-preview-box').src=fixedUrl; document.getElementById('img-preview-box').style.display='block';} 
    myModalEdit.show();
}

function guardarCambiosAvanzado() {
    if (document.activeElement) document.activeElement.blur();
    var p = { id: prodEdit.id, nombre: document.getElementById('inp-edit-nombre').value, categoria: document.getElementById('inp-edit-categoria').value, costo: document.getElementById('inp-edit-costo').value, publico: document.getElementById('inp-edit-publico').value, descripcion: document.getElementById('inp-edit-desc').value, proveedor: prodEdit.prov, urlExistente: prodEdit.foto || "" };
    var f = document.getElementById('inp-file-foto').files[0];
    var promise = f ? compressImage(f) : Promise.resolve(null);
    promise.then(b64 => {
        if(b64) { p.imagenBase64 = b64.split(',')[1]; p.mimeType = f.type; p.nombreArchivo = f.name; }
        callAPI('guardarProductoAvanzado', p).then(r=> { myModalEdit.hide(); loadData(true); });
    });
}

// === CARTERA AVANZADA ===
function renderCartera() {
    var c=document.getElementById('cartera-list'); c.innerHTML='';
    var activos = D.deudores.filter(d=>d.estado!=='Castigado');
    document.getElementById('bal-cartera').innerText = COP.format(activos.reduce((a,b)=>a+b.saldo,0));
    activos.forEach(d=>{
        c.innerHTML+=`<div class="card-k card-debt border-start border-danger border-4"><div class="d-flex justify-content-between"><div><h6>${d.cliente}</h6><small>${d.producto}</small></div><div class="text-end text-danger fw-bold fs-5">${COP.format(d.saldo)}</div></div><div class="mt-2 d-flex gap-2 flex-wrap justify-content-end border-top pt-2"><button class="btn btn-xs btn-outline-success flex-fill" onclick="enviarEstadoCuentaAvanzadoWA('${d.idVenta}')"><i class="fab fa-whatsapp"></i> Estado de Cuenta</button><button class="btn btn-xs btn-outline-primary flex-fill" onclick="abrirModalRefinanciar('${d.idVenta}','${d.cliente}',${d.saldo})">🔄 Refinanciar</button> <button class="btn btn-xs btn-outline-dark flex-fill" onclick="callAPI('castigarCartera',{idVenta:'${d.idVenta}'}).then(()=>loadData(true))">☠️ Castigar</button></div></div>`;
    });
}

function enviarEstadoCuentaAvanzadoWA(idVenta) {
    var d = D.deudores.find(x => x.idVenta === idVenta); if (!d) return;
    var historial = D.historial || [];
    
    var abonosRealizados = historial.filter(h => (h.tipo === 'abono' || h.desc.includes('Inicial')) && h.desc.includes(d.cliente)).reduce((a, b) => a + b.monto, 0);
    
    var msg = `🪐 *PLANET SHOP - ESTADO DE CUENTA*\n\nHola *${d.cliente.trim()}*, este es el resumen de tu crédito:\n\n`;
    msg += `📦 *Producto:* ${d.producto}\n`;
    msg += `💰 *Valor Compra:* ${COP.format(d.saldo + abonosRealizados + (d.deudaInicial || 0))}\n`;
    msg += `✅ *Total Abonado:* ${COP.format(abonosRealizados)}\n`;
    msg += `📊 *Saldo Pendiente:* ${COP.format(d.saldo)}\n\n`;
    
    if (d.deudaInicial > 0) msg += `⚠️ *Nota:* Tienes pendiente de inicial por ${COP.format(d.deudaInicial)}\n\n`;
    if (d.valCuota > 0) msg += `💳 *Próxima Cuota:* ${COP.format(d.valCuota)}\n📅 *Vencimiento:* ${d.fechaLimite || "Inmediato"}\n\n`;
    
    msg += `🏦 *Medios de Pago:* Bancolombia, Nequi y Daviplata. Quedamos atentos a tu soporte de pago. ¡Gracias! 🤝`;
    var waUrl = "https://wa.me/" + (d.telefono ? "57"+d.telefono.replace(/\D/g,'') : "");
    window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

function abrirModalRefinanciar(id,cli,saldo){ refEditId=id; document.getElementById('ref-cliente').value=cli; document.getElementById('ref-saldo-actual').value=COP.format(saldo); myModalRefinanciar.show(); }
function procesarRefinanciamiento(){
    callAPI('refinanciarDeuda', {idVenta: refEditId, cargoAdicional: document.getElementById('ref-cargo').value, nuevasCuotas: document.getElementById('ref-cuotas').value, nuevaFecha: document.getElementById('ref-fecha').value}).then(r=>{ myModalRefinanciar.hide(); loadData(true); });
}

// === FINANZAS ===
function renderFin(){
    var s=document.getElementById('ab-cli'); s.innerHTML='<option>Seleccione...</option>';
    D.deudores.filter(d=>d.estado!=='Castigado').forEach(d=> s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} (Debe: ${COP.format(d.saldo)})</option>`);
    document.getElementById('hist-list').innerHTML = (D.historial||[]).map(x=>`<div class="d-flex justify-content-between border-bottom py-1"><div class="lh-1"><small class="fw-bold d-block">${x.desc}</small><small class="text-muted" style="font-size:0.6rem;">${x.fecha}</small></div><strong class="${x.tipo.includes('ingreso')||x.tipo.includes('abono')?'text-success':'text-danger'}">${COP.format(x.monto)}</strong></div>`).join('');
}
function doAbono(){ callAPI('registrarAbono', {idVenta: document.getElementById('ab-cli').value, monto: document.getElementById('ab-monto').value, cliente: document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text}).then(()=>loadData(true)); }
function doIngresoExtra(){ callAPI('registrarIngresoExtra', {desc: document.getElementById('inc-desc').value, cat: document.getElementById('inc-cat').value, monto: document.getElementById('inc-monto').value}).then(()=>loadData(true)); }
function doGasto(){ callAPI('registrarGasto', {desc: document.getElementById('g-desc').value, cat: document.getElementById('g-cat').value, monto: document.getElementById('g-monto').value, vinculo: document.getElementById('g-vinculo').value}).then(()=>loadData(true)); }

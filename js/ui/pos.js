import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast, fixDriveLink, getFileFromUrlAsync } from '../core.js';

export function renderPos(){
  var q = document.getElementById('pos-search').value.toLowerCase().trim();
  var c = document.getElementById('pos-list'); c.innerHTML='';
  if(!q) { document.getElementById('pos-placeholder').style.display='block'; return; }
  document.getElementById('pos-placeholder').style.display='none';

  State.data.inv.filter(p => p.nombre.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q)).slice(0,20).forEach(p => {
    var active = State.cart.some(x=>x.id===p.id) ? 'active' : '';
    c.innerHTML += `<div class="pos-row-lite ${active}" onclick="window.POS.toggleCart('${p.id}')"><div class="info"><div class="name">${p.nombre}</div><div class="meta text-muted small">${p.cat}</div></div><div class="price">${COP.format(p.publico||p.costo)}</div></div>`;
  });
}

export function toggleCart(id) {
   var p = State.data.inv.find(x => x.id === id);
   var idx = State.cart.findIndex(x=>x.id===id);
   if(idx > -1) { State.cart.splice(idx,1); } 
   else { 
       var item = Object.assign({}, p); item.cantidad = 1; item.conIva = false;
       if (item.publico > 0) { item.precioUnitarioFinal = item.publico; item.margenIndividual = item.costo > 0 ? ((item.publico/item.costo)-1)*100 : 100; item.modificadoManualmente = true; } 
       else { var gUtil = parseFloat(document.getElementById('c-util').value)||30; item.margenIndividual = gUtil; item.precioUnitarioFinal = (item.costo||0)*(1+gUtil/100); }
       item.descuentoIndividual = 0; State.cart.push(item); 
   }
   updateCartUI();
}

export function abrirModalItemManual() {
    document.getElementById('man-nombre').value = ''; document.getElementById('man-publico').value = ''; document.getElementById('man-costo').value = '';
    if(State.modals.manualItem) State.modals.manualItem.show();
}

export function confirmarItemManual() {
    var nombre = document.getElementById('man-nombre').value.trim(); if (!nombre) return alert("Ingrese el nombre del ítem.");
    var precio = parseFloat(document.getElementById('man-publico').value); if (isNaN(precio) || precio <= 0) return alert("Precio de venta inválido.");
    var costo = parseFloat(document.getElementById('man-costo').value) || 0;
    State.cart.push({ id: 'MAN-'+Date.now(), nombre: nombre, cat: 'Manual', costo: costo, publico: precio, cantidad: 1, manual: true, modificadoManualmente: true, margenIndividual: costo>0?((precio/costo)-1)*100:100, descuentoIndividual: 0, precioUnitarioFinal: precio, conIva: false });
    if(State.modals.manualItem) State.modals.manualItem.hide(); updateCartUI(); showToast("🛒 Ítem manual agregado", "success");
}

export function abrirEditorItem(id) {
    var item = State.cart.find(x => x.id === id); if (!item) return;
    document.getElementById('edit-item-id').value = item.id; document.getElementById('edit-item-nombre').value = item.nombre; document.getElementById('edit-item-costo').value = item.costo || 0;
    document.getElementById('edit-item-margen').value = item.margenIndividual.toFixed(1); document.getElementById('edit-item-desc').value = item.descuentoIndividual || 0; document.getElementById('edit-item-iva').checked = item.conIva || false;
    var pactadoEl = document.getElementById('edit-item-precio-pactado'); if (pactadoEl) pactadoEl.value = '';
    calcEditorItem(); if(State.modals.editItem) State.modals.editItem.show();
}

export function calcEditorItem() {
    var item = State.cart.find(x => x.id === document.getElementById('edit-item-id').value); if (!item) return;
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0;
    var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0;
    var descPrc = parseFloat(document.getElementById('edit-item-desc').value) || 0; 
    var iva = document.getElementById('edit-item-iva').checked;
    var precioNeto = (costo * (1 + margen/100)) * (1 - descPrc/100);
    if (precioNeto < 0) precioNeto = 0; if (iva) precioNeto *= 1.19;
    document.getElementById('edit-item-total').innerText = COP.format(Math.round(precioNeto));
}

export function aplicarPrecioPactado() {
    var costo = parseFloat(document.getElementById('edit-item-costo').value) || 0; var margen = parseFloat(document.getElementById('edit-item-margen').value) || 0; var precioPactado = parseFloat(document.getElementById('edit-item-precio-pactado').value) || 0; var iva = document.getElementById('edit-item-iva').checked;
    if (precioPactado <= 0) { document.getElementById('edit-item-desc').value = 0; calcEditorItem(); return; }
    var precioObjetivoBase = iva ? (precioPactado / 1.19) : precioPactado; var precioLista = costo * (1 + margen/100);
    if (precioLista > 0) {
        var descuentoRequeridoPrc = ((precioLista - precioObjetivoBase) / precioLista) * 100;
        if (descuentoRequeridoPrc < 0) { descuentoRequeridoPrc = 0; document.getElementById('edit-item-margen').value = (((precioObjetivoBase / costo) - 1) * 100).toFixed(1); }
        document.getElementById('edit-item-desc').value = descuentoRequeridoPrc.toFixed(2);
    }
    calcEditorItem();
}

export function guardarEditorItem() {
    var item = State.cart.find(x => x.id === document.getElementById('edit-item-id').value);
    if(item) {
        item.nombre = document.getElementById('edit-item-nombre').value; item.margenIndividual = parseFloat(document.getElementById('edit-item-margen').value) || 0; item.descuentoIndividual = parseFloat(document.getElementById('edit-item-desc').value) || 0; item.conIva = document.getElementById('edit-item-iva').checked; item.modificadoManualmente = true; 
    }
    if(State.modals.editItem) State.modals.editItem.hide(); updateCartUI();
}

export function toggleItemIva(id) { var item = State.cart.find(x => x.id === id); if (item) { item.conIva = !item.conIva; updateCartUI(); } }
export function changeQty(id, delta) { var item = State.cart.find(x => x.id === id); if (item) { item.cantidad += delta; if (item.cantidad <= 0) State.cart.splice(State.cart.findIndex(x=>x.id===id), 1); updateCartUI(true); } }

export function toggleMobileCart(forceOpen) { 
    var mc = document.getElementById('mobile-cart'); 
    if(mc) { 
        if (forceOpen === true) mc.classList.add('visible');
        else if (forceOpen === false) mc.classList.remove('visible');
        else mc.classList.toggle('visible'); 
        updateCartUI(true); 
    } 
}

export function toggleDatosFormales() {
    [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(parent => {
        if(!parent) return;
        var box = parent.querySelector('#box-datos-formales');
        if(box) { box.style.display = box.style.display === 'none' ? 'block' : 'none'; }
    });
}

window.updatePrimerPago = function() {
    [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(parent => {
        if(!parent) return;
        var fInput = parent.querySelector('#c-fecha'); var ppInput = parent.querySelector('#c-primer-pago'); var frec = parent.querySelector('#c-frecuencia');
        if(fInput && ppInput && frec) {
            var d = fInput.value ? new Date(fInput.value + "T12:00:00") : new Date();
            if(frec.value === 'Quincenal') d.setDate(d.getDate() + 15); else d.setMonth(d.getMonth() + 1);
            ppInput.value = d.toISOString().split('T')[0];
        }
    });
}

export function updateCartUI(keepOpen=false) {
   var count = State.cart.reduce((a, b) => a + (b.cantidad || 1), 0);
   var btnFloat = document.getElementById('btn-float-cart'); if(btnFloat) { btnFloat.style.display = count > 0 ? 'block' : 'none'; btnFloat.innerText = "🛒 " + count; }

   [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(p => {
       if(!p) return;
       var listContainer = p.querySelector('#cart-items-list');
       if(State.cart.length === 0) { listContainer.innerHTML = 'Vacío...'; p.querySelector('#c-concepto').style.display='block'; } 
       else { 
           p.querySelector('#c-concepto').style.display='none'; 
           listContainer.innerHTML = State.cart.map(x => {
               var px = x.precioUnitarioFinal || 0; var isLocked = x.modificadoManualmente ? `<i class="fas fa-lock text-muted" style="font-size:0.6rem;"></i>` : '';
               return `<div class="d-flex justify-content-between align-items-center mb-1 border-bottom pb-1"><div style="flex:1; min-width:0;"><small class="fw-bold text-truncate d-block">${isLocked} ${x.nombre}</small><small class="text-muted">${COP.format(px)} c/u</small></div><div class="d-flex align-items-center gap-1"><button class="btn btn-sm btn-light py-0 px-2" onclick="window.POS.abrirEditorItem('${x.id}')">✏️</button><button class="btn btn-sm ${x.conIva ? 'btn-success' : 'btn-outline-secondary'} py-0 px-1" onclick="window.POS.toggleItemIva('${x.id}')"><small>IVA</small></button><button class="btn btn-sm py-0 px-2" onclick="window.POS.changeQty('${x.id}', -1)">-</button> <b>${x.cantidad}</b> <button class="btn btn-sm py-0 px-2" onclick="window.POS.changeQty('${x.id}', 1)">+</button></div></div>`;
           }).join(''); 
       }
   });

   if(State.cart.length === 0 && !keepOpen) { var mc = document.getElementById('mobile-cart'); if(mc) mc.classList.remove('visible'); }
   calcCart();
}

// FIX: Exportación correcta para la función que causaba el fallo
export function toggleIni(element) { 
    var masterMethod = "Contado";
    if (element) {
        masterMethod = element.value;
    } else {
        var desktopSelector = document.querySelector('#desktop-cart-container #c-metodo');
        if (desktopSelector) masterMethod = desktopSelector.value;
    }

    [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(parent => {
        if(!parent) return;
        var mSelector = parent.querySelector('#c-metodo'); if(mSelector && mSelector !== element) mSelector.value = masterMethod;
        var boxVip = parent.querySelector('#box-vip'); var boxCred = parent.querySelector('#box-credito-detalles');
        
        if(masterMethod !== "Crédito") { 
            State.usuarioForzoInicial = false; 
            if(boxVip) boxVip.style.display = 'none'; if(boxCred) boxCred.style.display = 'none';
            var elEx = parent.querySelector('#c-eximir'); if(elEx) elEx.checked = false; 
        } else { 
            if(boxVip) boxVip.style.display = 'block'; 
            if(boxCred) { boxCred.style.display = 'block'; window.updatePrimerPago(); }
        }
    });
    calcCart(); 
}

export function calcCart() {
   var isMobile = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible');
   var activeParent = isMobile ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   if(!activeParent) activeParent = document.getElementById('desktop-cart-container'); 
   if(!activeParent) return;

   var targetVal = parseFloat(activeParent.querySelector('#c-target').value); var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   var cuotas = parseInt(activeParent.querySelector('#c-cuotas').value)||1; var metodo = activeParent.querySelector('#c-metodo').value;
   var conIvaGlobal = activeParent.querySelector('#c-iva') ? activeParent.querySelector('#c-iva').checked : false;
   var utilG = parseFloat(activeParent.querySelector('#c-util').value)||30; var descG = parseFloat(activeParent.querySelector('#c-desc').value)||0; 
   var intG = parseFloat(activeParent.querySelector('#c-int').value)||5; var isEximir = activeParent.querySelector('#c-eximir') ? activeParent.querySelector('#c-eximir').checked : false;
   
   var totalFinal = 0; var base = 0;
   
   if(State.cart.length>0){
       State.cart.forEach(i=>{
           let q = i.cantidad || 1;
           if(i.manual) { totalFinal += (i.precioUnitarioFinal * q); base += (i.precioUnitarioFinal * q); } 
           else {
               let m = i.modificadoManualmente ? i.margenIndividual : utilG; let dPrc = descG > 0 ? descG : (i.descuentoIndividual||0); let px = (i.costo * (1 + m/100)) * (1 - dPrc/100);
               if(px < 0) px = 0; if (i.conIva || conIvaGlobal) px *= 1.19;
               i.precioUnitarioFinal = px; totalFinal += (px * q); base += (i.costo * q);
           }
       });
   }

   if (tieneTarget) {
       totalFinal = targetVal; if(activeParent.querySelector('#c-int')) activeParent.querySelector('#c-int').value = 0; if(activeParent.querySelector('#c-desc')) activeParent.querySelector('#c-desc').value = 0;
       if (State.cart.length > 0) { let totalPrevio = State.cart.reduce((acc, b) => acc + ((b.precioUnitarioFinal||0) * b.cantidad), 0); State.cart.forEach(item => { let peso = totalPrevio > 0 ? ((item.precioUnitarioFinal||0) * item.cantidad) / totalPrevio : 1 / State.cart.length; item.precioUnitarioFinal = (targetVal * peso) / item.cantidad; }); }
   } else if (metodo === "Crédito") { 
       var iniTemp = isEximir ? 0 : (totalFinal*0.3); var saldoTemp = totalFinal - iniTemp; totalFinal += (saldoTemp * (intG/100) * cuotas); 
   }

   State.calculatedValues.total = totalFinal; State.calculatedValues.base = base;
   var inpIni = activeParent.querySelector('#c-inicial'); var activeEl = document.activeElement; var isTypingInicial = (activeEl && activeEl.id === 'c-inicial' && activeParent.contains(activeEl));
   
   var inicial = 0;
   if (isTypingInicial) {
       if (inpIni && inpIni.value === "") { State.usuarioForzoInicial = false; inicial = isEximir ? 0 : Math.round(totalFinal * 0.30); } 
       else if (inpIni) { State.usuarioForzoInicial = true; inicial = parseFloat(inpIni.value) || 0; }
   } else if (State.usuarioForzoInicial && inpIni && inpIni.value !== "") { inicial = parseFloat(inpIni.value) || 0; } 
   else { State.usuarioForzoInicial = false; inicial = isEximir ? 0 : Math.round(totalFinal * 0.30); }
   State.calculatedValues.inicial = inicial;
   
   [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(p => {
       if(!p) return;
       p.querySelector('#res-cont').innerText = COP.format(totalFinal);
       if (p !== activeParent) {
           if(p.querySelector('#c-metodo')) p.querySelector('#c-metodo').value = metodo; if(p.querySelector('#c-iva')) p.querySelector('#c-iva').checked = conIvaGlobal; if(p.querySelector('#c-eximir')) p.querySelector('#c-eximir').checked = isEximir; if(p.querySelector('#c-target') && document.activeElement !== p.querySelector('#c-target')) p.querySelector('#c-target').value = isNaN(targetVal) ? '' : targetVal; if(p.querySelector('#c-cliente') && document.activeElement !== p.querySelector('#c-cliente')) p.querySelector('#c-cliente').value = activeParent.querySelector('#c-cliente') ? activeParent.querySelector('#c-cliente').value : "";
       }
       var pInpInicial = p.querySelector('#c-inicial');
       if (p !== activeParent || !isTypingInicial) { if(pInpInicial && pInpInicial.value !== String(inicial)) { pInpInicial.value = inicial; } }

       if(metodo==="Crédito") {
           p.querySelector('#row-cred').style.display='block'; if(pInpInicial) { pInpInicial.style.display='block'; pInpInicial.disabled = false; }
           p.querySelector('#res-ini').innerText = COP.format(inicial); p.querySelector('#res-cuota-val').innerText = COP.format(Math.max(0, (totalFinal-inicial)/cuotas));
           if(p.querySelector('#res-cuota-txt')) {
               var fTexto = p.querySelector('#c-frecuencia') ? p.querySelector('#c-frecuencia').value : "Mensual";
               p.querySelector('#res-cuota-txt').innerText = ` / ${cuotas} Cuota(s) ${fTexto}`;
           }
       } else { p.querySelector('#row-cred').style.display='none'; if(pInpInicial) pInpInicial.style.display='none'; }
   });
}

export function finalizarVenta() {
   var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   var cli = parent.querySelector('#c-cliente').value; if(!cli) return alert("Falta Cliente");
   var tel = parent.querySelector('#c-tel').value || ""; var nit = parent.querySelector('#c-nit') ? parent.querySelector('#c-nit').value : "";
   if(State.calculatedValues.total <= 0) return alert("Precio inválido");
   
   var items = State.cart.length>0 ? State.cart.map(i=>({ nombre:i.nombre, cat:i.cat, costo:i.costo, precioVenta:i.precioUnitarioFinal })) : [{nombre:parent.querySelector('#c-concepto').value||"Venta", cat:"General", costo:State.calculatedValues.base, precioVenta:State.calculatedValues.total}];
   var d = { 
       items: items, cliente: cli, telefono: tel, nit: nit, 
       metodo: parent.querySelector('#c-metodo').value, 
       inicial: State.calculatedValues.inicial, 
       cuotas: parent.querySelector('#c-cuotas').value, 
       vendedor: State.currentUserAlias, 
       idCotizacion: parent.getAttribute('data-cotizacion-id'),
       frecuencia: parent.querySelector('#c-frecuencia') ? parent.querySelector('#c-frecuencia').value : "Mensual",
       primerPago: parent.querySelector('#c-primer-pago') ? parent.querySelector('#c-primer-pago').value : ""
   };
   
   showToast("⚡ Factura emitida. Sincronizando...", "info");
   clearCart();
   
   if(State.data && State.data.metricas) {
       var cash = d.metodo === 'Contado' ? State.calculatedValues.total : State.calculatedValues.inicial;
       State.data.metricas.saldo += cash;
       var elCaja = document.getElementById('bal-caja'); if(elCaja) elCaja.innerText = COP.format(State.data.metricas.saldo);
   }

   callAPI('procesarVentaCarrito', d).then(r => {
       if(r.exito) { showToast("✅ Factura guardada", "success"); if(window.App && window.App.loadData) window.App.loadData(true); } else alert(r.error);
   });
}

export function clearCart() { 
    State.cart=[]; State.usuarioForzoInicial=false; 
    [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(p=>{ 
        if(!p) return;
        var inpInicial = p.querySelector('#c-inicial'); if(inpInicial) inpInicial.value = '';
        var inpDesc = p.querySelector('#c-desc'); if(inpDesc) inpDesc.value = '0';
        var inpConcepto = p.querySelector('#c-concepto'); if(inpConcepto) inpConcepto.value = '';
        var inpEximir = p.querySelector('#c-eximir'); if(inpEximir) inpEximir.checked = false;
        var inpCli = p.querySelector('#c-cliente'); if(inpCli) inpCli.value = '';
        var inpTel = p.querySelector('#c-tel'); if(inpTel) inpTel.value = '';
        var inpFrec = p.querySelector('#c-frecuencia'); if(inpFrec) inpFrec.value = 'Mensual';
        p.removeAttribute('data-cotizacion-id');
    }); 
    updateCartUI(); 
}

function embellecerDescripcion(texto) { if (!texto) return ""; return texto.split('\n').map(l => l.trim() ? "• " + l.replace(/^[-•*🔹]\s*/, '') : "").filter(l => l !== "").join('\n'); }

export async function shareProductNative(id) {
    var loader = document.getElementById('loader'); if(loader) loader.style.display = 'flex';
    try {
        var p = State.data.inv.find(x => x.id === id); if (!p) { if(loader) loader.style.display = 'none'; return alert("Producto no encontrado"); }
        var nombre = p.nombre.toUpperCase(); var precio = p.publico > 0 ? COP.format(p.publico) : 'Consultar'; var desc = embellecerDescripcion(p.desc);
        var shareText = `🪐 *Planet.shop by GamePlanet*\n\n🛍️ *Producto:* ${nombre}\n💳 *Inversión:* ${precio}\n\n`;
        if (desc) { shareText += `📋 *Detalles:*\n${desc}\n\n`; } shareText += `🤝 _Quedamos a tu entera disposición._`;
        
        var shareData = { title: nombre, text: shareText }; var hasImage = false; var fixedUrl = fixDriveLink(p.foto);
        if (fixedUrl && fixedUrl.length > 5) { var cleanName = p.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase(); var file = await getFileFromUrlAsync(fixedUrl, cleanName); if (file) { shareData.files = [file]; hasImage = true; } }
        
        if(loader) loader.style.display = 'none';
        if (navigator.canShare && navigator.share) {
            if (hasImage && !navigator.canShare({ files: shareData.files })) delete shareData.files;
            await navigator.share(shareData); showToast("¡Compartido con éxito!", "success");
        } else shareProdWhatsApp(id);
    } catch(error) { if(loader) loader.style.display = 'none'; if (error.name !== 'AbortError') shareProdWhatsApp(id); }
}

export function shareProdWhatsApp(id) {
    var p = State.data.inv.find(x => x.id === id); if (!p) return;
    var msg = `🪐 *Planet.shop by GamePlanet*\n\n🛍️ *Producto:* ${p.nombre.toUpperCase()}\n💳 *Inversión:* ${COP.format(p.publico)}\n\n`;
    var linkFoto = fixDriveLink(p.foto); if(linkFoto && linkFoto.length > 10) { msg += `🖼️ *Imagen:* ${linkFoto}\n\n`; }
    var desc = embellecerDescripcion(p.desc); if (desc) { msg += `📋 *Detalles:*\n${desc}\n\n`; } msg += `🤝 _Quedamos a tu entera disposición._`; 
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), '_blank');
}

export function shareQuote() {
   var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   var cli = parent.querySelector('#c-cliente').value || "Cliente"; var tel = parent.querySelector('#c-tel').value;
   var msg = `🪐 *Planet.shop by GamePlanet*\n\nHola *${cli}*, tu cotización:\n\n`;
   if(State.cart.length>0) {
       State.cart.forEach(x=> {
           var itemInv = State.data.inv.find(inv => inv.id === x.id); var desc = itemInv ? itemInv.desc : (x.desc || ""); var linkFoto = itemInv ? fixDriveLink(itemInv.foto) : "";
           msg+=`🛍️ *${x.cantidad}x ${x.nombre.toUpperCase()}*\n`; if(linkFoto && linkFoto.length>10) msg += `🖼️ Ver imagen: ${linkFoto}\n`;
           var descBonita = embellecerDescripcion(desc); if (descBonita) msg += `📋 *Detalles:*\n${descBonita}\n\n`; else msg += `\n`;
       });
   } else msg+=`📦 Varios\n`;
   if(parent.querySelector('#c-metodo').value === "Crédito") msg += `\n💰 Total Financiado: ${COP.format(State.calculatedValues.total)}\n• Inicial: ${COP.format(State.calculatedValues.inicial)}`; 
   else msg += `\n💰 Total Contado: ${COP.format(State.calculatedValues.total)}`;
   window.open("https://wa.me/" + (tel ? "57"+tel.replace(/\D/g,'') : "") + "?text=" + encodeURIComponent(msg), '_blank');
}

export function compartirNequi() {
    var msg = `🪐 *Planet.shop by GamePlanet*\n\nHola! Te comparto nuestra cuenta autorizada para pagos:\n\n🟣 *Nequi:* 3003303568\n\nPor favor, envíanos el comprobante por este medio una vez realizada la transferencia. ¡Gracias! 🤝`;
    var activeParent = window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible') ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
    var tel = activeParent ? activeParent.querySelector('#c-tel').value : "";
    var waUrl = "https://wa.me/" + (tel ? "57"+tel.replace(/\D/g,'') : ""); 
    window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

export function agregarAlCarritoDesdeInv(id) {
    var p = State.data.inv.find(x => x.id === id); if (!p) return showToast("Producto no encontrado", "danger");
    var idx = State.cart.findIndex(x => x.id === p.id);
    if (idx > -1) { State.cart[idx].cantidad++; } else { 
        var item = Object.assign({}, p); item.cantidad = 1; item.conIva = false; item.modificadoManualmente = false; 
        if (item.publico > 0) { item.precioUnitarioFinal = item.publico; item.margenIndividual = item.costo > 0 ? ((item.publico / item.costo) - 1) * 100 : 100; item.modificadoManualmente = true; } 
        else { var globalUtil = parseFloat(document.getElementById('c-util') ? document.getElementById('c-util').value : 30) || 30; item.margenIndividual = globalUtil; item.precioUnitarioFinal = (item.costo || 0) * (1 + globalUtil/100); }
        item.descuentoIndividual = 0; State.cart.push(item); 
    }
    updateCartUI(); showToast("🛒 Agregado al carrito: " + p.nombre, "success");
}

export function guardarCotizacionActual() {
    var desktopCart = document.getElementById('desktop-cart-container'); var mobileCart = document.getElementById('mobile-cart');
    var cliDesktop = desktopCart ? desktopCart.querySelector('#c-cliente').value : ""; var cliMobile = mobileCart ? mobileCart.querySelector('#c-cliente').value : "";
    var cli = cliDesktop || cliMobile; if(!cli) return alert("Falta Cliente para guardar la cotización");
    var parent = (window.innerWidth < 992 && mobileCart && mobileCart.classList.contains('visible')) ? mobileCart : desktopCart;
    if(!parent) return; if(State.cart.length === 0 && !parent.querySelector('#c-concepto').value && State.calculatedValues.total <= 0) return alert("El carrito está vacío");

    var idGenerado = parent.getAttribute('data-cotizacion-id') || ('COT-' + Date.now());
    var paquete = { id: idGenerado, fecha: parent.querySelector('#c-fecha').value || new Date().toISOString().split('T')[0], cliente: cli, nit: parent.querySelector('#c-nit') ? parent.querySelector('#c-nit').value : '', tel: parent.querySelector('#c-tel') ? parent.querySelector('#c-tel').value : '', metodo: parent.querySelector('#c-metodo').value, cuotas: parent.querySelector('#c-cuotas').value, iva: parent.querySelector('#c-iva').checked, util: parent.querySelector('#c-util').value, desc: parent.querySelector('#c-desc').value, int: parent.querySelector('#c-int').value, target: parent.querySelector('#c-target').value, concepto: parent.querySelector('#c-concepto').value, eximir: parent.querySelector('#c-eximir') ? parent.querySelector('#c-eximir').checked : false, inicialPersonalizada: State.usuarioForzoInicial, cart: JSON.parse(JSON.stringify(State.cart)), total: State.calculatedValues.total };
    var idx = State.data.cotizaciones.findIndex(x => x.id === idGenerado); if(idx > -1) { State.data.cotizaciones[idx] = paquete; } else { State.data.cotizaciones.unshift(paquete); }
    showToast("Cotización guardada", "success"); clearCart(); callAPI('guardarCotizacion', paquete);
}

export function abrirModalCotizaciones() { renderCotizaciones(); if(State.modals.cotizaciones) State.modals.cotizaciones.show(); }

export function renderCotizaciones() {
    var c = document.getElementById('cotizaciones-list'); if(!c) return; c.innerHTML = '';
    var activas = State.data.cotizaciones.filter(x => x.estado !== 'Facturada');
    if(activas.length === 0) { c.innerHTML = '<div class="text-center text-muted p-4">No hay cotizaciones pendientes</div>'; return; }
    activas.forEach(cot => {
        c.innerHTML += `<div class="card-k mb-2 border-start border-4 border-info bg-white shadow-sm p-3"><div class="d-flex justify-content-between align-items-center"><div style="flex:1; min-width:0;"><strong class="text-primary text-truncate d-block">${cot.cliente}</strong><small class="text-muted d-block">${cot.fecha} | Total: <strong class="text-dark">${COP.format(cot.total)}</strong></small><small class="text-secondary">${cot.cart.length} Item(s) | ${cot.metodo}</small></div><div class="d-flex flex-column gap-2 ms-2"><button class="btn btn-sm btn-primary fw-bold" onclick="window.POS.cargarCotizacion('${cot.id}')">✏️ Retomar</button><button class="btn btn-sm btn-outline-danger" onclick="window.POS.eliminarCotizacion('${cot.id}')">🗑️ Eliminar</button></div></div></div>`;
    });
}

export function cargarCotizacion(id) {
    var cot = State.data.cotizaciones.find(x => x.id === id); if(!cot) return;
    State.cart = JSON.parse(JSON.stringify(cot.cart)); State.usuarioForzoInicial = cot.inicialPersonalizada || false;
    [document.getElementById('desktop-cart-container'), document.getElementById('mobile-cart')].forEach(parent => {
        if(!parent) return;
        if(parent.querySelector('#c-cliente')) parent.querySelector('#c-cliente').value = cot.cliente || ''; if(parent.querySelector('#c-nit')) parent.querySelector('#c-nit').value = cot.nit || ''; if(parent.querySelector('#c-tel')) parent.querySelector('#c-tel').value = cot.tel || ''; if(parent.querySelector('#c-fecha')) parent.querySelector('#c-fecha').value = cot.fecha || ''; if(parent.querySelector('#c-metodo')) parent.querySelector('#c-metodo').value = cot.metodo || 'Contado'; if(parent.querySelector('#c-cuotas')) parent.querySelector('#c-cuotas').value = cot.cuotas || 1; if(parent.querySelector('#c-iva')) parent.querySelector('#c-iva').checked = cot.iva || false; if(parent.querySelector('#c-util')) parent.querySelector('#c-util').value = cot.util || 30; if(parent.querySelector('#c-desc')) parent.querySelector('#c-desc').value = cot.desc || 0; if(parent.querySelector('#c-int')) parent.querySelector('#c-int').value = cot.int || 5; if(parent.querySelector('#c-target')) parent.querySelector('#c-target').value = cot.target || ''; if(parent.querySelector('#c-concepto')) parent.querySelector('#c-concepto').value = cot.concepto || ''; if(parent.querySelector('#c-eximir')) parent.querySelector('#c-eximir').checked = cot.eximir || false;
        parent.setAttribute('data-cotizacion-id', id);
    });
    if(State.modals.cotizaciones) State.modals.cotizaciones.hide(); showToast("Cotización cargada", "info"); updateCartUI(true);
}

export function eliminarCotizacion(id) { if(!confirm("¿Eliminar cotización?")) return; State.data.cotizaciones = State.data.cotizaciones.filter(x => x.id !== id); renderCotizaciones(); callAPI('eliminarCotizacion', id); }

export function generarCotizacionPDF() {
   var parent = (window.innerWidth < 992 && document.getElementById('mobile-cart').classList.contains('visible')) ? document.getElementById('mobile-cart') : document.getElementById('desktop-cart-container');
   var cli = parent.querySelector('#c-cliente').value; if(!cli) return alert("Falta Cliente para PDF");
   var nit = parent.querySelector('#c-nit') ? parent.querySelector('#c-nit').value : ''; var tel = parent.querySelector('#c-tel') ? parent.querySelector('#c-tel').value : '';
   var conIvaGlobal = parent.querySelector('#c-iva').checked; var targetVal = parseFloat(parent.querySelector('#c-target').value); var tieneTarget = !isNaN(targetVal) && targetVal > 0;
   
   if(State.calculatedValues.total <= 0 && State.calculatedValues.base <= 0) return alert("El precio total no puede ser 0");
   var itemsData = []; var subtotalBaseCotizacion = 0;
   if(State.cart.length > 0) {
       State.cart.forEach(p => { var qty = p.cantidad || 1; var unitPrice = p.precioUnitarioFinal || 0; var totalItem = unitPrice * qty; subtotalBaseCotizacion += totalItem; itemsData.push({ nombre: p.nombre, descripcion: p.desc ? p.desc : p.cat, cantidad: qty, valorUnitarioBase: unitPrice, descuentoPrc: 0, descuentoUnitario: 0, valorUnitarioFinal: unitPrice, total: totalItem, conIva: p.conIva || conIvaGlobal }); });
   } else {
       var manualVal = tieneTarget ? targetVal : State.calculatedValues.base; subtotalBaseCotizacion = manualVal; itemsData.push({ nombre: parent.querySelector('#c-concepto').value || "Venta Manual", descripcion: "Servicio Manual", cantidad: 1, valorUnitarioBase: manualVal, descuentoPrc: 0, descuentoUnitario: 0, valorUnitarioFinal: manualVal, total: manualVal, conIva: conIvaGlobal && !tieneTarget });
   }
   var d = { cliente: { nombre: cli, nit: nit, telefono: tel }, items: itemsData, totales: { subtotal: subtotalBaseCotizacion, descuento: 0, iva: 0, total: State.calculatedValues.total }, fecha: parent.querySelector('#c-fecha').value };
   document.getElementById('loader').style.display='flex';
   callAPI('generarCotizacionPDF', d).then(r => { document.getElementById('loader').style.display='none'; if(r.exito) { window.open(r.url, '_blank'); } else { alert("Error PDF: " + r.error); } });
}

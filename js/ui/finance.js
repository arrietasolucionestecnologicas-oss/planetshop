import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast } from '../core.js';

let isProcessing = false;

export function renderCartera() {
    var c=document.getElementById('cartera-list'); c.innerHTML='';
    var activos = State.data.deudores.filter(d=>d.estado!=='Castigado');
    document.getElementById('bal-cartera').innerText = COP.format(activos.reduce((a,b)=>a+b.saldo,0));
    activos.forEach(d=>{ c.innerHTML+=`<div class="card-k card-debt border-start border-danger border-4"><div class="d-flex justify-content-between"><div><h6 style="color:var(--primary); font-weight:bold;">${d.cliente}</h6><small>${d.producto}</small></div><div class="text-end text-danger fw-bold fs-5">${COP.format(d.saldo)}</div></div><div class="mt-2 d-flex gap-2 flex-wrap justify-content-end border-top pt-2"><button class="btn btn-xs flex-fill text-white" style="background:#38a169; border:none;" onclick="window.Finance.enviarEstadoCuentaAvanzadoWA('${d.idVenta}')"><i class="fab fa-whatsapp"></i> Estado de Cuenta</button><button class="btn btn-xs btn-outline-primary flex-fill" onclick="window.Finance.abrirModalRefinanciar('${d.idVenta}','${d.cliente}',${d.saldo})">🔄 Refinanciar</button> <button class="btn btn-xs btn-outline-dark flex-fill" onclick="window.Finance.castigarDeuda('${d.idVenta}')">☠️ Castigar</button></div></div>`; });
}

export function enviarEstadoCuentaAvanzadoWA(idVenta) {
    var d = State.data.deudores.find(x => x.idVenta === idVenta); if (!d) return;
    var historial = State.data.historial || [];
    var abonosRealizados = historial.filter(h => (h.tipo === 'abono' || h.desc.includes('Inicial')) && h.desc.includes(d.cliente)).reduce((a, b) => a + b.monto, 0);
    var msg = `🪐 *PLANET SHOP - ESTADO DE CUENTA*\n\nHola *${d.cliente.trim()}*, este es el resumen de tu crédito:\n\n📦 *Producto:* ${d.producto}\n💰 *Valor Compra:* ${COP.format(d.saldo + abonosRealizados + (d.deudaInicial || 0))}\n✅ *Total Abonado:* ${COP.format(abonosRealizados)}\n📊 *Saldo Pendiente:* ${COP.format(d.saldo)}\n\n`;
    if (d.deudaInicial > 0) msg += `⚠️ *Nota:* Tienes pendiente de inicial por ${COP.format(d.deudaInicial)}\n\n`;
    if (d.valCuota > 0) msg += `💳 *Próxima Cuota:* ${COP.format(d.valCuota)}\n📅 *Vencimiento:* ${d.fechaLimite || "Inmediato"}\n\n`;
    msg += `🏦 *Medios de Pago:* Bancolombia, Nequi y Daviplata. Quedamos atentos a tu soporte de pago. ¡Gracias! 🤝`;
    var waUrl = "https://wa.me/" + (d.telefono ? "57"+d.telefono.replace(/\D/g,'') : ""); window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

export function abrirModalRefinanciar(id,cli,saldo){ 
    State.refEditId=id; document.getElementById('ref-cliente').value=cli; document.getElementById('ref-saldo-actual').value=COP.format(saldo); 
    if(State.modals.refinanciar) State.modals.refinanciar.show(); 
}

export function procesarRefinanciamiento(){ 
    if (isProcessing) return;
    var idVenta = State.refEditId;
    var d = {idVenta: idVenta, cargoAdicional: document.getElementById('ref-cargo').value, nuevasCuotas: document.getElementById('ref-cuotas').value, nuevaFecha: document.getElementById('ref-fecha').value};
    
    isProcessing = true;
    var btn = document.activeElement; var oTxt = "";
    if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; btn.disabled = true; }

    if(State.modals.refinanciar) State.modals.refinanciar.hide(); 
    showToast("⚡ Procesando refinanciación...", "info");
    callAPI('refinanciarDeuda', d).then(r=>{ 
        if(window.App && window.App.loadData) window.App.loadData(true); 
        showToast("✅ Deuda reestructurada", "success");
    }).finally(() => {
        isProcessing = false;
        if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
    }); 
}

export function castigarDeuda(idVenta) {
    if (isProcessing) return;
    if(confirm("¿Seguro que deseas castigar esta deuda?")) {
        isProcessing = true;
        var btn = document.activeElement; var oTxt = "";
        if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '☠️...'; btn.disabled = true; }

        callAPI('castigarCartera',{idVenta: idVenta}).then(()=> { 
            if(window.App && window.App.loadData) window.App.loadData(true); 
        }).finally(() => {
            isProcessing = false;
            if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
        });
    }
}

export function renderFin(){
    var s=document.getElementById('ab-cli'); s.innerHTML='<option>Seleccione...</option>';
    var cuentasCobrar = 0;
    State.data.deudores.filter(d=>d.estado!=='Castigado').forEach(d=> { cuentasCobrar += d.saldo; s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} (Debe: ${COP.format(d.saldo)})</option>`; });
    
    document.getElementById('hist-list').innerHTML = (State.data.historial||[]).map(x=>`<div class="d-flex justify-content-between border-bottom py-1"><div class="lh-1"><small class="fw-bold d-block">${x.desc}</small><small class="text-muted" style="font-size:0.6rem;">${x.fecha}</small></div><strong class="${x.tipo.includes('ingreso')||x.tipo.includes('abono')?'text-success':'text-danger'}">${COP.format(x.monto)}</strong></div>`).join('');
    
    var invCosto = State.data.inv.reduce((a,b) => a + (b.costo || 0), 0);
    var cajaActual = (State.data.metricas && State.data.metricas.saldo) ? State.data.metricas.saldo : 0;
    var pasivos = State.data.pasivos.reduce((a,b) => a + (b.saldo || 0), 0);
    
    var patrimonio = cajaActual + cuentasCobrar + invCosto - pasivos;
    var elPatrimonio = document.getElementById('bal-patrimonio');
    if(elPatrimonio) elPatrimonio.innerText = COP.format(patrimonio);
}

export function doAbono(){ 
    if (isProcessing) return;
    var cli = document.getElementById('ab-cli').value;
    var monto = parseFloat(document.getElementById('ab-monto').value);
    if(!cli || isNaN(monto) || monto <= 0) return;
    var d = {idVenta: cli, monto: monto, cliente: document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text};
    
    isProcessing = true;
    var btn = document.activeElement; var oTxt = "";
    if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; btn.disabled = true; }

    document.getElementById('ab-monto').value = ''; document.getElementById('ab-fecha').value = '';
    showToast("⚡ Recaudando dinero...", "info");
    if(State.data && State.data.metricas) { State.data.metricas.saldo += monto; var elCaja = document.getElementById('bal-caja'); if(elCaja) elCaja.innerText = COP.format(State.data.metricas.saldo); }
    callAPI('registrarAbono', d).then(()=>{ 
        showToast("✅ Abono procesado", "success"); 
        if(window.App && window.App.loadData) window.App.loadData(true); 
    }).finally(() => {
        isProcessing = false;
        if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
    }); 
}

export function doIngresoExtra(){ 
    if (isProcessing) return;
    var desc = document.getElementById('inc-desc').value;
    var cat = document.getElementById('inc-cat').value;
    var monto = parseFloat(document.getElementById('inc-monto').value);
    if(!desc || isNaN(monto) || monto <= 0) return;
    var d = {desc: desc, cat: cat, monto: monto};
    
    isProcessing = true;
    var btn = document.activeElement; var oTxt = "";
    if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; btn.disabled = true; }

    document.getElementById('inc-desc').value = ''; document.getElementById('inc-monto').value = '';
    showToast("⚡ Registrando ingreso...", "info");
    if(State.data && State.data.metricas) { State.data.metricas.saldo += monto; var elCaja = document.getElementById('bal-caja'); if(elCaja) elCaja.innerText = COP.format(State.data.metricas.saldo); }
    callAPI('registrarIngresoExtra', d).then(()=>{ 
        showToast("✅ Ingreso procesado", "success"); 
        if(window.App && window.App.loadData) window.App.loadData(true); 
    }).finally(() => {
        isProcessing = false;
        if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
    }); 
}

export function doGasto(){ 
    if (isProcessing) return;
    var desc = document.getElementById('g-desc').value;
    var cat = document.getElementById('g-cat').value;
    var monto = parseFloat(document.getElementById('g-monto').value);
    var vinculo = document.getElementById('g-vinculo').value;
    if(!desc || isNaN(monto) || monto <= 0) return;
    var d = {desc: desc, cat: cat, monto: monto, vinculo: vinculo};
    
    isProcessing = true;
    var btn = document.activeElement; var oTxt = "";
    if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; btn.disabled = true; }

    document.getElementById('g-desc').value = ''; document.getElementById('g-monto').value = ''; document.getElementById('g-vinculo').value = '';
    showToast("⚡ Registrando egreso...", "info");
    if(State.data && State.data.metricas) { State.data.metricas.saldo -= monto; var elCaja = document.getElementById('bal-caja'); if(elCaja) elCaja.innerText = COP.format(State.data.metricas.saldo); }
    callAPI('registrarGasto', d).then(()=>{ 
        showToast("✅ Egreso procesado", "success"); 
        if(window.App && window.App.loadData) window.App.loadData(true); 
    }).finally(() => {
        isProcessing = false;
        if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
    }); 
}

export function abrirModalPasivos() { alert("Módulo de pasivos en construcción."); }

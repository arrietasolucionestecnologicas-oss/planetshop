import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast } from '../core.js';

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
    callAPI('refinanciarDeuda', {idVenta: State.refEditId, cargoAdicional: document.getElementById('ref-cargo').value, nuevasCuotas: document.getElementById('ref-cuotas').value, nuevaFecha: document.getElementById('ref-fecha').value}).then(r=>{ 
        if(State.modals.refinanciar) State.modals.refinanciar.hide(); 
        if(window.App && window.App.loadData) window.App.loadData(true); 
    }); 
}

export function castigarDeuda(idVenta) {
    if(confirm("¿Seguro que deseas castigar esta deuda?")) {
        callAPI('castigarCartera',{idVenta: idVenta}).then(()=> { if(window.App && window.App.loadData) window.App.loadData(true); });
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

export function doAbono(){ callAPI('registrarAbono', {idVenta: document.getElementById('ab-cli').value, monto: document.getElementById('ab-monto').value, cliente: document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text}).then(()=>{ if(window.App && window.App.loadData) window.App.loadData(true); }); }
export function doIngresoExtra(){ callAPI('registrarIngresoExtra', {desc: document.getElementById('inc-desc').value, cat: document.getElementById('inc-cat').value, monto: document.getElementById('inc-monto').value}).then(()=>{ if(window.App && window.App.loadData) window.App.loadData(true); }); }
export function doGasto(){ callAPI('registrarGasto', {desc: document.getElementById('g-desc').value, cat: document.getElementById('g-cat').value, monto: document.getElementById('g-monto').value, vinculo: document.getElementById('g-vinculo').value}).then(()=>{ if(window.App && window.App.loadData) window.App.loadData(true); }); }
export function abrirModalPasivos() { alert("Módulo de pasivos en construcción."); }

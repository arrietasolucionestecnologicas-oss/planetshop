import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast } from '../core.js';

let isProcessing = false;

export function renderCartera() {
    var c=document.getElementById('cartera-list'); c.innerHTML='';
    var activos = State.data.deudores.filter(d=>d.estado!=='Castigado');
    document.getElementById('bal-cartera').innerText = COP.format(activos.reduce((a,b)=>a+b.saldo,0));
    activos.forEach(d=>{ 
        c.innerHTML+=`<div class="card-k card-debt border-start border-danger border-4">
            <div class="d-flex justify-content-between">
                <div>
                    <h6 style="color:var(--primary); font-weight:bold;">${d.cliente}</h6>
                    <small>${d.producto}</small>
                </div>
                <div class="text-end text-danger fw-bold fs-5">${COP.format(d.saldo)}</div>
            </div>
            <div class="mt-2 d-flex gap-2 flex-wrap justify-content-end border-top pt-2">
                <button class="btn btn-xs btn-outline-dark flex-fill fw-bold" onclick="window.Finance.abrirRadiografia('${d.idVenta}')" title="Ver Radiografía Financiera"><i class="fas fa-microscope"></i> Detalles</button>
                <button class="btn btn-xs flex-fill text-white" style="background:#38a169; border:none;" onclick="window.Finance.enviarEstadoCuentaAvanzadoWA('${d.idVenta}')"><i class="fab fa-whatsapp"></i> Estado de Cuenta</button>
                <button class="btn btn-xs btn-outline-primary flex-fill" onclick="window.Finance.abrirModalRefinanciar('${d.idVenta}','${d.cliente}',${d.saldo})">🔄 Refinanciar</button> 
                <button class="btn btn-xs btn-outline-danger flex-fill" onclick="window.Finance.castigarDeuda('${d.idVenta}')">☠️ Castigar</button>
            </div>
        </div>`; 
    });
}

export function abrirRadiografia(idVenta) {
    var v = State.data.deudores.find(x => x.idVenta === idVenta);
    if(!v) return showToast("No se encontraron detalles ampliados.", "error");
    
    var safeNum = function(val) {
        if (val === undefined || val === null || val === '') return 0;
        var parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    };
    
    document.getElementById('rad-id').innerText = v.idVenta;
    document.getElementById('rad-fecha').innerText = v.fechaStr || v.fechaLimite || "Sin fecha";
    document.getElementById('rad-cliente').innerText = v.cliente;
    document.getElementById('rad-prod').innerText = v.producto;
    
    var totalEstimado = v.saldo + (v.deudaInicial || 0);
    document.getElementById('rad-total').innerText = COP.format(safeNum(totalEstimado));
    document.getElementById('rad-metodo').innerText = "CRÉDITO";
    document.getElementById('rad-costo').innerText = "Confidencial";
    document.getElementById('rad-ganancia').innerText = "Confidencial";
    
    document.querySelectorAll('.rad-secret').forEach(e => e.classList.remove('revealed'));
    document.getElementById('rad-vendedor').innerText = v.vendedor || "Sistema";
    
    var boxDeuda = document.getElementById('box-deuda');
    if (v.estado === 'Pagado') {
        boxDeuda.style.borderColor = '#2ecc71';
        document.getElementById('rad-saldo').innerText = 'PAZ Y SALVO';
        document.getElementById('rad-saldo').className = 'rad-val text-success';
        document.getElementById('rad-plan').innerText = `Inicial Faltante: ${COP.format(safeNum(v.deudaInicial))}`;
    } else {
        boxDeuda.style.borderColor = '#e74c3c';
        document.getElementById('rad-saldo').innerText = COP.format(safeNum(v.saldo));
        document.getElementById('rad-saldo').className = 'rad-val text-danger';
        var cuotas = parseInt(v.cuotas) || 1;
        var cuotaTxt = cuotas > 1 ? `${cuotas} cuotas de ${COP.format(safeNum(v.valCuota))}` : `Pago único pendiente`;
        document.getElementById('rad-plan').innerText = `Inicial: ${COP.format(safeNum(v.deudaInicial))} | ${cuotaTxt}`;
    }

    var btnAnular = document.getElementById('btn-anular-venta');
    if(btnAnular) btnAnular.style.display = 'block';
    
    if(!State.modals.radiografia) State.modals.radiografia = new bootstrap.Modal(document.getElementById('modalRadiografia'));
    State.modals.radiografia.show();
}

export function revelarSecretos() {
    document.querySelectorAll('.rad-secret').forEach(e => e.classList.toggle('revealed'));
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
    var d = {idVenta: idVenta, cargoAdicional: document.getElementById('ref-cargo').value, nuevasCuotas: document.getElementById('ref-cuotas').value, nuevaFecha: document.getElementById('ref-fecha').value, aliasOperador: localStorage.getItem("alias") || "Sistema"};
    
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

        callAPI('castigarCartera',{idVenta: idVenta, aliasOperador: localStorage.getItem("alias") || "Sistema"}).then(()=> { 
            if(window.App && window.App.loadData) window.App.loadData(true); 
        }).finally(() => {
            isProcessing = false;
            if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
        });
    }
}

export function anularVenta(idVenta) {
    if (isProcessing) return;
    if(typeof Swal === 'undefined') return alert("Librería de alertas no cargada");

    if(State.modals.radiografia) State.modals.radiografia.hide();

    Swal.fire({
        title: '☠️ Anular Venta Completa',
        html: `Esta acción es irreversible. Se revertirán los saldos de caja, la cartera y se borrará del BI.<br><br>
               <input id="anul-just" class="swal2-input w-100 m-0 mt-3" placeholder="Justificación (Mín. 10 letras)...">`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#e53e3e',
        cancelButtonColor: '#a0aec0',
        confirmButtonText: 'Ejecutar Anulación',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const val = document.getElementById('anul-just').value.trim();
            if (val.length < 10) {
                Swal.showValidationMessage('La justificación debe tener al menos 10 caracteres.');
            }
            return val;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            isProcessing = true;
            Swal.fire({ title: 'Sanitizando Contabilidad...', text: 'Reescribiendo saldos en la Nube', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            
            callAPI('anularVentaBackend', { idVenta: idVenta, justificacion: result.value, aliasOperador: localStorage.getItem("alias") || "Sistema" }).then(r => {
                if(r.exito) {
                    Swal.fire('¡Venta Anulada!', 'El Rollback contable se ha completado.', 'success').then(() => {
                        if(window.App && window.App.loadData) window.App.loadData(true);
                    });
                } else {
                    Swal.fire('Error', r.error, 'error');
                }
            }).finally(() => {
                isProcessing = false;
            });
        } else {
            if(State.modals.radiografia) State.modals.radiografia.show();
        }
    });
}

export function renderFin(){
    var s=document.getElementById('ab-cli'); s.innerHTML='<option>Seleccione...</option>';
    var cuentasCobrar = 0;
    State.data.deudores.filter(d=>d.estado!=='Castigado').forEach(d=> { cuentasCobrar += d.saldo; s.innerHTML+=`<option value="${d.idVenta}">${d.cliente} (Debe: ${COP.format(d.saldo)})</option>`; });
    
    var searchEl = document.getElementById('hist-search');
    var q = searchEl ? searchEl.value.toLowerCase().trim() : "";
    var dataHist = State.data.historial || [];
    
    dataHist.forEach((x, index) => x._originalIndex = index);
    if(q) dataHist = dataHist.filter(x => (x.desc && x.desc.toLowerCase().includes(q)) || (x.monto && x.monto.toString().includes(q)));

    document.getElementById('hist-list').innerHTML = dataHist.map(x=>{
        var i = (x.tipo.includes('ingreso')||x.tipo.includes('abono'));
        var btnEdit = `<button class="btn btn-sm btn-light border-0 text-muted p-1 ms-2" onclick="window.Finance.abrirEditMov(${x._originalIndex})" title="Corregir Movimiento"><i class="fas fa-pencil-alt"></i></button>`;
        return `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><div class="lh-1"><small class="fw-bold d-block">${x.desc}</small><small class="text-muted" style="font-size:0.6rem;">${x.fecha}</small></div><div class="text-end"><strong class="${i?'text-success':'text-danger'}">${i?'+':'-'} ${COP.format(x.monto)}</strong>${btnEdit}</div></div>`;
    }).join('');
    
    var invCosto = State.data.inv.reduce((a,b) => a + (b.costo || 0), 0);
    var cajaActual = (State.data.metricas && State.data.metricas.saldo) ? State.data.metricas.saldo : 0;
    var pasivos = State.data.pasivos.reduce((a,b) => a + (b.saldo || 0), 0);
    
    var patrimonio = cajaActual + cuentasCobrar + invCosto - pasivos;
    var elPatrimonio = document.getElementById('bal-patrimonio');
    if(elPatrimonio) elPatrimonio.innerText = COP.format(patrimonio);
}

export function abrirEditMov(index) {
    if (!State.data.historial[index]) return;
    State.movEditObj = State.data.historial[index]; 
    
    document.getElementById('ed-mov-desc').value = State.movEditObj.desc;
    document.getElementById('ed-mov-monto').value = State.movEditObj.monto;
    var elJust = document.getElementById('ed-mov-justificacion');
    if(elJust) elJust.value = ""; 
    
    var fechaRaw = String(State.movEditObj.fecha);
    var fechaIso = "";
    if(fechaRaw.includes('/')) { 
        var parts = fechaRaw.split('/'); 
        if(parts.length === 3) fechaIso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`; 
    } else { 
        fechaIso = fechaRaw.split(' ')[0]; 
    }
    
    document.getElementById('ed-mov-fecha').value = fechaIso;
    
    if(!State.modals.editMov) State.modals.editMov = new bootstrap.Modal(document.getElementById('modalEditMov'));
    State.modals.editMov.show();
}

export function guardarEdicionMovimiento() {
    if (isProcessing) return;
    if(!State.movEditObj) return;
    
    var nuevaFecha = document.getElementById('ed-mov-fecha').value;
    var nuevoMonto = document.getElementById('ed-mov-monto').value;
    var justificacion = document.getElementById('ed-mov-justificacion').value.trim();
    
    if(!nuevaFecha || !nuevoMonto) return alert("Fecha y monto requeridos");
    if(justificacion.length < 5) return alert("⚠️ Debe escribir una justificación válida para la auditoría contable.");
    
    isProcessing = true;
    var btn = document.activeElement; var oTxt = "";
    if(btn && btn.tagName === 'BUTTON') { oTxt = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; btn.disabled = true; }

    var originalClone = Object.assign({}, State.movEditObj);
    var payload = { original: originalClone, fecha: nuevaFecha, monto: nuevoMonto, justificacion: justificacion, aliasOperador: localStorage.getItem("alias") || "Sistema" };
    
    if(State.modals.editMov) State.modals.editMov.hide();
    showToast("⚡ Aplicando ajuste contable...", "info");
    
    callAPI('editarMovimiento', payload).then(r => { 
        if(r.exito) {
            showToast("✅ Contabilidad reestructurada", "success");
            if(window.App && window.App.loadData) window.App.loadData(true); 
        } else { 
            alert("Error crítico: " + r.error); 
        } 
    }).finally(() => {
        isProcessing = false;
        if(btn && btn.tagName === 'BUTTON') { btn.innerHTML = oTxt; btn.disabled = false; }
    });
}

export function doAbono(){ 
    if (isProcessing) return;
    var cli = document.getElementById('ab-cli').value;
    var monto = parseFloat(document.getElementById('ab-monto').value);
    if(!cli || isNaN(monto) || monto <= 0) return;
    var d = {idVenta: cli, monto: monto, cliente: document.getElementById('ab-cli').options[document.getElementById('ab-cli').selectedIndex].text, aliasOperador: localStorage.getItem("alias") || "Sistema"};
    
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
    var d = {desc: desc, cat: cat, monto: monto, aliasOperador: localStorage.getItem("alias") || "Sistema"};
    
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
    var d = {desc: desc, cat: cat, monto: monto, vinculo: vinculo, aliasOperador: localStorage.getItem("alias") || "Sistema"};
    
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

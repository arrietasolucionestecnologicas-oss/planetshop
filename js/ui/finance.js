import { State } from '../state.js';
import { callAPI } from '../api.js';
import { COP, showToast } from '../core.js';

let isProcessing = false;

export function renderCartera() {
    var c = document.getElementById('cartera-list'); 
    if (!c) return;
    c.innerHTML = '';
    
    var activos = State.data.deudores.filter(d => d.estado !== 'Castigado');
    
    // Filtro de búsqueda en tiempo real
    var searchEl = document.getElementById('cartera-search');
    var q = searchEl ? searchEl.value.toLowerCase().trim() : "";
    var filtrados = activos;
    
    if (q) {
        filtrados = activos.filter(d => 
            (d.cliente && d.cliente.toLowerCase().includes(q)) || 
            (d.producto && d.producto.toLowerCase().includes(q)) ||
            (d.idVenta && d.idVenta.toLowerCase().includes(q))
        );
    }

    document.getElementById('bal-cartera').innerText = COP.format(activos.reduce((a, b) => a + b.saldo, 0));
    
    if (filtrados.length === 0) {
        c.innerHTML = '<div class="text-center text-muted py-4">No hay deudas que coincidan con la búsqueda.</div>';
        return;
    }

    filtrados.forEach(d => { 
        c.innerHTML += `
        <div class="card-k card-debt border-start border-danger border-4">
            <div class="d-flex justify-content-between">
                <div>
                    <h6 style="color:var(--primary); font-weight:bold;">${d.cliente}</h6>
                    <small class="text-muted">${d.idVenta} | ${d.producto}</small>
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
    var v = State.data.deudores.find(x => x.idVenta.trim() === idVenta.trim());
    if (!v) return showToast("No se encontraron detalles ampliados.", "error");
    
    var safeNum = function(val) {
        if (val === undefined || val === null || val === '') return 0;
        var parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    };
    
    document.getElementById('rad-id').innerText = v.idVenta;
    document.getElementById('rad-fecha').innerText = v.fechaStr || v.fechaLimite || "Sin fecha";
    document.getElementById('rad-cliente').innerText = v.cliente;
    document.getElementById('rad-prod').innerText = v.producto;
    
    document.getElementById('rad-costo').innerText = v.costo_total > 0 ? COP.format(v.costo_total) : "N/A (Migración)";
    document.getElementById('rad-ganancia').innerText = v.ganancia > 0 ? COP.format(v.ganancia) : "N/A (Migración)";
    
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
    if (btnAnular) btnAnular.style.display = 'block';
    
    var timelineContainer = document.getElementById('rad-timeline');
    var btnWaKardex = document.getElementById('btn-wa-resumen');
    
    if (timelineContainer) timelineContainer.innerHTML = '<div class="text-center text-muted py-2"><i class="fas fa-spinner fa-spin"></i> Obteniendo Kárdex desde la nube...</div>';
    if (btnWaKardex) btnWaKardex.style.display = 'none';

    callAPI('obtenerHistorialVenta', { idVenta: idVenta }).then(res => {
        if (res.exito && timelineContainer) {
            State.tempHistorialVenta = res.historial;
            State.tempVentaActual = v; 
            
            let totalIngresos = 0; 
            let totalEgresos = 0;
            res.historial.forEach(m => { 
                if (m.tipo.includes('ingreso') || m.tipo.includes('abono')) totalIngresos += m.monto; 
                else totalEgresos += m.monto; 
            });
            
            let verdaderoTotal = v.saldo + totalIngresos - totalEgresos;
            document.getElementById('rad-total').innerText = COP.format(verdaderoTotal);
            document.getElementById('rad-metodo').innerText = v.metodo || "CRÉDITO";
            
            let saldoEnEseMomento = verdaderoTotal;
            let html = '';
            
            if (res.historial.length === 0) {
                html = '<div class="text-center text-muted">No hay abonos registrados aún.</div>';
            } else {
                res.historial.forEach(m => {
                    let esIngreso = m.tipo.includes('ingreso') || m.tipo.includes('abono');
                    let color = esIngreso ? 'text-success' : 'text-danger';
                    let signo = esIngreso ? '+' : '-';
                    
                    if (esIngreso) saldoEnEseMomento -= m.monto;
                    else saldoEnEseMomento += m.monto;
                    
                    html += `
                    <div class="d-flex justify-content-between border-bottom py-2">
                        <div>
                            <span class="d-block fw-bold" style="font-size:0.75rem;">${m.desc}</span>
                            <small class="text-muted">${m.fecha}</small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold ${color}" style="font-size:0.85rem;">${signo}${COP.format(m.monto)}</div>
                            <small class="text-muted fw-bold" style="font-size: 0.6rem;">Saldo: ${COP.format(Math.max(0, saldoEnEseMomento))}</small>
                        </div>
                    </div>`;
                });
            }
            timelineContainer.innerHTML = html;
            if (res.historial.length > 0 && btnWaKardex) btnWaKardex.style.display = 'block';
        }
    });

    if (!State.modals.radiografia) State.modals.radiografia = new bootstrap.Modal(document.getElementById('modalRadiografia'));
    State.modals.radiografia.show();
}

export function enviarResumenPagosWA() {
    var v = State.tempVentaActual;
    var hist = State.tempHistorialVenta || [];
    if (!v || hist.length === 0) return;

    var msg = `🪐 *PLANET SHOP - KÁRDEX DE PAGOS*\n\nHola *${v.cliente.trim()}*, este es el historial detallado de tu crédito:\n\n📦 *Producto:* ${v.producto}\n\n*📜 DETALLE DE MOVIMIENTOS:*\n`;

    let totalIngresos = 0; 
    let totalEgresos = 0;
    hist.forEach(m => { 
        if (m.tipo.includes('ingreso') || m.tipo.includes('abono')) totalIngresos += m.monto; 
        else totalEgresos += m.monto; 
    });
    
    let verdaderoTotal = v.saldo + totalIngresos - totalEgresos;
    let saldoEnEseMomento = verdaderoTotal;

    hist.forEach(m => {
        let esIngreso = m.tipo.includes('ingreso') || m.tipo.includes('abono');
        let icono = esIngreso ? '✅' : '❌';
        if (esIngreso) saldoEnEseMomento -= m.monto;
        else saldoEnEseMomento += m.monto;
        msg += `${icono} ${m.fecha}: ${m.desc}\n   Monto: *${COP.format(m.monto)}* | Saldo: *${COP.format(Math.max(0, saldoEnEseMomento))}*\n`;
    });

    msg += `\n💰 *Total Pactado:* ${COP.format(verdaderoTotal)}\n`;
    msg += `📊 *Saldo Actual Pendiente:* ${COP.format(v.saldo)}\n\n`;
    msg += `¡Gracias por confiar en Planet Shop! 🤝`;

    var waUrl = "https://wa.me/" + (v.telefono ? "57" + v.telefono.replace(/\D/g, '') : "");
    window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

export function revelarSecretos() {
    document.querySelectorAll('.rad-secret').forEach(e => e.classList.toggle('revealed'));
}

export function enviarEstadoCuentaAvanzadoWA(idVenta) {
    var d = State.data.deudores.find(x => x.idVenta === idVenta); 
    if (!d) return;
    var msg = `🪐 *PLANET SHOP - ESTADO DE CUENTA*\n\nHola *${d.cliente.trim()}*, este es el resumen de tu crédito:\n\n📦 *Producto:* ${d.producto}\n📊 *Saldo Pendiente:* ${COP.format(d.saldo)}\n\n`;
    if (d.deudaInicial > 0) msg += `⚠️ *Nota:* Tienes pendiente de inicial por ${COP.format(d.deudaInicial)}\n\n`;
    if (d.valCuota > 0) msg += `💳 *Próxima Cuota:* ${COP.format(d.valCuota)}\n📅 *Vencimiento:* ${d.fechaLimite || "Inmediato"}\n\n`;
    msg += `🏦 *Medios de Pago:* Bancolombia, Nequi y Daviplata. 🤝`;
    var waUrl = "https://wa.me/" + (d.telefono ? "57"+d.telefono.replace(/\D/g,'') : ""); 
    window.open(waUrl + "?text=" + encodeURIComponent(msg), '_blank');
}

export function abrirModalRefinanciar(id, cli, saldo) { 
    State.refEditId = id; 
    document.getElementById('ref-cliente').value = cli; 
    document.getElementById('ref-saldo-actual').value = COP.format(saldo); 
    if (State.modals.refinanciar) State.modals.refinanciar.show(); 
}

export function procesarRefinanciamiento() { 
    if (isProcessing) return;
    var idVenta = State.refEditId;
    var d = {
        idVenta: idVenta, 
        cargoAdicional: document.getElementById('ref-cargo').value, 
        nuevasCuotas: document.getElementById('ref-cuotas').value, 
        nuevaFecha: document.getElementById('ref-fecha').value, 
        aliasOperador: localStorage.getItem("alias") || "Sistema"
    };
    isProcessing = true;
    showToast("⚡ Procesando refinanciación...", "info");
    callAPI('refinanciarDeuda', d).then(r => { 
        if (window.App && window.App.loadData) window.App.loadData(true); 
        if (State.modals.refinanciar) State.modals.refinanciar.hide();
        showToast("✅ Deuda reestructurada", "success");
    }).finally(() => { isProcessing = false; }); 
}

export function castigarDeuda(idVenta) {
    if (isProcessing) return;
    if (confirm("¿Seguro que deseas castigar esta deuda?")) {
        isProcessing = true;
        callAPI('castigarCartera',{idVenta: idVenta, aliasOperador: localStorage.getItem("alias") || "Sistema"}).then(() => { 
            if (window.App && window.App.loadData) window.App.loadData(true); 
        }).finally(() => { isProcessing = false; });
    }
}

export function anularVenta(idVenta) {
    if (isProcessing) return;
    if (State.modals.radiografia) State.modals.radiografia.hide();
    Swal.fire({
        title: '☠️ Anular Venta Completa',
        html: `Revertirá saldos y cartera.<br><input id="anul-just" class="swal2-input w-100 m-0 mt-3" placeholder="Justificación (Mín. 10 letras)...">`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#e53e3e',
        preConfirm: () => {
            const val = document.getElementById('anul-just').value.trim();
            if (val.length < 10) Swal.showValidationMessage('Justificación requerida.');
            return val;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            isProcessing = true;
            callAPI('anularVentaBackend', { idVenta: idVenta, justificacion: result.value, aliasOperador: localStorage.getItem("alias") || "Sistema" }).then(r => {
                if (r.exito) Swal.fire('¡Anulada!', 'Rollback completado.', 'success').then(() => { if (window.App && window.App.loadData) window.App.loadData(true); });
            }).finally(() => { isProcessing = false; });
        }
    });
}

export function renderFin() {
    var s = document.getElementById('ab-cli'); 
    if(!s) return;
    s.innerHTML = '<option>Seleccione...</option>';
    var cuentasCobrar = 0;
    
    State.data.deudores.filter(d => d.estado !== 'Castigado').forEach(d => { 
        cuentasCobrar += d.saldo; 
        // Inyectamos el nombre limpio en un atributo data para doAbono
        s.innerHTML += `<option value="${d.idVenta}" data-cliente="${d.cliente}">${d.cliente} (Debe: ${COP.format(d.saldo)})</option>`; 
    });
    
    var searchEl = document.getElementById('hist-search');
    var q = searchEl ? searchEl.value.toLowerCase().trim() : "";
    var dataHist = State.data.historial || [];
    dataHist.forEach((x, index) => x._originalIndex = index);
    if (q) dataHist = dataHist.filter(x => (x.desc && x.desc.toLowerCase().includes(q)) || (x.monto && x.monto.toString().includes(q)));

    document.getElementById('hist-list').innerHTML = dataHist.map(x => {
        var i = (x.tipo.includes('ingreso') || x.tipo.includes('abono'));
        return `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <small class="fw-bold d-block">${x.desc}</small>
                <small class="text-muted" style="font-size:0.6rem;">${x.fecha}</small>
            </div>
            <div class="text-end">
                <strong class="${i ? 'text-success' : 'text-danger'}">${i ? '+' : '-'} ${COP.format(x.monto)}</strong>
                <button class="btn btn-sm text-muted p-1 ms-2" onclick="window.Finance.abrirEditMov(${x._originalIndex})">
                    <i class="fas fa-pencil-alt"></i>
                </button>
            </div>
        </div>`;
    }).join('');
    
    var invCosto = State.data.inv.reduce((a, b) => a + (b.costo || 0), 0);
    var cajaActual = (State.data.metricas && State.data.metricas.saldo) ? State.data.metricas.saldo : 0;
    var pasivos = State.data.pasivos.reduce((a, b) => a + (b.saldo || 0), 0);
    var elPatrimonio = document.getElementById('bal-patrimonio');
    if (elPatrimonio) elPatrimonio.innerText = COP.format(cajaActual + cuentasCobrar + invCosto - pasivos);
}

export function abrirEditMov(index) {
    if (!State.data.historial[index]) return;
    State.movEditObj = State.data.historial[index]; 
    document.getElementById('ed-mov-desc').value = State.movEditObj.desc;
    document.getElementById('ed-mov-monto').value = State.movEditObj.monto;
    document.getElementById('ed-mov-justificacion').value = ""; 
    var fRaw = String(State.movEditObj.fecha);
    var fIso = fRaw.includes('/') ? fRaw.split('/').reverse().join('-') : fRaw.split(' ')[0];
    document.getElementById('ed-mov-fecha').value = fIso;
    if (!State.modals.editMov) State.modals.editMov = new bootstrap.Modal(document.getElementById('modalEditMov'));
    State.modals.editMov.show();
}

export function guardarEdicionMovimiento() {
    if (isProcessing || !State.movEditObj) return;
    var nF = document.getElementById('ed-mov-fecha').value;
    var nM = document.getElementById('ed-mov-monto').value;
    var just = document.getElementById('ed-mov-justificacion').value.trim();
    if (!nF || !nM || just.length < 5) return alert("Datos incompletos o justificación muy corta.");
    isProcessing = true;
    if (State.modals.editMov) State.modals.editMov.hide();
    callAPI('editarMovimiento', { original: State.movEditObj, fecha: nF, monto: nM, justificacion: just, aliasOperador: localStorage.getItem("alias") || "Sistema" }).then(r => {
        if (r.exito) { showToast("✅ Corregido", "success"); if (window.App && window.App.loadData) window.App.loadData(true); }
    }).finally(() => { isProcessing = false; });
}

export function doAbono() { 
    if (isProcessing) return;
    var sel = document.getElementById('ab-cli');
    var cliId = sel.value;
    var monto = parseFloat(document.getElementById('ab-monto').value);
    if (!cliId || isNaN(monto) || monto <= 0) return;
    
    // Capturamos el nombre limpio del atributo data-cliente
    var clienteLimpio = sel.options[sel.selectedIndex].getAttribute('data-cliente');
    
    isProcessing = true;
    callAPI('registrarAbono', { 
        idVenta: cliId, 
        monto: monto, 
        cliente: clienteLimpio, 
        aliasOperador: localStorage.getItem("alias") || "Sistema" 
    }).then(() => {
        showToast("✅ Abono procesado", "success");
        if (window.App && window.App.loadData) window.App.loadData(true);
    }).finally(() => { isProcessing = false; }); 
}

export function doIngresoExtra() { 
    if (isProcessing) return;
    var d = document.getElementById('inc-desc').value;
    var m = parseFloat(document.getElementById('inc-monto').value);
    if (!d || isNaN(m) || m <= 0) return;
    isProcessing = true;
    callAPI('registrarIngresoExtra', { desc: d, cat: document.getElementById('inc-cat').value, monto: m, aliasOperador: localStorage.getItem("alias") || "Sistema" }).then(() => {
        showToast("✅ Ingreso registrado", "success");
        if (window.App && window.App.loadData) window.App.loadData(true);
    }).finally(() => { isProcessing = false; }); 
}

export function doGasto() { 
    if (isProcessing) return;
    var d = document.getElementById('g-desc').value;
    var m = parseFloat(document.getElementById('g-monto').value);
    if (!d || isNaN(m) || m <= 0) return;
    isProcessing = true;
    callAPI('registrarGasto', { desc: d, cat: document.getElementById('g-cat').value, monto: m, vinculo: document.getElementById('g-vinculo').value, aliasOperador: localStorage.getItem("alias") || "Sistema" }).then(() => {
        showToast("✅ Egreso registrado", "success");
        if (window.App && window.App.loadData) window.App.loadData(true);
    }).finally(() => { isProcessing = false; }); 
}

export function abrirModalPasivos() { alert("Módulo en construcción."); }

if (!window.Finance) window.Finance = {};
window.Finance.renderCartera = renderCartera;
window.Finance.abrirRadiografia = abrirRadiografia;
window.Finance.enviarResumenPagosWA = enviarResumenPagosWA;
window.Finance.revelarSecretos = revelarSecretos;
window.Finance.enviarEstadoCuentaAvanzadoWA = enviarEstadoCuentaAvanzadoWA;
window.Finance.abrirModalRefinanciar = abrirModalRefinanciar;
window.Finance.procesarRefinanciamiento = procesarRefinanciamiento;
window.Finance.castigarDeuda = castigarDeuda;
window.Finance.anularVenta = anularVenta;
window.Finance.renderFin = renderFin;
window.Finance.abrirEditMov = abrirEditMov;
window.Finance.guardarEdicionMovimiento = guardarEdicionMovimiento;
window.Finance.doAbono = doAbono;
window.Finance.doIngresoExtra = doIngresoExtra;
window.Finance.doGasto = doGasto;

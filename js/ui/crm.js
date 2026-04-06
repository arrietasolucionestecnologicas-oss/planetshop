import { State } from '../state.js';
import { callAPI } from '../api.js';

export function construirDirectorioClientes() {
    var map = new Map();
    if(State.data.clientes) { State.data.clientes.forEach(c => map.set(c.nombre.toLowerCase().trim(), c)); }
    if(State.data.deudores) {
        State.data.deudores.forEach(d => {
            if(d.cliente && d.telefono) {
                var key = d.cliente.toLowerCase().trim();
                if(!map.has(key)) map.set(key, {nombre: d.cliente, tel: d.telefono});
            }
        });
    }
    return Array.from(map.values()).sort((a,b) => a.nombre.localeCompare(b.nombre));
}

export function abrirModalClientes() { 
    renderClientes(); 
    if(State.modals.clientes) State.modals.clientes.show(); 
}

export function renderClientes() {
    var c = document.getElementById('list-clientes'); if(!c) return;
    var q = document.getElementById('cli-search').value.toLowerCase().trim();
    c.innerHTML='';
    var lista = State.data.clientesActivos || [];
    if(q) { lista = lista.filter(x => x.nombre.toLowerCase().includes(q) || (x.tel && x.tel.includes(q))); }
    
    if(lista.length === 0) { c.innerHTML = '<div class="text-muted text-center p-3">No hay clientes</div>'; return; }

    lista.forEach(cli => {
        var waLink = cli.tel ? `https://wa.me/57${cli.tel.replace(/\D/g,'')}` : '#';
        var btnChat = cli.tel ? `<a href="${waLink}" target="_blank" class="btn btn-sm btn-success text-white px-2 py-1"><i class="fab fa-whatsapp"></i></a>` : '';
        var btnEdit = `<button class="btn btn-sm btn-light border px-2 py-1" onclick="window.CRM.editarCliente('${cli.nombre}', '${cli.tel || ''}')">✏️</button>`;
        var btnDel = `<button class="btn btn-sm btn-outline-danger px-2 py-1" onclick="window.CRM.eliminarCliente('${cli.nombre}')">🗑️</button>`;
        var btnMigrar = `<button class="btn btn-sm text-white px-2 py-1 ms-1" style="background-color: #805ad5; border:none;" onclick="window.CRM.iniciarMigracionDeuda('${cli.nombre}', '${cli.tel || ''}')" title="Importar Deuda Antigua">📥</button>`;

        c.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <strong style="color:var(--primary);">${cli.nombre}</strong><br>
                <small class="text-muted">${cli.tel||'Sin teléfono'}</small>
            </div>
            <div class="d-flex gap-1">
                ${btnChat} ${btnEdit} ${btnDel} ${btnMigrar}
            </div>
        </div>`;
    });
}

export function guardarClienteManual(){ 
    var n = document.getElementById('new-cli-name').value; var t = document.getElementById('new-cli-tel').value; 
    if(!n) return alert("Nombre obligatorio"); 
    callAPI('registrarCliente', {nombre:n, tel:t}).then(r=>{ 
        document.getElementById('new-cli-name').value=''; 
        document.getElementById('new-cli-tel').value=''; 
        if(window.App && window.App.loadData) window.App.loadData(true); 
    }); 
}

export function editarCliente(nombreViejo, telViejo) {
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Editar Cliente',
            html: `<input id="swal-input1" class="swal2-input" value="${nombreViejo}" placeholder="Nombre">
                   <input id="swal-input2" class="swal2-input" value="${telViejo === 'undefined' || !telViejo ? '' : telViejo}" placeholder="Teléfono">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            preConfirm: () => {
                return {
                    nombreNuevo: document.getElementById('swal-input1').value.trim(),
                    telNuevo: document.getElementById('swal-input2').value.trim()
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                ejecutarEdicionCliente(nombreViejo, result.value.nombreNuevo, result.value.telNuevo);
            }
        });
    } else {
        var nombreNuevo = prompt("Nuevo nombre:", nombreViejo);
        if(!nombreNuevo) return;
        var telNuevo = prompt("Nuevo teléfono:", telViejo !== 'undefined' ? telViejo : '');
        ejecutarEdicionCliente(nombreViejo, nombreNuevo, telNuevo);
    }
}

function ejecutarEdicionCliente(nombreViejo, nombreNuevo, telNuevo) {
    if(!nombreNuevo) return alert("Nombre inválido");
    callAPI('editarClienteBackend', { nombreViejo, nombreNuevo, telNuevo }).then(r => {
        if(r.exito) { if(window.App && window.App.loadData) window.App.loadData(true); }
        else { alert(r.error); }
    });
}

export function eliminarCliente(nombre) {
    if(confirm(`¿Intentar eliminar a ${nombre}?\n\nEl sistema bloqueará la acción si tiene deudas activas.`)) {
        callAPI('eliminarClienteBackend', { nombre }).then(r => {
            if(r.exito) { if(window.App && window.App.loadData) window.App.loadData(true); }
            else { alert(r.error); }
        });
    }
}

export function iniciarMigracionDeuda(nombre, tel) {
    if(typeof Swal === 'undefined') return alert("Librería de alertas no cargada");
    Swal.fire({
        title: '📥 Importar Deuda Antigua',
        html: `
            <div class="text-start">
                <label class="small fw-bold text-muted">Cliente</label>
                <input id="mig-cli" class="swal2-input mb-2 mt-0 w-100 bg-light" value="${nombre}" readonly>
                
                <label class="small fw-bold">Concepto / Producto</label>
                <input id="mig-prod" class="swal2-input mb-2 mt-0 w-100" placeholder="Ej: Zapatos, Ropa, Préstamo...">
                
                <div class="row g-2 mb-2">
                    <div class="col-6">
                        <label class="small fw-bold">Valor Original ($)</label>
                        <input id="mig-total" type="number" class="swal2-input mt-0 w-100 m-0" placeholder="Precio total">
                    </div>
                    <div class="col-6">
                        <label class="small fw-bold text-danger">Saldo Pendiente ($) *</label>
                        <input id="mig-saldo" type="number" class="swal2-input mt-0 w-100 m-0 border-danger fw-bold text-danger" placeholder="Deuda actual">
                    </div>
                </div>
                
                <div class="row g-2 mb-2">
                    <div class="col-6">
                        <label class="small fw-bold">Cuotas Restantes *</label>
                        <input id="mig-cuotas" type="number" class="swal2-input mt-0 w-100 m-0" value="1" min="1">
                    </div>
                    <div class="col-6">
                        <label class="small fw-bold">Fecha Próx. Cobro *</label>
                        <input id="mig-fecha" type="date" class="swal2-input mt-0 w-100 m-0 border-primary">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Importar Deuda',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#805ad5',
        preConfirm: () => {
            var prod = document.getElementById('mig-prod').value.trim();
            var total = parseFloat(document.getElementById('mig-total').value) || 0;
            var saldo = parseFloat(document.getElementById('mig-saldo').value) || 0;
            var cuotas = parseInt(document.getElementById('mig-cuotas').value) || 1;
            var fecha = document.getElementById('mig-fecha').value;

            if(!prod) return Swal.showValidationMessage('Ingresa el producto o concepto');
            if(saldo <= 0) return Swal.showValidationMessage('El saldo pendiente debe ser mayor a $0');
            if(cuotas < 1) return Swal.showValidationMessage('Se requiere mínimo 1 cuota restante');
            if(!fecha) return Swal.showValidationMessage('Selecciona la fecha del próximo cobro');
            if(total < saldo) total = saldo; 

            return { cliente: nombre, tel: tel, producto: prod, totalOriginal: total, saldoPendiente: saldo, cuotasRestantes: cuotas, fechaCobro: fecha };
        }
    }).then((result) => {
        if(result.isConfirmed) {
            Swal.fire({ title: 'Importando Deuda...', text: 'Sincronizando con Cartera', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            var data = result.value;
            data.aliasOperador = localStorage.getItem("alias") || "Sistema";
            
            callAPI('migrarDeudaHistorica', data).then(r => {
                if(r.exito) {
                    if(State.modals.clientes) State.modals.clientes.hide();
                    Swal.fire('¡Importación Exitosa!', 'La deuda ya está registrada en el módulo de Cobranza y configurada para notificaciones.', 'success').then(() => {
                        if(window.App && window.App.loadData) window.App.loadData(true);
                    });
                } else {
                    Swal.fire('Error de Importación', r.error, 'error');
                }
            });
        }
    });
}

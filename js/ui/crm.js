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

        c.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <strong style="color:var(--primary);">${cli.nombre}</strong><br>
                <small class="text-muted">${cli.tel||'Sin teléfono'}</small>
            </div>
            <div class="d-flex gap-1">
                ${btnChat} ${btnEdit} ${btnDel}
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

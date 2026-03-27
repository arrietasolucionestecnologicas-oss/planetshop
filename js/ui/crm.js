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
        var btn = cli.tel ? `<a href="${waLink}" target="_blank" class="btn btn-sm btn-success text-white px-2 py-1"><i class="fab fa-whatsapp"></i> Chat</a>` : '<span class="text-muted small">Sin número</span>';
        c.innerHTML += `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><div><strong style="color:var(--primary);">${cli.nombre}</strong><br><small class="text-muted">${cli.tel||'Sin teléfono'}</small></div><div class="d-flex gap-2">${btn}</div></div>`;
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

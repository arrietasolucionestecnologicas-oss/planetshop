// ==========================================
// [MOD-003] ORQUESTADOR MAESTRO (BOOTSTRAPPER)
// ==========================================
import { State } from './state.js';
import { callAPI, updateOnlineStatus, sincronizarCola } from './api.js';
import { nav, verificarIdentidad, guardarIdentidad, previewFile, copyingDato } from './core.js';
import { renderPos, toggleCart, abrirModalItemManual, confirmarItemManual, abrirEditorItem, calcEditorItem, aplicarPrecioPactado, guardarEditorItem, toggleItemIva, changeQty, updateCartUI, toggleIni, calcCart, finalizarVenta, clearCart, shareProductNative, shareProdWhatsApp, shareQuote, agregarAlCarritoDesdeInv, guardarCotizacionActual, abrirModalCotizaciones, renderCotizaciones, cargarCotizacion, eliminarCotizacion, generarCotizacionPDF, toggleMobileCart, toggleDatosFormales } from './ui/pos.js';
import { renderInv, abrirModalNuevo, crearProducto, openEdit, guardarCambiosAvanzado, calcGain, calcMargen, abrirModalProv, renderProvs, guardarProvManual, editarProv } from './ui/inventory.js';
import { renderCartera, enviarEstadoCuentaAvanzadoWA, abrirModalRefinanciar, procesarRefinanciamiento, castigarDeuda, renderFin, doAbono, doIngresoExtra, doGasto, abrirModalPasivos } from './ui/finance.js';
import { construirDirectorioClientes, abrirModalClientes, renderClientes, guardarClienteManual } from './ui/crm.js';

// 1. INYECCIÓN AL SCOPE GLOBAL (WINDOW)
// Expone las funciones de los módulos cerrados (ES6) al DOM estático para que funcionen los onclick.
window.guardarIdentidad = guardarIdentidad;
window.nav = nav;
window.renderPos = renderPos;
window.toggleCart = toggleCart;
window.abrirModalItemManual = abrirModalItemManual;
window.confirmarItemManual = confirmarItemManual;
window.abrirEditorItem = abrirEditorItem;
window.aplicarPrecioPactado = aplicarPrecioPactado;
window.guardarEditorItem = guardarEditorItem;
window.toggleItemIva = toggleItemIva;
window.changeQty = changeQty;
window.calcCart = calcCart;
window.toggleIni = toggleIni;
window.finalizarVenta = finalizarVenta;
window.clearCart = clearCart;
window.shareProductNative = shareProductNative;
window.shareQuote = shareQuote;
window.guardarCotizacionActual = guardarCotizacionActual;
window.abrirModalCotizaciones = abrirModalCotizaciones;
window.cargarCotizacion = cargarCotizacion;
window.eliminarCotizacion = eliminarCotizacion;
window.generarCotizacionPDF = generarCotizacionPDF;
window.toggleMobileCart = toggleMobileCart;
window.toggleDatosFormales = toggleDatosFormales;
window.agregarAlCarritoDesdeInv = agregarAlCarritoDesdeInv;

window.renderInv = renderInv;
window.abrirModalNuevo = abrirModalNuevo;
window.crearProducto = crearProducto;
window.openEdit = openEdit;
window.guardarCambiosAvanzado = guardarCambiosAvanzado;
window.calcGain = calcGain;
window.calcMargen = calcMargen;
window.abrirModalProv = abrirModalProv;
window.guardarProvManual = guardarProvManual;
window.previewFile = previewFile;
window.copyingDato = copyingDato;

window.doAbono = doAbono;
window.doIngresoExtra = doIngresoExtra;
window.doGasto = doGasto;
window.abrirModalPasivos = abrirModalPasivos;
window.procesarRefinanciamiento = procesarRefinanciamiento;

window.abrirModalClientes = abrirModalClientes;
window.renderClientes = renderClientes;
window.guardarClienteManual = guardarClienteManual;

// Anclas internas de soporte cruzado
window.POS = { abrirEditorItem, toggleItemIva, changeQty, agregarAlCarritoDesdeInv, cargarCotizacion, eliminarCotizacion, shareProductNative };
window.Inventory = { openEdit, editarProv };
window.Finance = { enviarEstadoCuentaAvanzadoWA, abrirModalRefinanciar, castigarDeuda };
window.App = { loadData };

// 2. INICIALIZACIÓN DEL SISTEMA
window.onload = function() {
  State.modals.edicion = new bootstrap.Modal(document.getElementById('modalEdicion'));
  State.modals.nuevo = new bootstrap.Modal(document.getElementById('modalNuevo'));
  State.modals.login = new bootstrap.Modal(document.getElementById('modalLoginApp'));
  State.modals.refinanciar = new bootstrap.Modal(document.getElementById('modalRefinanciar'));
  State.modals.editItem = new bootstrap.Modal(document.getElementById('modalEditItem'));
  State.modals.manualItem = new bootstrap.Modal(document.getElementById('modalManualItem'));
  State.modals.cotizaciones = new bootstrap.Modal(document.getElementById('modalCotizaciones'));
  State.modals.prov = new bootstrap.Modal(document.getElementById('modalProv'));
  State.modals.clientes = new bootstrap.Modal(document.getElementById('modalClientes'));
  
  var tpl = document.getElementById('tpl-cart').innerHTML;
  document.getElementById('desktop-cart-container').innerHTML = tpl;
  document.getElementById('mobile-cart').innerHTML = tpl;
  
  document.querySelectorAll('#c-inicial').forEach(el => { el.removeAttribute('disabled'); el.oninput = calcCart; });
  
  var lastView = localStorage.getItem('planet_view') || 'pos';
  nav(lastView, document.querySelector(`.nav-btn[onclick*="'${lastView}'"]`));
  
  verificarIdentidad(); 
  updateOnlineStatus(loadData); 
  loadData();
};

// 3. CARGA MAESTRA DE DATOS
function loadData(silent = false){
  if(!silent && State.data.inv.length === 0) document.getElementById('loader').style.display='flex';
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
    State.data.inv = res.inventario || []; 
    State.data.deudores = res.deudores || []; 
    State.data.historial = res.historial || []; 
    State.data.cotizaciones = res.cotizaciones || [];
    State.data.proveedores = res.proveedores || []; 
    State.data.pasivos = res.pasivos || [];
    State.data.clientes = res.clientes || [];
    
    State.data.clientesActivos = construirDirectorioClientes();
    
    if(res.metricas) { 
        State.data.metricas = res.metricas;
        document.getElementById('bal-caja').innerText = COP.format(res.metricas.saldo||0); 
    }
    
    var dlCli = document.getElementById('list-clientes-rapido');
    if(dlCli) {
        dlCli.innerHTML = '';
        State.data.clientesActivos.forEach(c => {
            var o = document.createElement('option'); o.value = c.nombre; dlCli.appendChild(o);
        });
    }

    var dlProvs = document.getElementById('list-provs-all');
    if(dlProvs) {
        dlProvs.innerHTML = '';
        State.data.proveedores.forEach(p => { var o = document.createElement('option'); o.value = p.nombre; dlProvs.appendChild(o); });
    }

    renderPos(); renderInv(); renderFin(); renderCartera(); renderProvs(); renderClientes();
}

/**
 * 🪐 PLANET SHOP API v3.2 - MOTOR DE CRÉDITO & DASHBOARD BI
 * - Arquitectura Modular Desacoplada
 * - Frecuencias de Pago (Quincenal/Mensual) con días de gracia.
 * - Auto-migración de Base de Datos.
 * - Endpoint para Dashboard Gerencial Integrado (A.S.T.)
 */

const CONFIG = {
  HOJAS: { 
    PROD: "PRODUCTOS", 
    VENTAS: "VENTAS", 
    CAPITAL: "CAPITAL", 
    GASTOS: "GASTOS", 
    ABONOS: "ABONOS", 
    PROV: "PROVEEDORES",
    COTIZ: "COTIZACIONES",
    BITACORA: "BITACORA",
    PASIVOS: "PASIVOS",
    CLIENTES: "CLIENTES"
  },
  IMG_FOLDER: "PLANET_SHOP_IMAGENES",
  ADMIN_EMAIL: "planetshop17@gmail.com"
};

// =======================================================
// 0. AUTO-INSTALADOR Y TRAZABILIDAD
// =======================================================

function instalarBaseDeDatos(ss) {
    ss = ss || SpreadsheetApp.getActiveSpreadsheet(); 
    
    var hojasRequeridas = [
        { n: CONFIG.HOJAS.PROD, h: ["ID", "Nombre", "Categoria", "Costo", "Proveedor", "Fecha", "Desc", "Foto", "Publico"] },
        { n: CONFIG.HOJAS.VENTAS, h: ["ID_Venta", "Fecha", "Cliente", "Categoria", "Producto", "Cant", "Precio_Final", "Total", "Metodo", "Estado", "Inicial", "Saldo", "Mes", "Año", "Costo_Unit", "Costo_Total", "Ganancia", "Vendedor", "Fecha_Cobro", "Cuotas", "Valor_Cuota", "Deuda_Inicial", "Telefono", "Frecuencia"] },
        { n: CONFIG.HOJAS.CAPITAL, h: ["ID_Ref", "Fecha", "Descripcion", "Tipo", "Monto", "Categoria", "Saldo_Acumulado"] },
        { n: CONFIG.HOJAS.GASTOS, h: ["ID", "Fecha", "Desc", "Cat", "Monto", "Vinculo"] },
        { n: CONFIG.HOJAS.ABONOS, h: ["ID", "RefVenta", "Fecha", "Monto", "Nota"] },
        { n: CONFIG.HOJAS.PROV, h: ["Proveedor", "Telefono_WA"] },
        { n: CONFIG.HOJAS.CLIENTES, h: ["Cliente", "Telefono_WA", "Fecha_Registro"] }, 
        { n: CONFIG.HOJAS.COTIZ, h: ["ID_Cotizacion", "Fecha", "Cliente", "Total", "Estado", "DatosJSON"] },
        { n: CONFIG.HOJAS.PASIVOS, h: ["ID_Pasivo", "Fecha", "Acreedor", "Monto_Original", "Saldo", "Fecha_Limite", "Estado", "Notas"] },
        { n: CONFIG.HOJAS.BITACORA, h: ["FECHA_HORA", "USUARIO", "MODULO", "ACCION", "DETALLE", "JUSTIFICACION"] }
    ];

    var creadas = false;
    hojasRequeridas.forEach(function(hojaInfo) {
        var h = ss.getSheetByName(hojaInfo.n);
        if (!h) {
            h = ss.insertSheet(hojaInfo.n);
            h.appendRow(hojaInfo.h);
            h.getRange(1, 1, 1, hojaInfo.h.length).setFontWeight("bold").setBackground("#1a365d").setFontColor("#63b3ed");
            if(hojaInfo.n === CONFIG.HOJAS.BITACORA) h.hideSheet();
            creadas = true;
        }
    });
    return creadas;
}

function registrarEnBitacora(usuario, modulo, accion, detalle, justificacion) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hB = ss.getSheetByName(CONFIG.HOJAS.BITACORA);
        if (!hB) return; 
        var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        hB.appendRow([fecha, (usuario || "Anonimo"), modulo, accion, detalle, (justificacion || "N/A")]);
    } catch(e) {}
}

// =======================================================
// 1. ENRUTADOR DE PETICIONES (API GATEWAY)
// =======================================================

function doPost(e) {
  var output = { exito: false, error: "Acción no reconocida" };
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var data = params.data;
    
    if (action === 'obtenerDatosCompletos') output = obtenerDatosCompletos();
    else if (action === 'procesarVentaCarrito') output = procesarVentaCarrito(data);
    else if (action === 'guardarProductoAvanzado') output = guardarProductoAvanzado(data);
    else if (action === 'eliminarProductoBackend') output = eliminarProductoBackend(data);
    else if (action === 'crearProductoManual') output = crearProductoManual(data);
    else if (action === 'registrarAbono') output = registrarAbono(data);
    else if (action === 'registrarGasto') output = registrarGasto(data);
    else if (action === 'registrarIngresoExtra') output = registrarIngresoExtra(data);
    else if (action === 'registrarProveedor') output = registrarProveedor(data);
    else if (action === 'registrarCliente') output = registrarCliente(data);
    else if (action === 'editarClienteBackend') output = editarClienteBackend(data);
    else if (action === 'eliminarClienteBackend') output = eliminarClienteBackend(data);
    else if (action === 'editarMovimiento') output = editarMovimiento(data);
    else if (action === 'castigarCartera') output = castigarCartera(data);
    else if (action === 'refinanciarDeuda') output = refinanciarDeuda(data);
    else if (action === 'guardarCotizacion') output = guardarCotizacion(data);
    else if (action === 'eliminarCotizacion') output = eliminarCotizacion(data);
    else if (action === 'abonarPasivo') output = abonarPasivo(data);
    else if (action === 'getDashboardData') output = getDashboardData(data);
    else if (action === 'migrarDeudaHistorica') output = migrarDeudaHistorica(data);
    else if (action === 'anularVentaBackend') output = anularVentaBackend(data);
    else if (action === 'obtenerHistorialVenta') output = obtenerHistorialVenta(data);
    
  } catch (err) { output = { exito: false, error: err.toString() }; }
  
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) { return ContentService.createTextOutput("PLANET SHOP API v3.2 ONLINE."); }

// =======================================================
// 2. FUNCIÓN DE SANACIÓN (RECALCULAR CAPITAL)
// =======================================================

function recalcularCapitalTotal() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); 
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
    if (!hC || hC.getLastRow() < 2) return { exito: true, mensaje: "Capital vacío" };
    
    var range = hC.getRange(2, 1, hC.getLastRow() - 1, 7);
    var data = range.getValues();
    var saldoAcumulado = 0;
    var saldosCorregidos = [];
    
    for (var i = 0; i < data.length; i++) {
        var tipo = String(data[i][3]).toLowerCase().trim();
        var monto = Number(data[i][4]) || 0;
        if (tipo.includes('ingreso') || tipo.includes('abono') || tipo === 'entrada') saldoAcumulado += monto;
        else if (tipo.includes('egreso') || tipo.includes('gasto') || tipo === 'salida' || tipo === 'anulacion') saldoAcumulado -= monto;
        saldosCorregidos.push([saldoAcumulado]);
    }
    hC.getRange(2, 7, saldosCorregidos.length, 1).setValues(saldosCorregidos);
    return { exito: true, saldoFinal: saldoAcumulado };
  } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

// =======================================================
// 3. FUNCIONES DE LECTURA Y DATOS
// =======================================================

function obtenerDatosCompletos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  instalarBaseDeDatos(ss); 

  var hProd = ss.getSheetByName(CONFIG.HOJAS.PROD);
  var hVentas = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
  var hCapital = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
  var hProv = ss.getSheetByName(CONFIG.HOJAS.PROV);
  var hCotiz = ss.getSheetByName(CONFIG.HOJAS.COTIZ);
  var hPasivos = ss.getSheetByName(CONFIG.HOJAS.PASIVOS);
  var hClientes = ss.getSheetByName(CONFIG.HOJAS.CLIENTES);

  if(hVentas && hVentas.getMaxColumns() < 24) {
      hVentas.insertColumnAfter(23);
      hVentas.getRange(1, 24).setValue("Frecuencia").setFontWeight("bold").setBackground("#1a365d").setFontColor("#63b3ed");
  }

  var inventario = [];
  if (hProd.getLastRow() > 1) {
    var data = hProd.getRange(2, 1, hProd.getLastRow()-1, 9).getValues();
    for(var i=0; i<data.length; i++){
      var r = data[i];
      if(!r[1]) continue; 
      inventario.push({ id: String(r[0]), nombre: String(r[1]), cat: String(r[2]), costo: Number(r[3]), prov: String(r[4]), desc: String(r[6]), foto: String(r[7]), publico: Number(r[8]) });
    }
  }

  var proveedores = [];
  if (hProv.getLastRow() > 1) {
    proveedores = hProv.getRange(2, 1, hProv.getLastRow()-1, 2).getValues().map(function(r) { return { nombre: String(r[0]), tel: String(r[1]) }; });
  }

  var clientes = [];
  if (hClientes && hClientes.getLastRow() > 1) {
    clientes = hClientes.getRange(2, 1, hClientes.getLastRow()-1, 2).getValues().map(function(r) { return { nombre: String(r[0]), tel: String(r[1]) }; });
  }

  var cotizaciones = [];
  if (hCotiz.getLastRow() > 1) {
    var dataCot = hCotiz.getRange(2, 1, hCotiz.getLastRow()-1, 6).getValues();
    for(var k=dataCot.length-1; k>=0; k--) {
        if(dataCot[k][4] !== 'Facturada') {
            try { var paquete = JSON.parse(dataCot[k][5]); paquete.estado = dataCot[k][4]; cotizaciones.push(paquete); } catch(e) {}
        }
    }
  }
  
  var pasivosList = [];
  if (hPasivos.getLastRow() > 1) {
      var dataPas = hPasivos.getRange(2, 1, hPasivos.getLastRow()-1, 8).getValues();
      for(var p=0; p<dataPas.length; p++) {
          if (dataPas[p][6] !== 'Pagado') { 
              pasivosList.push({ id: dataPas[p][0], fecha: formatDate(dataPas[p][1]), acreedor: dataPas[p][2], monto: dataPas[p][3], saldo: dataPas[p][4], fechaLimite: formatDate(dataPas[p][5]), estado: dataPas[p][6] });
          }
      }
  }

  var saldo = 0; var historial = [];
  if (hCapital.getLastRow() > 1) {
    var dataC = hCapital.getRange(2, 1, hCapital.getLastRow()-1, 7).getValues(); 
    if(dataC.length > 0) saldo = Number(dataC[dataC.length-1][6]) || 0;
    for(var j=dataC.length-1; j>=0; j--){
      if(historial.length < 50) {
        historial.push({ fecha: formatDate(dataC[j][1]), desc: String(dataC[j][2]), tipo: String(dataC[j][3]), monto: Number(dataC[j][4]), saldo: Number(dataC[j][6]) });
      }
    }
  }

  var deudores = []; var ultimasVentas = []; 
  var ventaMes = 0; var gananciaMes = 0;
  var mesActual = new Date().getMonth() + 1;
  var anioActual = new Date().getFullYear();

  if (hVentas.getLastRow() > 1) {
    var dataV = hVentas.getRange(2, 1, hVentas.getLastRow()-1, 24).getValues();
    dataV.forEach(function(r) {
      var estado = String(r[9]);
      if((estado === "Pendiente" || estado === "Castigado") && Number(r[11]) > 0) {
        deudores.push({ idVenta: r[0], cliente: r[2], producto: r[4], saldo: Number(r[11]), fechaLimite: formatDate(r[18]), fechaLimiteRaw: r[18] ? new Date(r[18]).toISOString() : null, cuotas: r[19], valCuota: r[20], estado: estado, deudaInicial: Number(r[21]) || 0, telefono: String(r[22] || ""), frecuencia: String(r[23] || "Mensual") });
      }
      var mesFila = Number(r[12]); var anioFila = Number(r[13]);
      if (mesFila === mesActual && anioFila === anioActual && estado !== "Anulada") { ventaMes += Number(r[7]) || 0; gananciaMes += Number(r[16]) || 0; }
    });
    var recientes = dataV.slice(-60).reverse(); 
    recientes.forEach(function(r) { 
        if(r[9] !== "Anulada") ultimasVentas.push({ id: r[0], desc: r[0] + " | " + r[2] + " (" + r[4] + ")" }); 
    });
  }

  return { 
      inventario: inventario, metricas: { saldo: saldo, ventaMes: ventaMes, gananciaMes: gananciaMes },
      deudores: deudores, ultimasVentas: ultimasVentas, historial: historial, cotizaciones: cotizaciones,
      pasivos: pasivosList, proveedores: proveedores, clientes: clientes 
  };
}

function obtenerHistorialVenta(d) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
    var idVenta = String(d.idVenta).trim();
    var historialPago = [];

    if (hC && hC.getLastRow() > 1) {
        var dataC = hC.getRange(2, 1, hC.getLastRow() - 1, 5).getValues(); // ID, Fecha, Desc, Tipo, Monto
        for (var i = 0; i < dataC.length; i++) {
            var ref = String(dataC[i][0]).trim();
            var desc = String(dataC[i][2]);
            // Busca si la transacción en el libro de caja le pertenece a esta venta (Abono, Inicial, Reversión)
            if (ref.includes(idVenta) || desc.includes(idVenta)) {
                historialPago.push({
                    fecha: formatDate(dataC[i][1]),
                    desc: desc,
                    tipo: String(dataC[i][3]).toLowerCase(),
                    monto: Number(dataC[i][4]) || 0
                });
            }
        }
    }
    return { exito: true, historial: historialPago };
}

function formatDate(date) {
  if(!date) return "";
  try { return new Date(date).toLocaleDateString(); } catch(e) { return String(date); }
}

// =======================================================
// 4. MÓDULO DE VENTAS Y RIESGO
// =======================================================

function guardarCotizacion(data) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(5000);
        var hCotiz = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.COTIZ);
        var finder = hCotiz.getRange("A:A").createTextFinder(data.id).matchEntireCell(true).findNext();
        if(finder) hCotiz.getRange(finder.getRow(), 2, 1, 5).setValues([[data.fecha, data.cliente, data.total, "Pendiente", JSON.stringify(data)]]);
        else hCotiz.appendRow([data.id, data.fecha, data.cliente, data.total, "Pendiente", JSON.stringify(data)]);
        return { exito: true };
    } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

function eliminarCotizacion(id) {
    var hCotiz = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.COTIZ);
    var finder = hCotiz.getRange("A:A").createTextFinder(id).matchEntireCell(true).findNext();
    if(finder) hCotiz.deleteRow(finder.getRow());
    return { exito: true };
}

function procesarVentaCarrito(datos) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hVentas = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
    var hCapital = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
    
    var fecha = datos.fechaPersonalizada ? new Date(datos.fechaPersonalizada + "T12:00:00") : new Date();
    var idBase = "VEN-" + Date.now().toString().slice(-5);
    
    var frecuencia = datos.frecuencia || "Mensual";
    var fechaCobro = datos.primerPago ? new Date(datos.primerPago + "T12:00:00") : new Date(fecha.getTime() + (30 * 24 * 60 * 60 * 1000));
    var numCuotas = Number(datos.cuotas) || 1; 

    if(datos.idCotizacion) {
        var hCotiz = ss.getSheetByName(CONFIG.HOJAS.COTIZ);
        if(hCotiz) {
            var finderC = hCotiz.getRange("A:A").createTextFinder(datos.idCotizacion).matchEntireCell(true).findNext();
            if(finderC) hCotiz.getRange(finderC.getRow(), 5).setValue("Facturada");
        }
    }

    var totalVenta = datos.items.reduce(function(a,b){return a + Number(b.precioVenta)}, 0);
    var itemsCount = datos.items.length;
    var inicialTotalReal = Number(datos.inicial) || 0;
    var inicialTotalPactada = (datos.metodo === "Crédito" && !datos.eximirInicial) ? (totalVenta * 0.30) : 0;
    var deudaInicialTotal = Math.max(0, inicialTotalPactada - inicialTotalReal);
    var cash = datos.metodo === "Contado" ? totalVenta : inicialTotalReal;

    datos.items.forEach(function(item) {
        var pFinal = Number(item.precioVenta); var costo = Number(item.costo) || 0;
        var ganancia = pFinal - costo; var estado = datos.metodo === "Crédito" ? "Pendiente" : "Pagado";
        var pesoItem = totalVenta > 0 ? (pFinal / totalVenta) : (1 / itemsCount);
        var inicialItem = inicialTotalReal * pesoItem; var deudaInicialItem = deudaInicialTotal * pesoItem;
        var saldoItem = datos.metodo === "Crédito" ? Math.max(0, pFinal - inicialItem) : 0;
        var fCobroItem = datos.metodo === "Crédito" ? fechaCobro : "";
        var valCuotaItem = datos.metodo === "Crédito" ? (saldoItem / numCuotas) : 0;
        var telefono = datos.telefono || "";
        
        hVentas.appendRow([
            idBase, fecha, datos.cliente, item.cat, item.nombre, 1, pFinal, pFinal, 
            datos.metodo, estado, inicialItem, saldoItem, fecha.getMonth()+1, fecha.getFullYear(), 
            costo, costo, ganancia, datos.vendedor, fCobroItem, numCuotas, valCuotaItem, deudaInicialItem, telefono, frecuencia
        ]);
    });
    
    if(cash > 0) {
       var sAnt = hCapital.getLastRow() > 1 ? Number(hCapital.getRange(hCapital.getLastRow(), 7).getValue()) || 0 : 0;
       hCapital.appendRow([idBase, fecha, (datos.metodo==="Contado"?"Venta: ":"Inicial: ") + datos.cliente, "ingresos", cash, "", sAnt + cash]);
    }
    
    if(datos.metodo === "Crédito" && inicialTotalReal > 0) {
       var hAb = ss.getSheetByName(CONFIG.HOJAS.ABONOS);
       hAb.appendRow(["AB-INI-"+idBase, idBase, fecha, inicialTotalReal, "Inicial Venta Crédito"]);
    }
    
    recalcularCapitalTotal();
    registrarEnBitacora(datos.aliasOperador, "PUNTO DE VENTA", "Nueva Venta", "Factura " + idBase + " - Total: $" + totalVenta + " (" + datos.metodo + ")");
    return { exito: true };
  } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

function migrarDeudaHistorica(datos) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hVentas = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
        
        var fechaFantasma = new Date(2000, 0, 1, 12, 0, 0); 
        var idBase = "MIG-" + Date.now().toString().slice(-5);
        var valCuota = datos.saldoPendiente / datos.cuotasRestantes;
        var abonoVirtual = datos.totalOriginal - datos.saldoPendiente;
        var telefono = datos.tel || "";

        hVentas.appendRow([
            idBase, fechaFantasma, datos.cliente, "Migración", datos.producto + " (Histórico)", 1, datos.totalOriginal, datos.totalOriginal, 
            "Crédito", "Pendiente", abonoVirtual, datos.saldoPendiente, 1, 2000, 
            0, 0, 0, datos.aliasOperador, new Date(datos.fechaCobro + "T12:00:00"), datos.cuotasRestantes, valCuota, 0, telefono, "Mensual"
        ]);
        
        registrarEnBitacora(datos.aliasOperador, "MIGRACION", "Importó Deuda", "Cliente: " + datos.cliente + " | Saldo: $" + datos.saldoPendiente);
        return { exito: true };
    } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

function registrarAbono(d) {
   var lock = LockService.getScriptLock();
   lock.waitLock(5000);
   try {
     var ss = SpreadsheetApp.getActiveSpreadsheet();
     var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
     var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
     var hAb = ss.getSheetByName(CONFIG.HOJAS.ABONOS);

     var baseId = String(d.idVenta).trim();
     var ranges = hV.getRange("A:A").createTextFinder(baseId).matchEntireCell(true).findAll();
     if(!ranges || ranges.length === 0) return {exito: false, error: "Venta no encontrada"};
     
     var montoAbonoRestante = Number(d.monto);

     for (var i = 0; i < ranges.length; i++) {
         if (montoAbonoRestante <= 0) break; 
         var r = ranges[i].getRow();
         var saldoActual = Number(hV.getRange(r, 12).getValue());
         var valCuota = Number(hV.getRange(r, 21).getValue());
         var deudaInicialActual = Number(hV.getRange(r, 22).getValue()) || 0; 
         var frecuencia = String(hV.getRange(r, 24).getValue() || "Mensual");
         
         if (saldoActual <= 0) continue; 
         var montoAplicar = Math.min(saldoActual, montoAbonoRestante);
         montoAbonoRestante -= montoAplicar;
         var nuevoSaldo = Math.max(0, saldoActual - montoAplicar);
         hV.getRange(r, 12).setValue(nuevoSaldo);

         if (deudaInicialActual > 0) {
             var pagoAInicial = Math.min(deudaInicialActual, montoAplicar);
             hV.getRange(r, 22).setValue(deudaInicialActual - pagoAInicial); 
             var pagoACuotas = montoAplicar - pagoAInicial; 
             if (pagoACuotas > 0 && valCuota > 0 && nuevoSaldo > 1000) {
                 var cuotasPagadas = pagoACuotas / valCuota;
                 if (cuotasPagadas >= 0.95) { 
                     var mesesAAdelantar = Math.floor(cuotasPagadas);
                     var fCobro = new Date(hV.getRange(r, 19).getValue());
                     if (fCobro instanceof Date && !isNaN(fCobro)) {
                         if(frecuencia === "Quincenal") fCobro.setDate(fCobro.getDate() + (15 * mesesAAdelantar));
                         else fCobro.setMonth(fCobro.getMonth() + mesesAAdelantar);
                         hV.getRange(r, 19).setValue(fCobro);
                     }
                 }
             }
         } else {
             if (valCuota > 0 && nuevoSaldo > 1000) {
                 var cuotasAntes = Math.ceil(saldoActual / valCuota);
                 var cuotasDespues = Math.ceil(nuevoSaldo / valCuota);
                 var diffCuotas = cuotasAntes - cuotasDespues;
                 if (diffCuotas > 0) {
                     var fCobro2 = new Date(hV.getRange(r, 19).getValue());
                     if (fCobro2 instanceof Date && !isNaN(fCobro2)) {
                         if(frecuencia === "Quincenal") fCobro2.setDate(fCobro2.getDate() + (15 * diffCuotas));
                         else fCobro2.setMonth(fCobro2.getMonth() + diffCuotas);
                         hV.getRange(r, 19).setValue(fCobro2);
                     }
                 }
             }
         }
         if(nuevoSaldo <= 100) {
             hV.getRange(r, 10).setValue("Pagado");
             hV.getRange(r, 12).setValue(0);
         }
     }
     
     hAb.appendRow(["AB-"+Date.now(), baseId, new Date(d.fecha || new Date()), d.monto, "Abono Cliente"]);
     var sAnt = hC.getLastRow() > 1 ? Number(hC.getRange(hC.getLastRow(), 7).getValue()) || 0 : 0;
     hC.appendRow([baseId, new Date(d.fecha || new Date()), "Abono: "+d.cliente, "abono", d.monto, "", sAnt + Number(d.monto)]);
     
     registrarEnBitacora(d.aliasOperador, "COBRANZA", "Registró Abono", "Abono de $" + d.monto + " a factura " + baseId);
     return {exito:true};
   } catch(e) { return {exito:false, error:e.message}; } finally { lock.releaseLock(); }
}

function castigarCartera(d) {
   var lock = LockService.getScriptLock();
   try {
     lock.waitLock(5000);
     var hV = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.VENTAS);
     var ranges = hV.getRange("A:A").createTextFinder(d.idVenta).matchEntireCell(true).findAll();
     if(!ranges || ranges.length === 0) return {exito: false, error: "Venta no encontrada"};
     ranges.forEach(rng => hV.getRange(rng.getRow(), 10).setValue("Castigado"));
     registrarEnBitacora(d.aliasOperador, "RIESGO", "Castigó Cartera", "Se envió a pérdida la factura " + d.idVenta);
     return { exito: true };
   } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

function refinanciarDeuda(d) {
   var lock = LockService.getScriptLock();
   try {
     lock.waitLock(5000);
     var hV = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.VENTAS);
     var ranges = hV.getRange("A:A").createTextFinder(d.idVenta).matchEntireCell(true).findAll();
     if(!ranges || ranges.length === 0) return {exito: false, error: "Venta no encontrada"};
     
     var cargoPorItem = (Number(d.cargoAdicional) || 0) / ranges.length;
     var nuevasCuotas = Number(d.nuevasCuotas) || 1;
     
     ranges.forEach(rng => {
         var r = rng.getRow();
         var totalActual = Number(hV.getRange(r, 8).getValue()) || 0;
         var saldoActual = Number(hV.getRange(r, 12).getValue()) || 0;
         var gananciaActual = Number(hV.getRange(r, 17).getValue()) || 0;
         
         hV.getRange(r, 8).setValue(totalActual + cargoPorItem);
         hV.getRange(r, 12).setValue(saldoActual + cargoPorItem);
         hV.getRange(r, 17).setValue(gananciaActual + cargoPorItem);
         hV.getRange(r, 19).setValue(d.nuevaFecha);
         hV.getRange(r, 20).setValue(nuevasCuotas);
         hV.getRange(r, 21).setValue((saldoActual + cargoPorItem) / nuevasCuotas);
     });
     
     registrarEnBitacora(d.aliasOperador, "COBRANZA", "Refinanció Deuda", "Factura " + d.idVenta + " repactada a " + nuevasCuotas + " cuotas.");
     return { exito: true };
   } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

function anularVentaBackend(d) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
        var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
        var hB = ss.getSheetByName(CONFIG.HOJAS.BITACORA);
        
        var idVenta = d.idVenta;
        var justificacion = d.justificacion;
        var alias = d.aliasOperador || "Sistema";

        var ranges = hV.getRange("A:A").createTextFinder(idVenta).matchEntireCell(true).findAll();
        if(!ranges || ranges.length === 0) return {exito: false, error: "Venta no encontrada."};

        var dineroADevolver = 0;
        var totalVentaPactado = 0;
        var clienteName = "";

        ranges.forEach(rng => {
            var r = rng.getRow();
            clienteName = hV.getRange(r, 3).getValue();
            var estadoActual = hV.getRange(r, 10).getValue();
            var inicialPagada = Number(hV.getRange(r, 11).getValue()) || 0;
            var totalFila = Number(hV.getRange(r, 8).getValue()) || 0;
            
            if (estadoActual !== "Anulada") {
                hV.getRange(r, 10).setValue("Anulada");
                hV.getRange(r, 12).setValue(0); // Eliminar Saldo
                dineroADevolver += inicialPagada;
                totalVentaPactado += totalFila;
            }
        });

        // Buscar si hay abonos posteriores asociados a esta factura y sumarlos a la reversión
        var dataC = hC.getDataRange().getValues();
        for(var i=1; i<dataC.length; i++) {
            var ref = String(dataC[i][0]).trim();
            var tipo = String(dataC[i][3]).toLowerCase();
            var desc = String(dataC[i][2]).toLowerCase();
            
            if (ref === idVenta && tipo.includes("ingreso")) {
                if (desc.includes("abono") || desc.includes("venta:") || desc.includes("contado")) {
                    dineroADevolver += Number(dataC[i][4]) || 0;
                }
            }
        }

        // Registrar el egreso (reversión) en caja si hubo dinero implicado
        if (dineroADevolver > 0) {
            hC.appendRow(["REV-"+idVenta, new Date(), "Anulación / Devolución a " + clienteName, "anulacion", dineroADevolver, "Reversión", 0]);
        }

        registrarEnBitacora(alias, "SANEAMIENTO", "Anuló Factura", idVenta + " | Valor: $" + totalVentaPactado, justificacion);
        
        recalcularCapitalTotal();
        return { exito: true };

    } catch(e) { return { exito: false, error: e.message }; } finally { lock.releaseLock(); }
}

// =======================================================
// 5. GESTIÓN FINANCIERA INTELIGENTE
// =======================================================

function registrarGasto(d) {
   var lock = LockService.getScriptLock();
   lock.waitLock(5000);
   try {
     var ss = SpreadsheetApp.getActiveSpreadsheet();
     var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
     var hG = ss.getSheetByName(CONFIG.HOJAS.GASTOS);
     var montoGasto = Number(d.monto); 
     
     hG.appendRow(["GAS-"+Date.now().toString().slice(-4), new Date(), d.desc, d.cat, montoGasto, d.vinculo]);
     var sAnt = hC.getLastRow() > 1 ? Number(hC.getRange(hC.getLastRow(), 7).getValue()) || 0 : 0;
     hC.appendRow(["GAS", new Date(), "Gasto: "+d.desc, "egreso", d.monto, "", sAnt - montoGasto]);
     
     if (d.vinculo && d.vinculo !== "") {
         if (d.vinculo.startsWith("VEN-")) {
             var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
             var finderV = hV.getRange("A:A").createTextFinder(d.vinculo).matchEntireCell(true).findNext();
             if (finderV) {
                 var rV = finderV.getRow();
                 hV.getRange(rV, 16).setValue(montoGasto); 
                 hV.getRange(rV, 17).setValue(Number(hV.getRange(rV, 8).getValue()) - montoGasto);
             }
         } else {
             var hP = ss.getSheetByName(CONFIG.HOJAS.PROD);
             var finderP = hP.getRange("A:A").createTextFinder(d.vinculo).matchEntireCell(true).findNext();
             if (finderP) hP.getRange(finderP.getRow(), 4).setValue(montoGasto);
         }
     }
     registrarEnBitacora(d.aliasOperador, "FINANZAS", "Registró Gasto", "Monto: $" + d.monto);
     return {exito:true};
   } catch(e) { return {exito:false, error:e.message}; } finally { lock.releaseLock(); }
}

function registrarIngresoExtra(d) {
   var ss = SpreadsheetApp.getActiveSpreadsheet();
   var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
   var sAnt = Number(hC.getRange(hC.getLastRow(), 7).getValue()) || 0;
   hC.appendRow(["INC-"+Date.now(), new Date(), "Ingreso Extra: "+d.desc, "ingresos", d.monto, d.cat, sAnt + Number(d.monto)]);
   
   if ((d.cat === 'Prestamo' || d.cat === 'Préstamo / Financiación') && d.acreedor) {
       ss.getSheetByName(CONFIG.HOJAS.PASIVOS).appendRow(["PAS-"+Date.now(), new Date(), d.acreedor, d.monto, d.monto, d.fechaLimite, "Pendiente", d.desc]);
   }
   registrarEnBitacora(d.aliasOperador, "FINANZAS", "Ingreso Extra", "Monto: $" + d.monto);
   return {exito:true};
}

function abonarPasivo(d) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
        var hPas = ss.getSheetByName(CONFIG.HOJAS.PASIVOS);
        var montoAbono = Number(d.monto) || 0;
        
        var finder = hPas.getRange("A:A").createTextFinder(d.idPasivo).matchEntireCell(true).findNext();
        if(!finder) return {exito: false, error: "Pasivo no encontrado"};
        
        var r = finder.getRow();
        var nuevoSaldo = Math.max(0, Number(hPas.getRange(r, 5).getValue()) - montoAbono);
        hPas.getRange(r, 5).setValue(nuevoSaldo);
        if (nuevoSaldo <= 0) hPas.getRange(r, 7).setValue("Pagado");
        
        var sAnt = hC.getLastRow() > 1 ? Number(hC.getRange(hC.getLastRow(), 7).getValue()) || 0 : 0;
        hC.appendRow(["PAS-OUT", new Date(), "Pago a Deuda: " + d.acreedor, "egreso", montoAbono, "Pago Pasivo", sAnt - montoAbono]);
        
        registrarEnBitacora(d.aliasOperador, "FINANZAS", "Abonó a Pasivo", "Pagó $" + montoAbono);
        return {exito:true};
    } catch(e) { return {exito:false, error:e.message}; } finally { lock.releaseLock(); }
}

function editarMovimiento(d) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hC = ss.getSheetByName(CONFIG.HOJAS.CAPITAL);
    var data = hC.getDataRange().getValues();
    var found = false;
    
    for(var i=data.length-1; i>=1; i--) {
        if(String(data[i][2]).includes(d.original.desc) && Math.abs(Number(data[i][4]) - Number(d.original.monto)) < 1) {
            var oldMonto = Number(data[i][4]); var newMonto = Number(d.monto); var diffMonto = newMonto - oldMonto;
            var idRef = String(data[i][0]).trim(); var descL = String(data[i][2]).toLowerCase();

            hC.getRange(i+1, 5).setValue(newMonto);
            var partes = d.fecha.split('-'); hC.getRange(i+1, 2).setValue(new Date(partes[0], partes[1]-1, partes[2]));
            found = true;

            if ((descL.includes("abono") || descL.includes("inicial") || descL.includes("venta")) && idRef.startsWith("VEN-")) {
                var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
                var ranges = hV.getRange("A:A").createTextFinder(idRef).matchEntireCell(true).findAll();
                if (ranges && ranges.length > 0) {
                    var diffMontoRestante = diffMonto;
                    for (var k = 0; k < ranges.length; k++) {
                        var rV = ranges[k].getRow();
                        var saldoActual = Number(hV.getRange(rV, 12).getValue());
                        var diffItem = (k === ranges.length - 1) ? diffMontoRestante : (diffMonto / ranges.length);
                        diffMontoRestante -= diffItem;

                        if (descL.includes("inicial")) {
                            hV.getRange(rV, 11).setValue((Number(hV.getRange(rV, 11).getValue()) || 0) + diffItem);
                            hV.getRange(rV, 22).setValue(Math.max(0, (Number(hV.getRange(rV, 22).getValue()) || 0) - diffItem));
                        }
                        
                        var nuevoSaldo = Math.max(0, saldoActual - diffItem);
                        hV.getRange(rV, 12).setValue(nuevoSaldo);
                        if (nuevoSaldo <= 100) { hV.getRange(rV, 10).setValue("Pagado"); hV.getRange(rV, 12).setValue(0); } 
                        else if (String(hV.getRange(rV, 10).getValue()) === "Pagado" && nuevoSaldo > 100) { hV.getRange(rV, 10).setValue("Pendiente"); }
                    }
                }
            }
            registrarEnBitacora(d.aliasOperador, "FINANZAS", "Editó Caja", "Cambió " + idRef, d.justificacion);
            break;
        }
    }
    if(found) { recalcularCapitalTotal(); return { exito: true }; }
    return { exito: false, error: "Movimiento no encontrado" };
}

// =======================================================
// 6. GESTIÓN DE DIRECTORIOS (PROVEEDORES Y CRM)
// =======================================================

function registrarProveedor(d) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.PROV).appendRow([d.nombre, d.tel]);
  return { exito: true };
}

function registrarCliente(d) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.CLIENTES).appendRow([d.nombre, d.tel, new Date()]);
  registrarEnBitacora(d.aliasOperador, "CRM", "Nuevo Cliente", d.nombre);
  return { exito: true };
}

function editarClienteBackend(d) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hC = ss.getSheetByName(CONFIG.HOJAS.CLIENTES);
        var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);

        if(hC) {
            var finderC = hC.getRange("A:A").createTextFinder(d.nombreViejo).matchEntireCell(true).findNext();
            if(finderC) {
                hC.getRange(finderC.getRow(), 1, 1, 2).setValues([[d.nombreNuevo, d.telNuevo]]);
            }
        }

        if(d.nombreViejo !== d.nombreNuevo && hV) {
            var finderV = hV.getRange("C:C").createTextFinder(d.nombreViejo).matchEntireCell(true).findAll();
            finderV.forEach(f => { hV.getRange(f.getRow(), 3).setValue(d.nombreNuevo); });
        }
        
        registrarEnBitacora(d.aliasOperador, "CRM", "Editó Cliente", "De " + d.nombreViejo + " a " + d.nombreNuevo);
        return {exito: true};
    } catch(e) { return {exito: false, error: e.message}; } finally { lock.releaseLock(); }
}

function eliminarClienteBackend(d) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
        var hC = ss.getSheetByName(CONFIG.HOJAS.CLIENTES);

        if(hV) {
            var finderV = hV.getRange("C:C").createTextFinder(d.nombre).matchEntireCell(true).findAll();
            var tieneDeuda = false;
            for(var i=0; i<finderV.length; i++) {
                var r = finderV[i].getRow();
                var estado = String(hV.getRange(r, 10).getValue());
                var saldo = Number(hV.getRange(r, 12).getValue());
                if(estado === "Pendiente" && saldo > 0) {
                    tieneDeuda = true;
                    break;
                }
            }
            if(tieneDeuda) return {exito: false, error: "BLOQUEO RESTRICTIVO: El cliente posee deudas activas en la Cartera."};
        }

        if(hC) {
            var finderC = hC.getRange("A:A").createTextFinder(d.nombre).matchEntireCell(true).findNext();
            if(finderC) {
                hC.deleteRow(finderC.getRow());
                registrarEnBitacora(d.aliasOperador, "CRM", "Eliminó Cliente", d.nombre);
                return {exito: true};
            }
        }
        return {exito: false, error: "Cliente no detectado en el directorio central."};
    } catch(e) { return {exito: false, error: e.message}; } finally { lock.releaseLock(); }
}

// =======================================================
// 7. GESTIÓN DE PRODUCTOS E IMÁGENES (DRIVE)
// =======================================================

function crearProductoManual(d) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.PROD);
  var url = "";
  if (d.imagenBase64) {
      var it = DriveApp.getFoldersByName(CONFIG.IMG_FOLDER);
      var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.IMG_FOLDER);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var blob = Utilities.newBlob(Utilities.base64Decode(d.imagenBase64), d.mimeType, d.nombreArchivo);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      url = "https://drive.google.com/uc?export=view&id=" + file.getId();
  }
  h.appendRow([d.id, d.nombre, d.categoria, d.costo, d.proveedor, new Date(), d.descripcion, url, d.publico]);
  return {exito: true};
}

function guardarProductoAvanzado(d) {
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.PROD);
    var finder = h.getRange("A:A").createTextFinder(d.id).matchEntireCell(true).findNext();
    if (!finder) return { exito: false, error: "No encontrado" };
    var r = finder.getRow();
    var url = d.urlExistente; 
    if (d.imagenBase64) {
       var it = DriveApp.getFoldersByName(CONFIG.IMG_FOLDER);
       var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.IMG_FOLDER);
       var blob = Utilities.newBlob(Utilities.base64Decode(d.imagenBase64), d.mimeType, d.nombreArchivo);
       var file = folder.createFile(blob);
       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       url = "https://drive.google.com/uc?export=view&id=" + file.getId();
    }
    h.getRange(r, 2, 1, 8).setValues([[d.nombre, d.categoria, d.costo, d.proveedor, new Date(), d.descripcion, url, d.publico]]);
    return { exito: true };
}

function eliminarProductoBackend(d) {
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.PROD);
    var idTarget = typeof d === 'string' ? d : d.id;
    var alias = typeof d === 'string' ? "Sistema" : d.aliasOperador;
    var finder = h.getRange("A:A").createTextFinder(idTarget).matchEntireCell(true).findNext();
    if (finder) { 
        h.deleteRow(finder.getRow()); 
        registrarEnBitacora(alias, "INVENTARIO", "Eliminó Producto", "ID: " + idTarget);
        return { exito: true }; 
    }
    return { error: "No encontrado" };
}

// =======================================================
// 8. ENDPOINT DASHBOARD GERENCIAL (A.S.T. BI)
// =======================================================

function getDashboardData(d) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
    var hG = ss.getSheetByName(CONFIG.HOJAS.GASTOS);
    var hP = ss.getSheetByName(CONFIG.HOJAS.PROD);
    
    var anio = Number(d.anio);
    var mesBuscado = Number(d.mes) + 1; // Ajuste por array 0-index de JS

    var ventasMes = 0, costoMes = 0, utilMes = 0, deudaGlobal = 0;
    var countVentas = 0;
    var clientesMap = {};
    var historial = [];

    var flujoVentas = [0,0,0,0,0,0,0,0,0,0,0,0];
    var flujoGastos = [0,0,0,0,0,0,0,0,0,0,0,0];
    var gastosMesMap = {};

    if (hV && hV.getLastRow() > 1) {
        var dataV = hV.getRange(2, 1, hV.getLastRow()-1, 24).getValues();
        dataV.forEach(r => {
            var fM = Number(r[12]); var fA = Number(r[13]);
            var total = Number(r[7]) || 0;
            var ganancia = Number(r[16]) || 0;
            var costo = Number(r[15]) || 0;
            var saldo = Number(r[11]) || 0;
            var estado = String(r[9]);
            
            if (estado === "Pendiente" || estado === "Castigado") deudaGlobal += saldo;
            
            if (fA === anio) {
                flujoVentas[fM-1] += total;
                if (fM === mesBuscado) {
                    ventasMes += total;
                    costoMes += costo;
                    utilMes += ganancia;
                    countVentas++;
                    
                    var cName = String(r[2]).trim() || "Consumidor Final";
                    if(!clientesMap[cName]) clientesMap[cName] = 0;
                    clientesMap[cName] += total;

                    historial.push({
                        id: r[0], fechaStr: formatDate(r[1]), cliente: cName, producto: String(r[4]),
                        total: total, saldo: saldo, estado: estado, metodo: String(r[8]),
                        costo: costo, ganancia: ganancia, vendedor: String(r[17]),
                        inicial: Number(r[10])||0, cuotas: Number(r[19])||1, valCuota: Number(r[20])||0,
                        fechaLimite: formatDate(r[18])
                    });
                }
            }
        });
    }
    
    var ticketPromedio = countVentas > 0 ? (ventasMes / countVentas) : 0;
    var margenReal = ventasMes > 0 ? ((utilMes / ventasMes) * 100).toFixed(1) : 0;

    if (hG && hG.getLastRow() > 1) {
        var dataG = hG.getRange(2, 1, hG.getLastRow()-1, 5).getValues();
        dataG.forEach(r => {
            var f = new Date(r[1]);
            if (!isNaN(f.getTime()) && f.getFullYear() === anio) {
                var m = f.getMonth();
                var monto = Number(r[4]) || 0;
                flujoGastos[m] += monto;
                
                if (m + 1 === mesBuscado) {
                    utilMes -= monto; 
                    var cat = String(r[3]) || "Otros";
                    if(!gastosMesMap[cat]) gastosMesMap[cat] = 0;
                    gastosMesMap[cat] += monto;
                }
            }
        });
    }

    var topClientes = Object.keys(clientesMap).map(k => ({k: k, v: clientesMap[k]})).sort((a,b) => b.v - a.v).slice(0, 5);
    var gLabels = Object.keys(gastosMesMap);
    var gData = gLabels.map(k => gastosMesMap[k]);

    var dormidos = [];
    if (hP && hP.getLastRow() > 1) {
        var dataP = hP.getRange(2, 1, hP.getLastRow()-1, 4).getValues();
        var soldProds = historial.map(h => h.producto);
        dataP.forEach(r => {
            var name = String(r[1]);
            if (soldProds.indexOf(name) === -1 && dormidos.length < 5) {
                dormidos.push({nombre: name, costo: Number(r[3])||0});
            }
        });
    }

    return {
        exito: true,
        kpis: { ventas: ventasMes, margen: margenReal, utilidad: utilMes, deuda: deudaGlobal, ticket: ticketPromedio },
        charts: { flujoVentas: flujoVentas, flujoGastos: flujoGastos, gastosLabels: gLabels, gastosData: gData },
        listas: { clientes: topClientes, dormidos: dormidos },
        historialOperaciones: historial.reverse()
    };
}

// =======================================================
// 9. CRON JOBS Y MANTENIMIENTO
// =======================================================

function notificarCobrosDiarios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoy = new Date(); hoy.setHours(0,0,0,0); 
  var listaHtml = ""; var totalCobrar = 0; var totalPagar = 0;

  var hV = ss.getSheetByName(CONFIG.HOJAS.VENTAS);
  if (hV && hV.getLastRow() > 1) {
      var dataV = hV.getRange(2, 1, hV.getLastRow()-1, 22).getValues(); 
      dataV.forEach(function(r) {
         var estado = String(r[9]); var saldo = Number(r[11]); var fechaCobro = new Date(r[18]);
         var valCuota = Number(r[20]); var deudaInicial = Number(r[21]) || 0; 
         if(estado === "Pendiente" && saldo > 1000) {
            if (deudaInicial > 0) {
                listaHtml += "<li>🟢 <b>COBRAR A " + r[2] + "</b>: Pagar $" + deudaInicial.toLocaleString('es-CO') + " (Saldo: $" + saldo.toLocaleString('es-CO') + ") <small>⚠️ Faltante Inicial</small></li>";
                totalCobrar += deudaInicial;
            } 
            else if (fechaCobro instanceof Date && !isNaN(fechaCobro)) {
                fechaCobro.setHours(0,0,0,0);
                if(fechaCobro.getTime() <= hoy.getTime()) {
                   var diasVencido = Math.ceil(Math.abs(hoy - fechaCobro) / (1000 * 60 * 60 * 24)); 
                   var etiqueta = (fechaCobro.getTime() === hoy.getTime()) ? "🟡 Vence HOY" : "🔴 Vencido hace " + diasVencido + " días";
                   var montoCobrar = (valCuota > 0 && valCuota < saldo) ? valCuota : saldo;
                   listaHtml += "<li>🟢 <b>COBRAR A " + r[2] + "</b>: Pagar $" + montoCobrar.toLocaleString('es-CO') + " <small>" + etiqueta + "</small></li>";
                   totalCobrar += montoCobrar;
                }
            }
         }
      });
  }

  var hPas = ss.getSheetByName(CONFIG.HOJAS.PASIVOS);
  if (hPas && hPas.getLastRow() > 1) {
      var dataPas = hPas.getRange(2, 1, hPas.getLastRow()-1, 8).getValues();
      dataPas.forEach(function(r) {
         var saldo = Number(r[4]); var fechaLimite = new Date(r[5]); var estado = String(r[6]);
         if (estado !== "Pagado" && saldo > 0 && fechaLimite instanceof Date && !isNaN(fechaLimite)) {
             fechaLimite.setHours(0,0,0,0);
             if(fechaLimite.getTime() <= hoy.getTime()) {
                  listaHtml += "<li style='color: #e74c3c;'>🔴 <b>PAGAR A " + r[2] + "</b>: Cuota de $" + saldo.toLocaleString('es-CO') + "</li>";
                  totalPagar += saldo;
             }
         }
      });
  }

  if (listaHtml !== "") {
      var html = "<div style='background-color:#f0f4f8; padding: 20px; font-family: sans-serif;'><div style='background-color:#1a365d; color: white; padding: 15px; border-radius: 8px 8px 0 0;'><h3>🪐 Planet Shop - Resumen Operativo</h3></div><div style='background-color: white; padding: 20px; border-radius: 0 0 8px 8px;'><ul style='list-style-type: none; padding-left: 0; line-height: 1.6;'>" + listaHtml + "</ul><hr><p style='font-size: 1.2rem;'><b>💰 A Recaudar Hoy: <span style='color: #38a169;'>$" + totalCobrar.toLocaleString('es-CO') + "</span></b></p>";
      if(totalPagar > 0) html += "<p style='font-size: 1.2rem; color: #e53e3e;'><b>💸 A Pagar Hoy: $" + totalPagar.toLocaleString('es-CO') + "</b></p>";
      html += "</div></div>";
      MailApp.sendEmail({ to: CONFIG.ADMIN_EMAIL, subject: "Resumen Operativo Diario - Planet Shop", htmlBody: html });
  }
}

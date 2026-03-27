// ==========================================
// [MOD-004] GESTOR DE ESTADO (SINGLE SOURCE OF TRUTH)
// ==========================================

export const State = {
    // Base de Datos en Memoria
    data: {
        inv: [], 
        provs: [], 
        deud: [], 
        hist: [], 
        cats: [], 
        proveedores: [], 
        clientes: [], 
        clientesActivos: [], 
        ultimasVentas: [], 
        cotizaciones: [], 
        pasivos: []
    },
    
    // Motor Transaccional
    cart: [],
    calculatedValues: { 
        total: 0, 
        inicial: 0, 
        base: 0, 
        descuento: 0 
    },
    
    // Variables de Control y Sesión
    currentUserAlias: "Anonimo",
    usuarioForzoInicial: false,
    
    // Referencias a Instancias de Interfaz (Modales Bootstrap)
    modals: {
        edicion: null,
        nuevo: null,
        login: null,
        refinanciar: null,
        editItem: null,
        manualItem: null,
        cotizaciones: null,
        prov: null,
        clientes: null
    }
};

// ws.js - Cliente de WebSockets para comunicación en tiempo real

let socket = null;

function initWebSocket(user) {
    if (socket) {
        socket.disconnect();
    }
    
    // Inicializar conexión
    socket = io({
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('Conectado al servidor WebSocket');
        // Emitimos el ID de usuario para unirnos a la sala privada
        if (user && user.id) {
            socket.emit('join', { user_id: user.id });
        }
    });

    // Escucha de mensajes en tiempo real
    socket.on('nuevo_mensaje', (data) => {
        console.log('Nuevo mensaje recibido:', data);
        if (typeof toast === 'function') {
            toast(`Nuevo mensaje: ${data.subject || data.body}`);
        }
        
        // Aquí puedes hacer que la UI de mensajería se recargue o añada el globo de texto
        // Si el usuario tiene la lista de mensajes abierta, la recargamos
        if (typeof updateMsgBadge === 'function') updateMsgBadge();
    });

    // Escucha de notificaciones (cambios de estado, etc.)
    socket.on('nueva_notificacion', (data) => {
        console.log('Nueva notificación:', data);
        if (typeof toast === 'function') {
            toast(data.titulo);
        }
        
        // Recargar el panel de notificaciones del topbar
        if (typeof fetchNotifications === 'function') fetchNotifications(); // o la función que llene la lista
    });

    // Escucha de finalización de generación de PDFs en segundo plano
    socket.on('pdf_ready', (data) => {
        console.log('PDF Listo:', data);
        if (typeof toast === 'function') {
            toast(`✓ Documento listo: ${data.doc_label}`);
        }
        // Descargar automáticamente
        window.open(`/api/documents/${data.doc_id}/download`, '_blank');
    });

    socket.on('pdf_error', (data) => {
        console.log('Error de PDF:', data);
        if (typeof toast === 'function') {
            toast(data.msg || 'Error al generar el documento', 'warn');
        }
    });
}

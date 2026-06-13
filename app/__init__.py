"""
Fábrica de la aplicación Flask (Application Factory Pattern).

Uso:
    from app import create_app
    app = create_app('development')
"""
from flask      import Flask, send_from_directory, jsonify
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from .config    import config
from .extensions import socketio, limiter


def create_app(env: str = 'development') -> Flask:
    """Crea y configura la aplicación Flask.

    Args:
        env: 'development' (default) o 'production'

    Returns:
        Instancia configurada de Flask.
    """
    app = Flask(
        __name__,
        static_folder='../static',
        static_url_path='',
        template_folder='../templates'
    )
    app.config.from_object(config[env])

    # ─── Inicializar base de datos (Pool y Hooks) ──────────────
    from .database import init_app
    init_app(app)

    # ─── CORS ─────────────────────────────────────────────────
    port = app.config.get('PORT', 5000)
    CORS(app,
         supports_credentials=True,
         origins=[
             f'http://localhost:{port}',
             f'http://127.0.0.1:{port}',
         ])

    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')
    limiter.init_app(app)

    # ─── Blueprints (un módulo por área funcional) ─────────────
    from .routes.auth          import auth_bp
    from .routes.register      import register_bp
    from .routes.users         import users_bp
    from .routes.catalog       import catalog_bp
    from .routes.orders        import orders_bp
    from .routes.instruments   import instruments_bp
    from .routes.documents     import documents_bp
    from .routes.notifications import notifications_bp
    from .routes.pdf           import pdf_bp
    from .routes.admin         import admin_bp
    from .routes.messages      import messages_bp
    from .routes.settings      import settings_bp

    app.register_blueprint(auth_bp,          url_prefix='/api')
    app.register_blueprint(register_bp,      url_prefix='/api')
    app.register_blueprint(users_bp,         url_prefix='/api')
    app.register_blueprint(catalog_bp,       url_prefix='/api')
    app.register_blueprint(orders_bp,        url_prefix='/api')
    app.register_blueprint(instruments_bp,   url_prefix='/api')
    app.register_blueprint(documents_bp,     url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api')
    app.register_blueprint(pdf_bp,           url_prefix='/api')
    app.register_blueprint(admin_bp,         url_prefix='/api')
    app.register_blueprint(messages_bp,      url_prefix='/api')
    app.register_blueprint(settings_bp,      url_prefix='/api')
    
    # ─── Eventos de WebSocket ──────────────────────────────────
    from . import socket_events
    
    # ─── Frontend estático ────────────────────────────────────
    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:filename>')
    def static_files(filename):
        return send_from_directory(app.static_folder, filename)

    # ─── Manejo global de errores (JSON) ───────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Errores HTTP de Flask (404, 400, 401, 403, 405, etc.)
        if isinstance(e, HTTPException):
            return jsonify({
                "error": e.description,
                "status": e.code
            }), e.code
            
        # Errores internos (500)
        app.logger.error(f"Error interno: {str(e)}")
        return jsonify({
            "error": "Error interno del servidor.",
            "status": 500
        }), 500

    return app

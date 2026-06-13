"""
Configuración del sistema ESV por entorno.

Uso:
    from app.config import config
    app.config.from_object(config['development'])
"""
import os
from datetime import timedelta


class BaseConfig:
    """Configuración base compartida por todos los entornos."""
    SECRET_KEY              = os.getenv('SECRET_KEY', 'dev-insegura-cambiar-en-prod')
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_HTTPONLY = True
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    PORT                    = int(os.getenv('PORT', 5000))


class DevelopmentConfig(BaseConfig):
    """Entorno de desarrollo local.  DEBUG activo, logs visibles."""
    DEBUG   = True
    DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
    DB_PORT = int(os.getenv('DB_PORT', 5432))
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASS = os.getenv('DB_PASS', '123456')
    DB_NAME = os.getenv('DB_NAME', 'esv_calibraciones')


class ProductionConfig(BaseConfig):
    """Entorno de producción.  DEBUG apagado, todas las claves desde .env."""
    DEBUG   = False
    SESSION_COOKIE_SECURE = True
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = int(os.getenv('DB_PORT', 5432))
    DB_USER = os.getenv('DB_USER')
    DB_PASS = os.getenv('DB_PASS')
    DB_NAME = os.getenv('DB_NAME')


# Mapa de entornos
config = {
    'development': DevelopmentConfig,
    'production':  ProductionConfig,
}

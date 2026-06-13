from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Inicializamos SocketIO. cors_allowed_origins="*" permite conexiones desde cualquier origen.
# En producción se debe restringir a los dominios permitidos.
socketio = SocketIO(cors_allowed_origins="*")
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])

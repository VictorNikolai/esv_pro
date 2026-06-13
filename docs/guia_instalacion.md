# Guía de instalación y ejecución
## Ex Scientia Veritas — Sistema de Calibraciones

---

## Requisitos previos

| Programa | Versión mínima | Descarga |
|---|---|---|
| Python | 3.10+ | [python.org/downloads](https://python.org/downloads) |
| MySQL Server | 8.0+ | [mysql.com/downloads/mysql](https://mysql.com/downloads/mysql) |
| MySQL Workbench | 8.0+ | [mysql.com/products/workbench](https://mysql.com/products/workbench) |

> **Windows:** Descarga el *MySQL Installer* e instala ambos (Server + Workbench) con la opción **"Developer Default"**.

---

## PASO 1 — Crear el entorno virtual de Python

Un entorno virtual aísla las dependencias de este proyecto de las del sistema operativo.

### Abrir la terminal en la carpeta del proyecto

En Windows: haz clic derecho dentro de la carpeta `esv_calibraciones` → **"Abrir en Terminal"** (o PowerShell).

```bash
# 1. Crear el entorno virtual  (solo la primera vez)
python -m venv venv

# 2. Activarlo
#    En Windows:
venv\Scripts\activate

#    En Mac / Linux:
source venv/bin/activate
```

Sabrás que está activo porque el prompt mostrará `(venv)` al inicio:
```
(venv) C:\proyectos\esv_calibraciones>
```

> **Importante:** activa el entorno SIEMPRE antes de trabajar con el proyecto.

---

## PASO 2 — Instalar dependencias Python

```bash
# Con el entorno virtual activado:
pip install -r requirements.txt
```

Esto instala: Flask, mysql-connector, python-dotenv, werkzeug y flask-cors.

---

## PASO 3 — Configurar variables de entorno

```bash
# Copiar la plantilla
#    En Windows:
copy .env.example .env

#    En Mac / Linux:
cp .env.example .env
```

Abre `.env` con cualquier editor de texto y ajusta los valores:

```env
SECRET_KEY=pon-aqui-una-clave-secreta-larga-2026
FLASK_ENV=development
PORT=5000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=TU_CONTRASENA_DE_MYSQL
DB_NAME=esv_calibraciones
```

> El archivo `.env` **nunca** debe subirse a GitHub ni compartirse. Contiene contraseñas.

---

## PASO 4 — Crear las tablas en MySQL

### Opción A — MySQL Workbench (recomendada)

1. Abre 
2. Conéctate a tu servidor local (haz clic en la conexión que aparece)
3. Ve a **File → Open SQL Script...**
4. Abre `database/01_tablas_principales.sql`
5. Presiona el rayo ⚡ o `Ctrl + Shift + Enter` → espera mensajes en verde
6. Repite con `database/02_tabla_notificaciones.sql`

### Opción B — Línea de comandos

```bash
mysql -u root -p < database/01_tablas_principales.sql
mysql -u root -p < database/02_tabla_notificaciones.sql
```

> Si ves el error `ERROR 1049: Unknown database`, abre el script en Workbench y ejecútalo desde ahí (crea la base de datos automáticamente).

---

## PASO 5 — Crear los usuarios del sistema

```bash
# Con el entorno virtual activado:
python seed.py
```

Salida esperada:
```
  ESV — Inicializando usuarios del sistema...

  ✓  m.rios              rol: operador       clave: op2026
  ✓  j.ruiz              rol: responsable    clave: resp2026
  ✓  a.director          rol: gerencia       clave: ger2026

  Usuarios creados correctamente.
  Ahora inicia el servidor con:  python run.py
```

---

## PASO 6 — Iniciar el servidor

```bash
# Con el entorno virtual activado:
python run.py
```

Salida esperada:
```
  ╔══════════════════════════════════════╗
  ║  EX SCIENTIA VERITAS                 ║
  ║  Sistema de Calibraciones            ║
  ╚══════════════════════════════════════╝
  Servidor  →  http://127.0.0.1:5000
  Entorno   →  development
  Base de datos → esv_calibraciones
```

Abre el navegador en **http://localhost:5000**

---

## Usuarios predeterminados

| Usuario | Contraseña | Rol | Acceso |
|---|---|---|---|
| `m.rios` | `op2026` | Operador | Ingreso de datos técnicos, sin precios |
| `j.ruiz` | `resp2026` | Responsable | Precios, cotizaciones, historial |
| `a.director` | `ger2026` | Gerencia | Acceso total + gestión del catálogo |

---

## Uso diario (resumen de comandos)

```bash
# 1. Activar entorno virtual  (hacer SIEMPRE antes de iniciar)
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac / Linux

# 2. Iniciar el servidor
python run.py

# 3. Para detener el servidor: presionar Ctrl + C
```

---

## Estructura de archivos del proyecto

```
esv_calibraciones/
├── .env                   ← Tus contraseñas y configuración (NO subir a git)
├── .env.example           ← Plantilla (sí subir a git)
├── .gitignore             ← Archivos que git debe ignorar
├── requirements.txt       ← Lista de dependencias Python
├── run.py                 ← PUNTO DE ENTRADA → python run.py
├── seed.py                ← Crear usuarios iniciales → python seed.py
│
├── app/                   ← Paquete principal del servidor
│   ├── __init__.py        ← Fábrica de la app (create_app)
│   ├── config.py          ← Configuración por entorno
│   ├── database.py        ← Conexión a MySQL
│   │
│   ├── routes/            ← Un archivo por área funcional
│   │   ├── auth.py        ← Login / logout / sesión
│   │   ├── users.py       ← Gestión de usuarios
│   │   ├── catalog.py     ← Catálogo de métodos INACAL
│   │   ├── orders.py      ← Órdenes de trabajo
│   │   ├── instruments.py ← Instrumentos por orden
│   │   ├── documents.py   ← Constancias y cotizaciones
│   │   └── notifications.py ← Campana de notificaciones
│   │
│   └── utils/             ← Funciones auxiliares compartidas
│       ├── auth.py        ← Decoradores require_auth / require_role
│       └── notif.py       ← Crear y enviar notificaciones
│
├── database/              ← Scripts SQL para crear las tablas
│   ├── 01_tablas_principales.sql
│   └── 02_tabla_notificaciones.sql
│
├── static/                ← Frontend (HTML, CSS, JavaScript)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── data.js
│
└── docs/
    └── guia_instalacion.md  ← Este archivo
```

---

## Solución de problemas frecuentes

| Error | Causa probable | Solución |
|---|---|---|
| `ModuleNotFoundError: flask` | Entorno virtual no activado | Ejecuta `venv\Scripts\activate` |
| `Can't connect to MySQL` | MySQL no está corriendo | Windows: Servicios → MySQL80 → Iniciar |
| `Access denied for user` | Contraseña incorrecta en `.env` | Revisa `DB_PASS` en `.env` |
| `Table 'notifications' doesn't exist` | Solo ejecutaste el primer script SQL | Ejecuta también `02_tabla_notificaciones.sql` |
| Puerto 5000 en uso | Otro programa ocupa el puerto | Cambia `PORT=5001` en `.env` |
| `(venv)` no aparece en el prompt | El entorno no está activado | Vuelve al PASO 1 y actívalo |

---

## Agregar más usuarios

### Desde la aplicación (recomendado)
1. Inicia sesión con `a.director` / `ger2026` (Gerencia)
2. El rol Gerencia puede crear usuarios desde la interfaz

### Directamente en MySQL
```sql
-- Primero genera el hash en Python:
--   python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('nueva_clave'))"
-- Copia el resultado y pégalo aquí:

INSERT INTO users (username, password_hash, nombre, role, email)
VALUES (
  'nuevo.usuario',
  'scrypt:...PEGA_EL_HASH_AQUI...',
  'Nombre Completo',
  'responsable',
  'correo@esv.pe'
);
```

---

## Generación de PDF con WeasyPrint

### Instalación

```bash
# Con el entorno virtual activado:
pip install weasyprint==62.3
```

### Windows — dependencia adicional (GTK3)

WeasyPrint en Windows requiere GTK3 runtime. Instalar con MSYS2:

```bash
# Instalar MSYS2 desde https://www.msys2.org/
# Luego en la terminal MSYS2:
pacman -S mingw-w64-x86_64-gtk3 mingw-w64-x86_64-cairo mingw-w64-x86_64-pango

# Agregar al PATH de Windows:
# C:\msys64\mingw64\bin
```

O usar el instalador GTK para Windows:
- Descargar desde: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
- Instalar y reiniciar la terminal

### Alternativa para Windows: pdfkit + wkhtmltopdf

Si GTK3 da problemas, usar pdfkit que es más amigable en Windows:

```bash
pip install pdfkit
# Descargar wkhtmltopdf desde https://wkhtmltopdf.org/downloads.html
# Instalarlo en C:\Program Files\wkhtmltopdf\
```

Actualizar `app/routes/pdf.py` reemplazando el bloque WeasyPrint:

```python
# Reemplazar:
from weasyprint import HTML
pdf_bytes = HTML(string=html_str).write_pdf()

# Con:
import pdfkit
config    = pdfkit.configuration(wkhtmltopdf=r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe')
pdf_bytes = pdfkit.from_string(html_str, False, configuration=config,
                               options={'page-size': 'A4', 'encoding': 'UTF-8'})
```

### Endpoint disponible

```
GET /api/orders/{id}/pdf/cotizacion    — descarga Cotización PDF
GET /api/orders/{id}/pdf/constancia   — descarga Constancia de Ingreso PDF
```

Los botones "CI PDF" y "COT PDF" en el modal de documentos llaman a este endpoint.

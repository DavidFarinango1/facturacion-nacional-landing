# Facturación Nacional — Landing + Panel Administrador (AND Local Ads)

Sitio estático (HTML/CSS/JS, sin frameworks) con:

| Página | Qué es |
|---|---|
| `index.html` | Landing: hero, calculadora de ahorro real, formulario de leads, proceso en 5 pasos, clientes, sección "Facturar". |
| `login.html` | Inicio de sesión con dos tipos de acceso: **Empresa** y **Admin AND**. |
| `registro.html` | Registro Corporativo (también disponible como modal en la landing, botón "Optimizar mi gestión"). |
| `admin.html` | **Panel administrador**: dashboard, leads, empresas, facturación, configuración, administradores, actividad. |
| `empresa.html` | Panel del cliente: saldo de pauta, facturas, solicitud de recarga. |

## Cómo se conecta todo

`js/store.js` es la capa de datos compartida (guarda en `localStorage` del navegador):

- Formulario **"Deja tus datos"** de la landing → aparece en **Admin → Leads**.
- **Registro Corporativo** (página o modal) → aparece en **Admin → Empresas** como *pendiente*; el admin la **aprueba** y recién entonces la empresa puede iniciar sesión.
- **Admin → Configuración**: las tasas (ISD, IVA, comisión AND, no deducible) que usa la **calculadora de la landing** y la emisión de facturas. Cambia una y la landing se recalcula.
- **Admin → Facturas**: emitir factura nacional a una empresa aprobada (paso 2). Al **marcarla pagada** (paso 3) se recarga el saldo de pauta de la empresa (paso 4).
- **Panel empresa**, los 5 pasos con lógica real:
  1. **Monto** — solicita una recarga → se emite la factura nacional (*pendiente*).
  2. **Factura local** — botón **PDF** abre `factura.html` (imprimible / guardar como PDF).
  3. **Pago** — **Subir comprobante** (JPG/PNG/PDF + n.º de referencia) → la factura pasa a *Comprobante en revisión*. El admin lo ve en **Facturas → Ver comprobante** y lo **confirma** o lo **rechaza con motivo** (la empresa ve el motivo y vuelve a subirlo).
  4. **Pauta recargada** — al confirmar el pago, el saldo de la empresa sube por el monto de la pauta.
  5. **A pautar** — **Asignar pauta a una plataforma** (Meta / Google / TikTok / X, con nombre de campaña) descuenta del saldo; el desglose "¿En qué se gastó el saldo?" se ve en el panel de la empresa y en **Admin → Empresas → Detalle**.
- Toda acción queda en **Admin → Actividad**.

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Admin AND | `admin@and.com` | `admin123` |
| Empresa (aprobada) | `finanzas@yakupura.com` | `empresa123` |
| Empresa (aprobada) | `admin@codex.ec` | `empresa123` |

Código de invitación para crear nuevos administradores (login → Admin AND → "Registrar acceso"): `AND2025` (editable en Configuración).

En **Admin → Configuración → "Reiniciar datos de demo"** se restauran los datos de ejemplo.

## Importante

Los datos viven en el navegador (`localStorage`), no en un servidor: sirven para demostrar el flujo completo, pero no se comparten entre dispositivos ni personas. Para producción real hay que conectar `js/store.js` a un backend (cada función tiene marcado su "Punto de integración") y nunca guardar contraseñas en claro.

## Ejecutar

Abrir `index.html` directamente, o servir la carpeta: `npx serve -l 4173 .`

<div align="center">

# 💸 DinDin

### Entiende tu dinero, controla tus gastos y alcanza tus metas.

Una aplicación web de **finanzas personales** simple, visual y 100 % local.
Sin cuentas, sin registro, sin servidores de terceros: tus datos son tuyos.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Sin dependencias](https://img.shields.io/badge/dependencias-0-2e9b55?style=for-the-badge)
![Modo oscuro](https://img.shields.io/badge/modo%20oscuro-s%C3%AD-101a3a?style=for-the-badge)
![Estado](https://img.shields.io/badge/estado-en%20desarrollo-315fda?style=for-the-badge)

</div>

---

## 📖 Tabla de contenido

- [¿Qué es DinDin?](#-qué-es-dindin)
- [El problema que resuelve](#-el-problema-que-resuelve)
- [Para quién es](#-para-quién-es)
- [Funcionalidades](#-funcionalidades)
- [Privacidad: tus datos se quedan contigo](#-privacidad-tus-datos-se-quedan-contigo)
- [Cómo usarlo](#-cómo-usarlo)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Decisiones de diseño y calidad](#-decisiones-de-diseño-y-calidad)
- [Hoja de ruta](#-hoja-de-ruta)
- [Contexto académico](#-contexto-académico)
- [Autor](#-autor)

---

## 🪙 ¿Qué es DinDin?

**DinDin** es una aplicación web para **registrar, organizar y visualizar tus ingresos y gastos** sin la complejidad de una herramienta financiera profesional. Está pensada para una sola persona y funciona directamente en tu navegador: abres `index.html` y empiezas.

> *"Entiende tu dinero, controla tus gastos y alcanza tus metas."*

---

## 🎯 El problema que resuelve

Mucha gente, sobre todo quien está empezando a manejar su propio dinero, termina el mes preguntándose lo mismo. DinDin está diseñada para responder esas preguntas de un vistazo:

| La pregunta | Cómo te ayuda DinDin |
|---|---|
| 🤔 **«¿Cuánto dinero tengo realmente disponible?»** | El Dashboard muestra tu balance, ingresos, gastos y ahorro del mes. |
| 🔍 **«¿En qué se me va el dinero?»** | Cada movimiento tiene categoría; los reportes te muestran en qué gastas más. |
| 🚧 **«Siempre gasto más de lo que pensaba»** | Presupuestos por categoría con barras de progreso y alertas al acercarte al límite. |
| 🎓 **«Quiero ahorrar para algo, pero no avanzo»** | Metas de ahorro con aportes, porcentaje de progreso y fecha objetivo. |
| 📉 **«¿Estoy mejorando o empeorando?»** | Reportes que comparan el periodo actual con el anterior y calculan tu tasa de ahorro. |
| 😵 **«Las apps de finanzas son demasiado complicadas»** | Interfaz limpia, pocas pantallas y cada acción a un clic. |
| 🔒 **«No quiero darle mis datos a nadie»** | Sin login ni nube: todo se guarda en tu propio navegador. |

---

## 👥 Para quién es

Jóvenes adultos de **18 a 35 años**:

- 🎒 Estudiantes universitarios que administran una mesada o beca.
- 💼 Personas que están comenzando su vida laboral.
- 🧑‍💻 Jóvenes profesionistas que quieren ordenar sus finanzas.
- 🌱 Cualquiera que quiera crear el hábito de controlar su dinero.

---

## ✨ Funcionalidades

### 🏠 Dashboard
Tu resumen financiero en una sola pantalla: saludo personalizado, balance total, ingresos, gastos y ahorro, gráfica del flujo de dinero de los últimos meses, resumen del presupuesto, movimientos recientes y progreso de tus metas.

### 🔁 Movimientos
- Registra **ingresos y gastos** con monto, fecha, descripción, categoría y método de pago.
- **Busca y filtra** por texto, tipo, categoría y periodo.
- **Edita o elimina** cualquier movimiento, con opción de **deshacer**.
- Campo de dinero inteligente: separador de miles automático y pegado de montos en distintos formatos (`$1,200.50`, `1.200,50`…).

### 🥧 Presupuesto
- Define un **límite mensual por categoría**.
- Barras de progreso con estados: *en orden*, *cerca del límite* (≥ 80 %) y *excedido*.
- Dinero disponible por categoría y resumen visual tipo dona.
- Sugerencias de límites a partir de tu historial.

### 🎯 Metas
- Crea metas (título universitario, nuevo teléfono, viaje, fondo de emergencia…).
- Registra **aportes** (y retiros) y mira el avance en porcentaje.
- Fecha objetivo, estado calculado automáticamente y resumen general.

### 📊 Reportes
- Gastos por categoría, ingresos vs. gastos y evolución mensual.
- Periodos: mes actual, mes anterior, 3, 6 y 12 meses, año.
- **Comparación con el periodo anterior** y tasa de ahorro.
- Exportación a **CSV** y **hoja lista para imprimir**.

### 🧰 Herramientas
- Calculadora de ahorro: cuánto debes apartar cada mes para llegar a tu meta.
- Regla **50/30/20**: reparte tu ingreso entre necesidades, gustos y ahorro.

### ⚙️ Configuración
- Nombre y **moneda** (MXN, USD, EUR).
- Administración de **categorías** (crear, editar, eliminar).
- **Respaldo y restauración** de tus datos en un archivo JSON.
- Borrado total de datos y medidor de espacio usado.
- Recordatorio opcional para hacer copias de seguridad.

### 🎨 Detalles que importan
- 🌙 **Modo oscuro** con un clic (recuerda tu preferencia).
- 👋 **Bienvenida** la primera vez: empieza desde cero o explora con **datos de ejemplo**.
- 📱 **Responsive**: sidebar fija en escritorio y navegación deslizable en móvil y tableta.
- ♿ Pensada para ser accesible: contraste AA, foco visible y navegación con teclado.

---

## 🔐 Privacidad: tus datos se quedan contigo

- ❌ No hay login, registro ni autenticación.
- ❌ No hay base de datos remota ni envío de información.
- ✅ Los datos viven en el **almacenamiento local de tu navegador**.
- ✅ Puedes **exportar un respaldo** en cualquier momento y restaurarlo en otro equipo.
- ✅ Si el navegador no puede guardar (por ejemplo, en modo privado), DinDin te avisa y te ofrece descargar una copia para que no pierdas nada.

---

## 🚀 Cómo usarlo

No necesitas instalar nada ni tener internet.

```bash
# 1. Clona el repositorio
git clone https://github.com/<tu-usuario>/<tu-repositorio>.git

# 2. Entra a la carpeta
cd <tu-repositorio>

# 3. Abre index.html en tu navegador
```

También puedes simplemente **hacer doble clic en `index.html`**. Todo funciona con rutas locales (`file://`), sin servidor ni paso de compilación.

> 💡 La primera vez verás una pantalla de bienvenida. Elige **«Explorar con datos de ejemplo»** para recorrer la app con información de muestra, o **«Empezar desde cero»** para usar tus propios datos.

---

## 🗂️ Estructura del proyecto

```
dindin/
├── index.html              # Dashboard
├── pages/
│   ├── movimientos.html
│   ├── presupuesto.html
│   ├── metas.html
│   ├── reportes.html
│   ├── herramientas.html
│   └── configuracion.html
├── css/
│   └── styles.css          # Sistema de diseño (claro y oscuro)
└── js/
    ├── store.js            # Fuente única de datos y reglas de negocio
    ├── ui.js               # Modales, avisos, menús, campo de dinero
    ├── layout.js           # Sidebar, barra superior y bienvenida
    ├── theme.js            # Modo claro / oscuro
    ├── icons.js            # Iconos SVG
    └── dashboard.js · movimientos.js · presupuesto.js
        metas.js · reportes.js · configuracion.js   # Lógica de cada página
```

---

## 🛠️ Decisiones de diseño y calidad

- **HTML5 semántico, CSS3 y JavaScript vanilla.** Cero frameworks y cero dependencias.
- **Un solo `Store`** como fuente de verdad: todas las páginas leen los mismos datos, así que el balance del Dashboard siempre coincide con Movimientos, Presupuesto y Reportes.
- **Diseño consistente** basado en variables CSS (tarjetas blancas, bordes redondeados, azul como color principal) que también alimentan el modo oscuro.
- **Datos validados** al importar respaldos, para que un archivo dañado no rompa la app.
- **Pruebas de extremo a extremo** con Playwright durante el desarrollo (cálculos de totales, respaldos, fallos de guardado, menús y vista móvil).

---

## 🗺️ Hoja de ruta

- [x] **Etapa 1 — Estructura conceptual y arquitectura**
- [x] **Etapa 2 — Diseño visual e interfaces** (HTML5 + CSS3)
- [x] **Etapa 3 — Interactividad con JavaScript** (datos en el navegador)
- [ ] **Etapa 4 — Backend y persistencia**: PHP + MySQL local, con CRUD de movimientos, presupuestos y metas
- [ ] Animaciones y detalles de identidad (favicon, tipografía, logo)
- [ ] Convertidor de divisas y más herramientas financieras
- [ ] Reorganización del código en módulos y documentación técnica

---

## 🎓 Contexto académico

DinDin nace como proyecto de una materia/certificación de **desarrollo web, interactividad y diseño multimedia**, y se construye por etapas: primero la arquitectura, luego el diseño, después la interactividad y, por último, la conexión con base de datos.

---

## 👤 Autor

**Carlos Gallaga** — [@tu-usuario](https://github.com/<tu-usuario>)

---

<div align="center">

Hecho con ☕ y mucho cuidado por el dinero de todos.

⭐ Si te sirvió o te gustó el proyecto, ¡deja una estrella en el repositorio!

</div>

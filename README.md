# logpose-app

Frontend de **Logpose**, una app personal de life tracking. El nombre es una referencia a One Piece — el Log Pose es el instrumento de navegación que registra cada isla visitada.

## Qué es

Interfaz de usuario en dos plataformas que comparten los mismos datos vía sincronización con `logpose-api`:

- **Desktop** — app nativa en Linux construida con React + Tauri 2
- **Móvil** — app Android construida con React Native + Expo (APK standalone)

## Stack

| Plataforma | Tecnología |
|---|---|
| Desktop | React 19 · Vite · Tauri 2 · `@tauri-apps/plugin-sql` |
| Móvil | React Native 0.81 · Expo 54 · `expo-sqlite` |

## Módulos

| Módulo | Desktop | Móvil | Descripción |
|---|---|---|---|
| Body Weight | ✅ | ✅ | Registro de peso con gráfica de evolución y filtro por fechas |
| Gym | ✅ | ✅ | Rutinas semanales, catálogo de ejercicios, registro de series (peso + reps), gráfica de progresión |
| Calendario | ✅ | ✅ | Vistas día/semana/mes, eventos con recurrencia diaria/semanal, integración con días de gym |
| Tareas | ✅ | ✅ | Listas de tareas con items, estado completado |
| Diario | ✅ | ✅ | Entrada diaria, racha de días consecutivos, historial |
| Frases | ✅ | ✅ | Frases motivacionales con autor, se muestra una aleatoria en Inicio |
| Inicio | ✅ | ✅ | Saludo, fecha y frase del día |
| Ajustes | ✅ | ✅ | Tema visual (Normal / Cálido / Tele antigua / Pixel / Cuphead), modo oscuro/claro, idioma (ES/EN) |

## Arquitectura local-first

Todas las pantallas funcionan sin conexión. Cada registro en SQLite tiene tres campos de control:

- `server_id` — id en el servidor (null si aún no se ha sincronizado)
- `synced` — 0/1
- `pending_delete` — 1 si está marcado para borrar del servidor

El ciclo de sync se ejecuta al entrar en cada pantalla: push deletes → push unsynced → pull server → prune stale. Si el servidor no responde en 3 segundos se omite silenciosamente y los datos locales siguen siendo la fuente de verdad.

## Estructura del repo

```
logpose-app/           — app de escritorio (React + Tauri)
  src/
    App.jsx            — sidebar + routing
    db/database.js     — SQLite local: tablas, CRUD y sync helpers
    api/client.js      — llamadas HTTP a logpose-api con timeout de 3s
    *.jsx              — una pantalla por módulo
    translations/      — strings en ES e EN
logpose-mobile/        — app móvil (React Native + Expo)
  src/
    screens/           — una pantalla por módulo
    db/database.js     — SQLite local (expo-sqlite): misma lógica que desktop
    api/client.js      — llamadas HTTP (servidor en archlinux.local:8000)
    ThemeContext.js    — tema persistido en AsyncStorage
    LangContext.js     — idioma persistido en AsyncStorage
```

## Cómo arrancar en desarrollo

```bash
# Desktop — requiere Tauri para acceder a SQLite nativo
cd logpose-app && npx tauri dev

# Móvil
cd logpose-mobile && npx expo start
```

Requiere `logpose-api` corriendo con `--host 0.0.0.0` en la misma red.

El desktop usa `localhost:8000`. El móvil descubre el servidor vía mDNS (`archlinux.local:8000`).

## Compilar

```bash
# Desktop — binario nativo Linux
cd logpose-app && npx tauri build
# Binario: src-tauri/target/release/app

# Móvil — APK standalone (sin Expo Go)
cd logpose-mobile && eas build --platform android --profile preview
```

# logpose-app

Frontend de **Logpose**, una app personal de life tracking. El nombre es una referencia a One Piece — el Log Pose es el instrumento de navegación que registra cada isla visitada.

## Qué es

Interfaz de usuario en dos plataformas: escritorio (Linux) y móvil (Android). Ambas consumen la misma API REST (`logpose-api`) y comparten los datos en tiempo real.

## Stack

| Plataforma | Tecnología |
|---|---|
| Desktop | React + Vite + Tauri 2 |
| Móvil | React Native + Expo |

## Estructura del repo

```
logpose-app/     — app de escritorio (React + Tauri)
logpose-mobile/  — app móvil (React Native + Expo)
```

## Pantallas

### Desktop
| Pantalla | Contenido |
|---|---|
| Inicio | Saludo, fecha, último peso, frases motivacionales |
| Peso | Stats, formulario, filtro por fechas, gráfica, historial |
| Gym | Lista de ejercicios agrupados por músculo, CRUD completo |

### Móvil (bottom tabs)
| Pestaña | Contenido |
|---|---|
| Peso | Stats, formulario con date picker, filtro fechas, gráfica, historial |
| Inicio | Saludo, fecha, último peso, frase motivacional secuencial |
| Gym | Lista de ejercicios, CRUD completo |

## Características destacadas

**Móvil — modo local-first:** los datos de peso se guardan inmediatamente en SQLite local y se sincronizan con el servidor en segundo plano. Si el servidor no está disponible, la app sigue funcionando offline.

**Indicador de conexión:** visible en todas las pantallas, se refresca automáticamente cada 30 segundos.

**Descubrimiento de servidor:** el móvil localiza el servidor vía mDNS (`archlinux.local`). El desktop usa `localhost` al estar en el mismo equipo.

## Cómo arrancar (desarrollo)

```bash
# Desktop
cd logpose-app && npm run dev
# → http://localhost:5173

# Móvil
cd logpose-mobile && npx expo start
# Escanear QR con Expo Go (Android)
```

Requiere `logpose-api` corriendo en la misma red con `--host 0.0.0.0`.

## Compilar desktop (Tauri)

```bash
cd logpose-app && npx tauri build
# Binario en: src-tauri/target/release/app
```

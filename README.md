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

## Módulos implementados

| Módulo | Desktop | Móvil |
|---|---|---|
| Peso corporal | ✅ Stats + formulario + historial | ✅ Stats + formulario + historial + modo offline |

## Características del móvil

La app móvil funciona con arquitectura **local-first**: los datos se guardan inmediatamente en SQLite local y se sincronizan con el servidor en segundo plano cuando hay conexión. Si el servidor no está disponible, la app sigue funcionando offline y sincroniza en cuanto vuelve la conexión.

## Descubrimiento de servidor

Ambas apps localizan el servidor automáticamente via mDNS (`archlinux.local`) gracias a Avahi. No es necesario configurar IPs manualmente.

## Cómo arrancar (desarrollo)

```bash
# Desktop
cd logpose-app && npm run dev

# Móvil
cd logpose-mobile && npx expo start
# Escanear QR con Expo Go (Android)
```

Requiere `logpose-api` corriendo en la misma red.

// Servicio de notificaciones locales (móvil). Programa avisos en el propio
// dispositivo —sin servidor de push—, así que el sistema operativo los dispara
// aunque la app esté cerrada. De momento solo lo usan los recordatorios de
// hábitos; el resto de módulos se irán enganchando aquí poco a poco.
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ENABLED_KEY = 'notificationsEnabled'
const ANDROID_CHANNEL = 'reminders'

// Cómo se muestra una notificación si llega con la app en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// Inicialización al arrancar la app: canal de Android (obligatorio para que la
// notificación tenga sonido/prioridad) e idempotente, se puede llamar siempre.
export async function configureNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }
}

// Pide permiso si aún no se ha concedido. Devuelve true si quedó concedido.
export async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync()
  if (status === 'granted') return true
  const { status: asked } = await Notifications.requestPermissionsAsync()
  return asked === 'granted'
}

// Preferencia del usuario (interruptor maestro en Ajustes).
export async function isNotificationsEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1'
}

export async function setNotificationsEnabled(enabled) {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

// Días de la semana en la app: 0=lunes … 6=domingo. expo-notifications usa
// weekday 1=domingo … 7=sábado, así que convertimos.
function toExpoWeekday(appDow) {
  return ((appDow + 1) % 7) + 1
}

function parseDays(daysOfWeek) {
  return (daysOfWeek || '').split(',').filter(s => s !== '').map(Number)
}

// Texto del aviso en el idioma elegido (las notificaciones se programan fuera
// del árbol de React, así que leemos el idioma guardado en vez del contexto).
async function reminderBody() {
  const lang = await AsyncStorage.getItem('lang')
  return lang === 'es' ? '¡No rompas tu racha!' : "Don't break your streak!"
}

// Programa los avisos semanales de un hábito (uno por día marcado) a su hora.
// No hace nada si el hábito no tiene hora o no tiene días.
async function scheduleHabitReminders(habit, body) {
  if (!habit.reminder_time) return
  const [hour, minute] = habit.reminder_time.split(':').map(Number)
  for (const dow of parseDays(habit.days_of_week)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: habit.name,
        body,
        data: { type: 'habit', habitId: habit.id },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: toExpoWeekday(dow),
        hour,
        minute,
      },
    })
  }
}

// Cancela todas las notificaciones de hábitos ya programadas. Filtra por el
// data.type para no tocar avisos de otros módulos que se añadan en el futuro.
async function cancelAllHabitReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  for (const n of scheduled) {
    if (n.content?.data?.type === 'habit') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier)
    }
  }
}

// Punto de entrada: reconcilia los avisos de hábitos con el estado actual.
// Se llama al cargar/editar hábitos y al cambiar el interruptor. Reprograma
// todo desde cero (cancelar + volver a crear) para mantenerlo simple y correcto.
export async function syncHabitReminders(habits) {
  await cancelAllHabitReminders()
  if (!(await isNotificationsEnabled())) return
  if ((await Notifications.getPermissionsAsync()).status !== 'granted') return
  const body = await reminderBody()
  for (const h of habits) await scheduleHabitReminders(h, body)
}

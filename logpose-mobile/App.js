import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { ThemeProvider, useTheme } from './src/ThemeContext'
import { LangProvider, useLang } from './src/LangContext'
import BodyWeightScreen from './src/screens/BodyWeightScreen'
import HomeScreen from './src/screens/HomeScreen'
import GymScreen from './src/screens/GymScreen'
import CalendarScreen from './src/screens/CalendarScreen'
import TasksScreen from './src/screens/TasksScreen'
import QuotesScreen from './src/screens/QuotesScreen'
import JournalScreen from './src/screens/JournalScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import { isServerReachable } from './src/api/client'

const Tab = createBottomTabNavigator()

function ServerStatus({ online }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  return (
    <View style={s.statusBar}>
      <View style={[s.dot, online ? s.online : s.offline]} />
      <Text style={s.statusText}>
        {online ? tr('server.online') : tr('server.offline')}
      </Text>
    </View>
  )
}

function AppContent() {
  const [online, setOnline] = useState(false)
  const { theme: t, dark } = useTheme()
  const s = makeStyles(t)

  useEffect(() => {
    async function check() {
      setOnline(await isServerReachable())
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <View style={s.container}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ServerStatus online={online} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: t.surface,
              borderTopColor: t.surface2,
            },
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.text3,
          }}
        >
          <Tab.Screen
            name="BodyWeight"
            component={BodyWeightScreen}
            options={{
              title: 'Peso',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Gym"
            component={GymScreen}
            options={{
              title: 'Gym',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="barbell-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Calendar"
            component={CalendarScreen}
            options={{
              title: 'Calendario',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calendar-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Tasks"
            component={TasksScreen}
            options={{
              title: 'To-Do',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="checkmark-done-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Quotes"
            component={QuotesScreen}
            options={{
              title: 'Frases',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Journal"
            component={JournalScreen}
            options={{
              title: 'Diario',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book-outline" color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Ajustes',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings-outline" color={color} size={size} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  )
}

export default function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LangProvider>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:  { flex: 1, backgroundColor: t.bg },
  statusBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8, backgroundColor: t.bg },
  dot:        { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  online:     { backgroundColor: t.success },
  offline:    { backgroundColor: t.danger },
  statusText: { color: t.text3, fontSize: 11 },
})

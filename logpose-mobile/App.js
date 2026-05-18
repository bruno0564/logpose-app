import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import BodyWeightScreen from './src/screens/BodyWeightScreen'
import HomeScreen from './src/screens/HomeScreen'
import GymScreen from './src/screens/GymScreen'
import CalendarScreen from './src/screens/CalendarScreen'
import TasksScreen from './src/screens/TasksScreen'
import QuotesScreen from './src/screens/QuotesScreen'
import { isServerReachable } from './src/api/client'

const Tab = createBottomTabNavigator()

function ServerStatus({ online }) {
  return (
    <View style={s.statusBar}>
      <View style={[s.dot, online ? s.online : s.offline]} />
      <Text style={s.statusText}>
        {online ? 'Servidor conectado' : 'Sin servidor — modo local'}
      </Text>
    </View>
  )
}

export default function App() {
  const [online, setOnline] = useState(false)

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
      <StatusBar style="light" />
      <ServerStatus online={online} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: '#111',
              borderTopColor: '#1a1a1a',
            },
            tabBarActiveTintColor: '#7c3aed',
            tabBarInactiveTintColor: '#444',
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
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f0f0f' },
  statusBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8, backgroundColor: '#0f0f0f' },
  dot:        { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  online:     { backgroundColor: '#22c55e' },
  offline:    { backgroundColor: '#ef4444' },
  statusText: { color: '#444', fontSize: 11 },
})

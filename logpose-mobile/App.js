import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { ThemeProvider, useTheme } from './src/ThemeContext'
import { LangProvider, useLang } from './src/LangContext'
import BodyWeightScreen from './src/screens/BodyWeightScreen'
import HomeScreen      from './src/screens/HomeScreen'
import GymScreen       from './src/screens/GymScreen'
import CalendarScreen  from './src/screens/CalendarScreen'
import TasksScreen     from './src/screens/TasksScreen'
import QuotesScreen    from './src/screens/QuotesScreen'
import JournalScreen   from './src/screens/JournalScreen'
import SettingsScreen  from './src/screens/SettingsScreen'
import MoreScreen      from './src/screens/MoreScreen'
import { isServerReachable, initServerUrl } from './src/api/client'

const Tab = createBottomTabNavigator()

function TabIcon({ name, focused, color, cartoon }) {
  return (
    <View style={{
      backgroundColor: focused ? color + '20' : 'transparent',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 3,
      alignItems: 'center',
    }}>
      <Ionicons
        name={focused ? name : `${name}-outline`}
        size={21}
        color={color}
      />
    </View>
  )
}

function ServerStatus({ online }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const insets = useSafeAreaInsets()
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: insets.top + 6,
      paddingBottom: 8,
      backgroundColor: t.bg,
    }}>
      <View style={{
        width: 6, height: 6, borderRadius: 3, marginRight: 6,
        backgroundColor: online ? t.success : t.text4,
      }} />
      <Text style={{ color: t.text3, fontSize: 11 }}>
        {online ? tr('server.online') : tr('server.offline')}
      </Text>
    </View>
  )
}

function AppContent() {
  const [online, setOnline] = useState(false)
  const { theme: t, statusBarStyle } = useTheme()
  const { t: tr } = useLang()
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_600SemiBold, Inter_700Bold,
    LuckiestGuy: require('./assets/fonts/LuckiestGuy.ttf'),
  })

  useEffect(() => {
    let interval
    async function check() { setOnline(await isServerReachable()) }
    initServerUrl().then(() => {
      check()
      interval = setInterval(check, 30000)
    })
    return () => clearInterval(interval)
  }, [])

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />

  const icon = (name) => ({ color, focused }) => (
    <TabIcon name={name} focused={focused} color={color} cartoon={t.cartoon} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={statusBarStyle} />
      <ServerStatus online={online} />
      <NavigationContainer theme={{
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: t.bg, card: t.surface, border: t.border },
      }}>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            sceneContainerStyle: { backgroundColor: t.bg },
            tabBarShowLabel: true,
            tabBarStyle: {
              backgroundColor: t.surface,
              borderTopColor: t.cartoon ? t.text : t.border,
              borderTopWidth: t.cartoon ? 3 : 1,
            },
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.text3,
            tabBarLabelStyle: {
              fontFamily: 'Inter_600SemiBold',
              fontSize: 10,
              marginBottom: 2,
            },
            tabBarItemStyle: {
              paddingTop: 6,
            },
          }}
        >
          <Tab.Screen name="Home"       component={HomeScreen}       options={{ title: tr('nav.home'),    tabBarIcon: icon('home')     }} />
          <Tab.Screen name="Gym"        component={GymScreen}        options={{ title: tr('nav.gym'),     tabBarIcon: icon('barbell')  }} />
          <Tab.Screen name="BodyWeight" component={BodyWeightScreen} options={{ title: tr('nav.weight'),  tabBarIcon: icon('person')   }} />
          <Tab.Screen name="Journal"    component={JournalScreen}    options={{ title: tr('nav.journal'), tabBarIcon: icon('book')     }} />
          <Tab.Screen name="More"       component={MoreScreen}       options={{ title: tr('nav.more'),    tabBarIcon: icon('grid')     }} />

          {/* Ocultos — navegables desde MoreScreen */}
          <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Tasks"    component={TasksScreen}    options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Quotes"   component={QuotesScreen}   options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LangProvider>
    </SafeAreaProvider>
  )
}

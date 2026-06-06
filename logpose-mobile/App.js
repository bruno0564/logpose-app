import { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces'
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
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
import HabitsScreen    from './src/screens/HabitsScreen'
import { isServerReachable, initServerUrl } from './src/api/client'

const Tab = createBottomTabNavigator()

// Indicador de conexión discreto: solo un puntito arriba a la derecha.
// Verde tenue = servidor conectado; rojo = sin servidor (modo local).
function ServerStatus({ online }) {
  const { theme: t } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: insets.top + 4,
      paddingBottom: 4,
      backgroundColor: t.bg,
    }}>
      <View style={{
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: online ? t.success : t.danger,
        opacity: online ? 0.5 : 1,
      }} />
    </View>
  )
}

function AppContent() {
  const [online, setOnline] = useState(false)
  const { theme: t, statusBarStyle } = useTheme()
  const { t: tr } = useLang()
  const insets = useSafeAreaInsets()
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
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

  // Altura = área de contenido fija + margen de gestos del sistema
  const TAB_CONTENT_H = 58
  const tabBarHeight = TAB_CONTENT_H + insets.bottom

  const makeIcon = (name) => ({ color, focused }) => (
    <Ionicons
      name={focused ? name : `${name}-outline`}
      size={focused ? 25 : 22}
      color={color}
    />
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
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              backgroundColor: t.surface,
              borderTopWidth: t.cartoon ? 3 : StyleSheet.hairlineWidth,
              borderTopColor: t.cartoon ? t.cardBorderColor : t.border,
              height: tabBarHeight,
              paddingBottom: insets.bottom,
              paddingTop: 8,
              // Sin overflow ni márgenes — full width garantizado
              left: 0,
              right: 0,
            },
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.text3,
            tabBarLabelStyle: {
              fontFamily: t.cartoon ? 'LuckiestGuy' : 'DMSans_500Medium',
              fontSize: t.cartoon ? 8 : 10,
              textTransform: t.cartoon ? 'uppercase' : 'none',
              marginTop: 2,
            },
          }}
        >
          {/* ── 5 tabs visibles ── */}
          <Tab.Screen name="Home"       component={HomeScreen}       options={{ title: tr('nav.home'),    tabBarIcon: makeIcon('home')    }} />
          <Tab.Screen name="Gym"        component={GymScreen}        options={{ title: tr('nav.gym'),     tabBarIcon: makeIcon('barbell') }} />
          <Tab.Screen name="BodyWeight" component={BodyWeightScreen} options={{ title: tr('nav.weight'),  tabBarIcon: makeIcon('person')  }} />
          <Tab.Screen name="Journal"    component={JournalScreen}    options={{ title: tr('nav.journal'), tabBarIcon: makeIcon('book')    }} />
          <Tab.Screen name="More"       component={MoreScreen}       options={{ title: tr('nav.more'),    tabBarIcon: makeIcon('grid')    }} />

          {/* ── Ocultos — navegables desde MoreScreen ── */}
          <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
          <Tab.Screen name="Tasks"    component={TasksScreen}    options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
          <Tab.Screen name="Quotes"   component={QuotesScreen}   options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
          <Tab.Screen name="Habits"   component={HabitsScreen}   options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
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

import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import BodyWeightScreen from './src/screens/BodyWeightScreen'
import HomeScreen from './src/screens/HomeScreen'
import GymScreen from './src/screens/GymScreen'

const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
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
          name="Gym"
          component={GymScreen}
          options={{
            title: 'Gym',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

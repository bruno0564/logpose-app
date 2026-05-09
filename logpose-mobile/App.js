import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import BodyWeightScreen from './src/screens/BodyWeightScreen'

const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#111',
            borderTopColor: '#222',
          },
          tabBarActiveTintColor: '#7c3aed',
          tabBarInactiveTintColor: '#555',
        }}
      >
        <Tab.Screen
          name="BodyWeight"
          component={BodyWeightScreen}
          options={{
            title: 'Peso',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

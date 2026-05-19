import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme, lightTheme } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true)
  const theme = dark ? darkTheme : lightTheme

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved !== null) setDark(saved === 'dark')
    })
  }, [])

  function toggleTheme() {
    setDark(d => {
      const next = !d
      AsyncStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

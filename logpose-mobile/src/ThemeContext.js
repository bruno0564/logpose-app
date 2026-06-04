import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme, lightTheme, cupheadTheme } from './theme'
import { setGlobalCartoonFont } from './applyCartoonFont'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true)
  const [appStyle, setAppStyleState] = useState('normal')

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved !== null) setDark(saved === 'dark')
    })
    AsyncStorage.getItem('appStyle').then(saved => {
      if (saved !== null) setAppStyleState(saved)
    })
  }, [])

  function toggleTheme() {
    setDark(d => {
      const next = !d
      AsyncStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  function setAppStyle(style) {
    setAppStyleState(style)
    AsyncStorage.setItem('appStyle', style)
  }

  const theme = appStyle === 'cuphead'
    ? cupheadTheme
    : (dark ? darkTheme : lightTheme)

  // Aplica (o quita) la fuente cartoon globalmente antes de pintar los hijos.
  setGlobalCartoonFont(theme.cartoon ? theme.fontTitle : null)

  // Cuphead es fondo claro → la barra de estado va en oscuro
  const statusBarStyle = appStyle === 'cuphead' ? 'dark' : (dark ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, dark, toggleTheme, appStyle, setAppStyle, statusBarStyle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

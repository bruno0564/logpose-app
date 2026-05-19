import { createContext, useContext, useState } from 'react'
import { darkTheme, lightTheme } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true)
  const theme = dark ? darkTheme : lightTheme
  return (
    <ThemeContext.Provider value={{ theme, dark, toggleTheme: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

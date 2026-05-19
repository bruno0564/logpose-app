import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import en from './translations/en'
import es from './translations/es'

const LANGS = { en, es }
const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en')
  const strings = LANGS[lang]

  useEffect(() => {
    AsyncStorage.getItem('lang').then(saved => {
      if (saved && LANGS[saved]) setLang(saved)
    })
  }, [])

  function t(key, params) {
    const val = key.split('.').reduce((o, k) => o?.[k], strings)
    if (val === undefined || val === null) return key
    if (typeof val !== 'string') return val
    if (!params) return val
    return val.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
  }

  function tp(key, count, params) {
    const obj = key.split('.').reduce((o, k) => o?.[k], strings)
    if (!obj) return key
    const form = count === 1 ? obj.one : obj.other
    if (!form) return key
    const merged = { n: count, ...params }
    return form.replace(/\{(\w+)\}/g, (_, k) => String(merged[k] ?? `{${k}}`))
  }

  function locale() {
    return lang === 'en' ? 'en-US' : 'es-ES'
  }

  function saveLang(l) {
    AsyncStorage.setItem('lang', l)
    setLang(l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang: saveLang, t, tp, locale }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() { return useContext(LangContext) }

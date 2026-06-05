import { TextInput as RNTextInput, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'

/**
 * TextInput propio de la app: aplica la fuente del tema a lo que se escribe y al
 * placeholder, con la misma lógica que el <Text> propio (familia con el peso
 * dentro + fontWeight 'normal', para que Android no descarte la fuente custom).
 */
function pickFamily(fontBody, fontWeight) {
  if (!fontBody) return undefined
  const w = String(fontWeight ?? '400')
  if (w === 'bold' || w === '700' || w === '800' || w === '900') return fontBody.bold
  if (w === '500' || w === '600') return fontBody.medium
  return fontBody.regular
}

export default function TextInput({ style, ...props }) {
  const { theme: t } = useTheme()
  const flat = StyleSheet.flatten(style) || {}
  const family = flat.fontFamily || pickFamily(t.fontBody, flat.fontWeight)
  if (!family) return <RNTextInput {...props} style={style} />
  return <RNTextInput {...props} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />
}

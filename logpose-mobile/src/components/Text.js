import { Text as RNText, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'

/**
 * Text propio de la app. Resuelve de una vez el problema de fuentes en RN 0.81:
 *
 *  - En RN 0.81 `Text` es un componente de función (sin `.render`), así que el
 *    viejo parche global de `Text.render` ya no funciona.
 *  - En Android, `fontFamily` (fuente custom) + `fontWeight` a la vez = la fuente
 *    se cae a la del sistema. El peso debe ir EN EL NOMBRE de la familia.
 *
 * Este wrapper, para cada texto: elige la familia correcta (la explícita del
 * estilo si la hay —p.ej. un título en Fraunces—, o la del cuerpo según el
 * `fontWeight`) y fija `fontWeight: 'normal'` para que Android pinte la fuente.
 */
function pickFamily(fontBody, fontWeight) {
  if (!fontBody) return undefined
  const w = String(fontWeight ?? '400')
  if (w === 'bold' || w === '700' || w === '800' || w === '900') return fontBody.bold
  if (w === '500' || w === '600') return fontBody.medium
  return fontBody.regular
}

export default function Text({ style, ...props }) {
  const { theme: t } = useTheme()
  const flat = StyleSheet.flatten(style) || {}
  const family = flat.fontFamily || pickFamily(t.fontBody, flat.fontWeight)
  if (!family) return <RNText {...props} style={style} />
  return <RNText {...props} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />
}

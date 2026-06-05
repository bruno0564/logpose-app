import { View, StyleSheet } from 'react-native'
import { useTheme } from '../ThemeContext'

/**
 * Tarjeta con la sombra dura desplazada estilo Cuphead.
 *
 * Android NO sabe pintar la sombra sólida sin desenfoque y desplazada que
 * define el look cartoon: su `elevation` solo da una sombra gris difusa e
 * ignora offset/radio. Por eso la simulamos con una capa sólida detrás,
 * desplazada `offset` px hacia abajo-derecha.
 *
 * En modo normal (no cartoon) cae a la sombra nativa del tema (`t.shadow`).
 */
export default function CartoonCard({ children, style, radius = 14, offset = 5, flat = false }) {
  const { theme: t } = useTheme()

  if (!t.cartoon) {
    // `flat`: sin sombra de elevación. Útil cuando la card va dentro de un
    // contenedor animado ajustado (la sombra de elevation se sale de los
    // límites y la textura HW la recorta → parpadeo de esquinas al entrar).
    return (
      <View style={[style, {
        borderRadius: radius,
        borderWidth: t.cardBorderWidth,
        borderColor: t.cardBorderColor,
      }, !flat && t.shadow]}>
        {children}
      </View>
    )
  }

  return (
    <View style={{ marginBottom: offset, marginRight: offset }}>
      {/* capa de sombra: bloque sólido del color del trazo, desplazado */}
      <View style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: t.cardBorderColor,
          borderRadius: radius,
          transform: [{ translateX: offset }, { translateY: offset }],
        },
      ]} />
      {/* contenido real, encima */}
      <View style={[style, {
        borderRadius: radius,
        borderWidth: t.cardBorderWidth,
        borderColor: t.cardBorderColor,
      }]}>
        {children}
      </View>
    </View>
  )
}

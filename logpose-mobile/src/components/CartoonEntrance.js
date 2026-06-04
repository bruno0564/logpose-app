import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { useTheme } from '../ThemeContext'

/**
 * Anima la entrada de UN elemento, escalonando por `index`.
 * Replica las animaciones cartoon del desktop (cup-drop / cup-pop / cup-slide):
 * el muelle (spring) con poca fricción produce el rebote característico.
 *
 * - cartoon: drop (cae), pop (escala+gira) o slide (entra de lado), con bote
 * - normal:  fade + subida suave (como el viejo FadeInView, pero por elemento)
 */
export default function CartoonEntrance({ children, index = 0, type = 'drop', style }) {
  const { theme: t } = useTheme()
  const p = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(p, {
      toValue: 1,
      tension:  t.cartoon ? 70 : 60,
      friction: t.cartoon ? 6  : 9,   // fricción baja = más rebote
      delay: index * (t.cartoon ? 70 : 45),
      useNativeDriver: true,
    }).start()
  }, [])

  const opacity = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] })

  let transform
  if (!t.cartoon) {
    transform = [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
  } else if (type === 'slide') {
    transform = [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }]
  } else if (type === 'pop') {
    transform = [
      { scale:  p.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
      { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
    ]
  } else { // drop
    transform = [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }]
  }

  return (
    <Animated.View style={[style, { opacity, transform }]}>
      {children}
    </Animated.View>
  )
}

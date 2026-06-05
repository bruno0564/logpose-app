import { useRef, useCallback, useState } from 'react'
import { Animated } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../ThemeContext'

/**
 * Anima la entrada de UN elemento, escalonando por `index`.
 * Replica las animaciones cartoon del desktop (cup-drop / cup-pop / cup-slide):
 * el muelle (spring) con poca fricción produce el rebote característico.
 *
 * Usa `useFocusEffect` (no `useEffect`) para RE-animar cada vez que la pantalla
 * recibe foco: en un bottom-tab navigator las pantallas no se desmontan al
 * cambiar de pestaña, así que un useEffect([]) solo dispararía la primera vez.
 *
 * - cartoon: drop (cae), pop (escala+gira) o slide (entra de lado), con bote
 * - normal:  fade + subida suave
 */
export default function CartoonEntrance({ children, index = 0, type = 'drop', style }) {
  const { theme: t } = useTheme()
  const p = useRef(new Animated.Value(0)).current
  // textura HW solo mientras anima: evita el parpadeo de sombras/bordes en Android
  const [animating, setAnimating] = useState(true)

  useFocusEffect(
    useCallback(() => {
      p.setValue(0)
      setAnimating(true)
      const anim = Animated.spring(p, {
        toValue: 1,
        tension:  t.cartoon ? 70 : 60,
        friction: t.cartoon ? 6  : 9,   // fricción baja = más rebote
        delay: index * (t.cartoon ? 70 : 45),
        useNativeDriver: true,
      })
      anim.start(({ finished }) => { if (finished) setAnimating(false) })
      return () => anim.stop()
    }, [t.cartoon, index])
  )

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
    <Animated.View
      renderToHardwareTextureAndroid={animating}
      shouldRasterizeIOS={animating}
      style={[style, { opacity, transform }]}
    >
      {children}
    </Animated.View>
  )
}

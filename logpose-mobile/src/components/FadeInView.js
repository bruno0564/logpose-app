import { useRef, useCallback, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTheme } from '../ThemeContext'

export default function FadeInView({ children, style, delay = 0 }) {
  const { theme: t } = useTheme()
  const opacity   = useRef(new Animated.Value(0)).current
  const translate = useRef(new Animated.Value(t.cartoon ? -22 : 18)).current
  // Mientras anima, renderiza como textura HW para que Android no re-dibuje las
  // sombras/bordes de las cards en cada frame (causa del parpadeo al entrar).
  const [animating, setAnimating] = useState(true)

  // useFocusEffect (no useEffect): re-anima cada vez que la pantalla recibe
  // foco. En bottom-tabs las pantallas no se desmontan al cambiar de pestaña,
  // así que un useEffect([]) solo animaría la primera vez.
  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0)
      translate.setValue(t.cartoon ? -22 : 18)

      const fadeIn = Animated.timing(opacity, {
        toValue: 1,
        duration: t.cartoon ? 160 : 300,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
      const slide = t.cartoon
        ? Animated.spring(translate, { toValue: 0, tension: 90, friction: 7, delay, useNativeDriver: true })
        : Animated.timing(translate, { toValue: 0, duration: 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true })

      setAnimating(true)
      const anim = Animated.parallel([fadeIn, slide])
      anim.start(({ finished }) => { if (finished) setAnimating(false) })
      return () => anim.stop()
    }, [t.cartoon, delay])
  )

  // cartoon: desliza desde la izquierda (como cup-slide en el desktop)
  // normal:  sube suavemente desde abajo (translateY)
  const transform = t.cartoon
    ? [{ translateX: translate }]
    : [{ translateY: translate }]

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

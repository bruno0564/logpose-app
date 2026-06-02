import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { useTheme } from '../ThemeContext'

export default function FadeInView({ children, style, delay = 0 }) {
  const { theme: t } = useTheme()
  const opacity  = useRef(new Animated.Value(0)).current
  const translate = useRef(new Animated.Value(t.cartoon ? -22 : 14)).current

  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: t.cartoon ? 160 : 280,
      delay,
      useNativeDriver: true,
    })

    const slide = t.cartoon
      ? Animated.spring(translate, {
          toValue: 0,
          tension: 90,
          friction: 7,
          delay,
          useNativeDriver: true,
        })
      : Animated.timing(translate, {
          toValue: 0,
          duration: 280,
          delay,
          useNativeDriver: true,
        })

    Animated.parallel([fadeIn, slide]).start()
  }, [])

  // cartoon: desliza desde la izquierda (como cup-slide en el desktop)
  // normal:  sube suavemente desde abajo (translateY)
  const transform = t.cartoon
    ? [{ translateX: translate }]
    : [{ translateY: translate }]

  return (
    <Animated.View style={[style, { opacity, transform }]}>
      {children}
    </Animated.View>
  )
}

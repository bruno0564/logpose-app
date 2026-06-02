import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

export default function FadeInView({ children, style, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

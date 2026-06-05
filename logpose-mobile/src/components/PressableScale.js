import { useRef, useState } from 'react'
import { Animated, Pressable } from 'react-native'

/**
 * Botón/área táctil que se "hunde" un pelín al pulsar (escala). Da feedback
 * táctil y hace que la app se sienta viva y profesional. Sustituye a
 * TouchableOpacity cuando quieres ese efecto.
 *
 * El estilo va en la Animated.View interior (la que escala); el Pressable es
 * solo el detector de toque. Acepta los props típicos (onPress, disabled,
 * hitSlop, onLongPress…).
 */
export default function PressableScale({
  children, style, onPress, disabled, scaleTo = 0.96, ...props
}) {
  const scale = useRef(new Animated.Value(1)).current
  const [pressed, setPressed] = useState(false)
  const animate = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { if (!disabled) { setPressed(true); animate(scaleTo) } }}
      onPressOut={() => { setPressed(false); animate(1) }}
      {...props}
    >
      <Animated.View
        renderToHardwareTextureAndroid={pressed}
        style={[style, { transform: [{ scale }] }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}

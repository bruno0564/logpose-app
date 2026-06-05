import { useRef, useEffect, useState } from 'react'
import { Animated, View, StyleSheet, Easing } from 'react-native'

/**
 * Punto de "hábito hecho", réplica del desktop (.habits-check).
 *
 * - cuphead (cartoon): círculo accent + borde oscuro + sombra dura desplazada
 *   (la sombra se simula con una View sólida detrás, porque Android no pinta
 *   `shadowOffset`/`shadowRadius:0`). Equivale a `border: 2px solid var(--text)`
 *   + `box-shadow: 2px 2px 0 var(--text)`.
 * - normal: círculo accent + anillo accentLight (= `box-shadow: 0 0 0 2px var(--accent-subtle)`).
 *
 * Animaciones:
 * - entrada "pop": muelle con rebote (escala 0→~1.3→1) + rotación, igual que
 *   `@keyframes habits-check-pop`.
 * - salida: encoge + rota + se desvanece. Para poder animar la salida hay que
 *   mantener el punto montado hasta que la animación termina (RN no anima el
 *   desmontaje), por eso el estado `mounted`.
 */
export default function HabitCheck({ done, t }) {
  const p = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(done)

  useEffect(() => {
    if (done) {
      setMounted(true)
      const anim = Animated.spring(p, {
        toValue: 1,
        tension: 80,
        friction: 5,        // fricción baja = sobrepasa a ~1.3 y rebota (el "pop")
        useNativeDriver: true,
      })
      anim.start()
      return () => anim.stop()
    }
    // salida: encoge con anticipación y al terminar se desmonta
    const anim = Animated.timing(p, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.back(1.5)),
      useNativeDriver: true,
    })
    anim.start(({ finished }) => { if (finished) setMounted(false) })
    return () => anim.stop()
  }, [done])

  if (!mounted) return null

  const rotate  = p.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] })
  const opacity = p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] })

  const s = makeStyles(t)
  return (
    <Animated.View style={[s.wrap, { opacity, transform: [{ scale: p }, { rotate }] }]}>
      <View style={s.behind} />
      <View style={s.dot} />
    </Animated.View>
  )
}

function makeStyles(t) {
  const cartoon = t.cartoon
  return StyleSheet.create({
    wrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    behind: cartoon
      ? { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: t.cardBorderColor, transform: [{ translateX: 2 }, { translateY: 2 }] }
      : { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: t.accentLight },
    dot: cartoon
      ? { width: 16, height: 16, borderRadius: 8, backgroundColor: t.accent, borderWidth: 2, borderColor: t.cardBorderColor }
      : { width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent },
  })
}

import { useRef, useState, useEffect } from 'react'
import { Animated, PanResponder, View, Dimensions, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// Galería de imágenes a pantalla completa: deslizar cambia de foto, pinch amplía
// y, ampliada, se arrastra dentro de la foto. UN SOLO PanResponder maneja todos
// los gestos (sin FlatList) para que el pinch no se pelee con el deslizamiento.
const { width: W, height: H } = Dimensions.get('window')
const MAX_SCALE = 5
const SWIPE_THRESHOLD = W * 0.22

export default function ImageGallery({ images, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const indexRef = useRef(initialIndex)
  const setIdx = (i) => { indexRef.current = i; setIndex(i) }

  const scale = useRef(new Animated.Value(1)).current
  const tx = useRef(new Animated.Value(0)).current
  const ty = useRef(new Animated.Value(0)).current
  const liveScale = useRef(1)            // escala actual en vivo (síncrona)
  const lastTranslate = useRef({ x: 0, y: 0 })
  const pinch = useRef({ baseDistance: null, baseScale: 1 })

  useEffect(() => {
    const id = scale.addListener(({ value }) => { liveScale.current = value })
    return () => scale.removeListener(id)
  }, [scale])

  const resetZoom = (animated) => {
    lastTranslate.current = { x: 0, y: 0 }
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, useNativeDriver: true }),
      ]).start()
    } else {
      scale.setValue(1); tx.setValue(0); ty.setValue(0)
    }
  }

  const distance = (touches) => {
    const dx = touches[0].pageX - touches[1].pageX
    const dy = touches[0].pageY - touches[1].pageY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { pinch.current.baseDistance = null },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches
        if (touches.length === 2) {
          const d = distance(touches)
          if (pinch.current.baseDistance == null) {
            pinch.current.baseDistance = d
            pinch.current.baseScale = liveScale.current
          }
          const next = pinch.current.baseScale * (d / pinch.current.baseDistance)
          scale.setValue(Math.max(1, Math.min(MAX_SCALE, next)))
        } else if (touches.length === 1) {
          if (liveScale.current > 1) {
            // Ampliada: arrastrar mueve la foto.
            tx.setValue(lastTranslate.current.x + g.dx)
            ty.setValue(lastTranslate.current.y + g.dy)
          } else {
            // Sin zoom: feedback de deslizamiento horizontal.
            tx.setValue(g.dx)
          }
        }
      },
      onPanResponderRelease: (evt, g) => {
        pinch.current.baseDistance = null
        if (liveScale.current > 1.01) {
          // Ampliada: confirmamos el desplazamiento del pan.
          tx.stopAnimation((v) => { lastTranslate.current.x = v })
          ty.stopAnimation((v) => { lastTranslate.current.y = v })
          return
        }
        // Sin zoom: decidir si cambiamos de foto o volvemos al centro.
        const n = images.length
        if (g.dx <= -SWIPE_THRESHOLD && indexRef.current < n - 1) {
          setIdx(indexRef.current + 1); resetZoom(false)
        } else if (g.dx >= SWIPE_THRESHOLD && indexRef.current > 0) {
          setIdx(indexRef.current - 1); resetZoom(false)
        } else {
          resetZoom(true)
        }
      },
    })
  ).current

  const img = images[index]
  if (!img) return null

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
      <Animated.Image
        {...pan.panHandlers}
        source={{ uri: img.local_uri }}
        resizeMode="contain"
        style={{ width: W, height: H, transform: [{ scale }, { translateX: tx }, { translateY: ty }] }}
      />
      <TouchableOpacity
        onPress={onClose}
        hitSlop={12}
        style={{ position: 'absolute', top: 40, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

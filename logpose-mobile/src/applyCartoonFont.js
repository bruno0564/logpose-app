import { Text } from 'react-native'
import { cloneElement } from 'react'

/**
 * React Native no hereda fuentes (no hay "font-family del body" como en CSS).
 * Para que el tema Cuphead use su fuente en TODA la app sin tocar cientos de
 * estilos, interceptamos el render del Text por defecto e inyectamos la fuente.
 *
 * El estilo propio del elemento va DESPUÉS, así un `fontFamily` explícito
 * (p.ej. un título con otra fuente) sigue ganando.
 *
 * Reactividad: `globalFont` se actualiza desde ThemeContext en cada cambio de
 * tema; como cambiar de tema re-renderiza el árbol, los Text vuelven a pasar
 * por aquí y aplican la fuente nueva.
 */
let globalFont = null  // null = sin override (modo normal)

export function setGlobalCartoonFont(font) {
  globalFont = font || null
}

const origRender = Text.render
if (origRender && !Text.__cartoonPatched) {
  Text.__cartoonPatched = true
  Text.render = function (...args) {
    const el = origRender.apply(this, args)
    if (!globalFont) return el
    return cloneElement(el, {
      style: [{ fontFamily: globalFont }, el.props.style],
    })
  }
}

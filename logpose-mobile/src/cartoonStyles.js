/**
 * Helpers de estilo cartoon reutilizables entre pantallas.
 */

// Contorno duro de los títulos (el text-shadow del desktop cuphead).
// Devuelve {} en modo normal para no tocar el render no-cartoon.
// OJO: en Android textShadowRadius:0 NO se pinta — necesita un radio mínimo.
export function titleShadow(t) {
  if (!t.cartoon) return {}
  return {
    textShadowColor:  t.cardBorderColor,
    textShadowOffset: { width: 2.5, height: 2.5 },
    textShadowRadius: 1,
  }
}

// Borde + radio de las cards cartoon (uso suelto, fuera de CartoonCard).
export function cartoonBorder(t, radius = 14) {
  if (!t.cartoon) return { borderRadius: radius }
  return {
    borderRadius: radius,
    borderWidth: t.cardBorderWidth,
    borderColor: t.cardBorderColor,
  }
}

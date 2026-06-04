/**
 * Helpers de estilo cartoon reutilizables entre pantallas.
 */

// Contorno duro de los títulos (el text-shadow del desktop cuphead).
// Devuelve {} en modo normal para no tocar el render no-cartoon.
export function titleShadow(t) {
  if (!t.cartoon) return {}
  return {
    textShadowColor:  t.cardBorderColor,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
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

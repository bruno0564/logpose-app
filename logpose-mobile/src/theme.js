// Tema "Bitácora / Instrumento": neutros tinta azul-verde, acento latón (la aguja
// de la brújula), teal náutico como secundario. Identidad propia, no plantilla.
export const darkTheme = {
  bg:             '#0b1519',
  surface:        '#10212a',
  surface2:       '#162c36',
  inputBg:        '#13262f',
  border:         '#1d3540',
  border2:        '#244350',
  accent:         '#d9a441',   // latón / dorado apagado
  accentSecond:   '#3a9d92',   // teal náutico
  accentGradient: ['#d9a441', '#3a9d92'],
  accentLight:    'rgba(217,164,65,0.14)',
  text:           '#eaf0ec',
  text2:          '#9fb0ab',
  text3:          '#5e726f',
  text4:          '#2b3d43',
  danger:         '#e5544b',
  dangerBg:       '#5e1f1b',
  dangerText:     '#f3a39c',
  success:        '#46b08a',
  // Cartoon-aware (estilo normal: sin tratamiento cartoon)
  cartoon:        false,
  fontTitle:      'Fraunces_600SemiBold',   // serif con carácter (titulares / números hero)
  fontBody:       { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' },
  cardBorderWidth: 1,
  cardBorderColor: '#1d3540',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
}

// Variante clara de "Bitácora": fondo carta náutica (cálido suave, no blanco
// clínico), tinta navy para el texto, latón más hondo para contraste.
export const lightTheme = {
  bg:             '#f4efe4',
  surface:        '#fbf8f1',
  surface2:       '#f1ece0',
  inputBg:        '#f7f2e8',
  border:         '#e3dccb',
  border2:        '#d8cfb8',
  accent:         '#b07a1c',   // latón más hondo (contraste sobre claro)
  accentSecond:   '#2f7d74',   // teal náutico
  accentGradient: ['#b07a1c', '#2f7d74'],
  accentLight:    'rgba(176,122,28,0.12)',
  text:           '#13242c',   // tinta navy
  text2:          '#4a5a5c',
  text3:          '#8a8270',
  text4:          '#d8cfb8',
  danger:         '#c0392b',
  dangerBg:       '#f6e0dc',
  dangerText:     '#9a2a1e',
  success:        '#2f7d5e',
  cartoon:        false,
  fontTitle:      'Fraunces_600SemiBold',   // serif con carácter (titulares / números hero)
  fontBody:       { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' },
  cardBorderWidth: 1,
  cardBorderColor: '#e3dccb',
  shadow: {
    shadowColor: '#3a2f14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
}

// Mismo palette que el desktop [data-style="cuphead"] (theme.css).
// Es un tema único (no tiene variante oscura): papel crema + rojo + marrón.
export const cupheadTheme = {
  bg:             '#f0d9a0',
  surface:        '#faecc8',
  surface2:       '#f5e4b8',
  inputBg:        '#faecc8',
  border:         'rgba(24,8,0,0.15)',
  border2:        'rgba(24,8,0,0.28)',
  accent:         '#c01818',
  accentSecond:   '#8a3a0a',
  accentGradient: ['#c01818', '#8a3a0a'],
  accentLight:    'rgba(192,24,24,0.12)',
  text:           '#180800',
  text2:          '#8a3a0a',
  text3:          '#a87840',
  text4:          '#c09860',
  danger:         '#c01818',
  dangerBg:       'rgba(192,24,24,0.12)',
  dangerText:     '#c01818',
  success:        '#2a7c1e',
  // Cartoon-aware: bordes gruesos, fuente chunky y sombra dura desplazada
  cartoon:        true,
  fontTitle:      'LuckiestGuy',
  fontBody:       { regular: 'LuckiestGuy', medium: 'LuckiestGuy', bold: 'LuckiestGuy' },
  cardBorderWidth: 3,
  cardBorderColor: '#180800',
  shadow: {
    shadowColor: '#180800',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
}

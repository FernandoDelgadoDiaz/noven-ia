const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'

function horaOperativa(fecha: Date): number {
  const hora = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_OPERATIVA,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(fecha)

  return Number.parseInt(hora, 10)
}

export function primerNombre(nombre: string | null | undefined): string | null {
  const limpio = nombre?.trim()
  if (!limpio) return null
  return limpio.split(/\s+/)[0] ?? null
}

export function saludoDashboard(
  nombre: string | null | undefined,
  fecha: Date = new Date(),
): string {
  const hora = horaOperativa(fecha)
  const saludo = hora < 12
    ? 'Buenos días'
    : hora < 18
      ? 'Buenas tardes'
      : 'Buenas noches'
  const nombreCorto = primerNombre(nombre)

  return nombreCorto ? `${saludo}, ${nombreCorto} 👋` : `${saludo} 👋`
}

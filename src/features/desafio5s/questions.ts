export type SKey = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

export type Desafio5SQuestion = {
  id: string
  s: SKey
  prompt: string
  options: string[]
  correctIndex: number
}

export const DESAFIO_5S_QUESTIONS: Desafio5SQuestion[] = [
  { id:'s1-1', s:'S1', prompt:'En tu sector hay materiales que no se utilizan hace meses. ¿Qué hacés primero?', options:['Buscar un lugar donde entren todos','Ordenarlos por tamaño','Determinar cuáles son realmente necesarios','Dejarlos hasta que falte espacio'], correctIndex:2 },
  { id:'s1-2', s:'S1', prompt:'Encontrás dos elementos que cumplen la misma función y uno casi nunca se utiliza. ¿Qué corresponde?', options:['Descartarlo inmediatamente','Guardarlos juntos porque son iguales','Llevar el que no se usa a otro sector','Evaluar si realmente es necesario conservar ambos'], correctIndex:3 },
  { id:'s1-3', s:'S1', prompt:'Un sector está acomodado, pero contiene materiales que ya no son necesarios. ¿Cumple correctamente 5S?', options:['Sí, porque está ordenado','Sí, si nada está en el piso','No, primero deberían permanecer sólo los elementos necesarios','Sí, si todos tienen etiqueta'], correctIndex:2 },
  { id:'s2-1', s:'S2', prompt:'Usás un elemento muchas veces durante la jornada, pero está lejos del lugar de trabajo. ¿Qué harías?', options:['Dejarlo donde siempre estuvo','Dejarlo siempre sobre la mesa','Comprar otro','Definir una ubicación accesible próxima al punto de uso'], correctIndex:3 },
  { id:'s2-2', s:'S2', prompt:'Dos compañeros guardan la misma herramienta en lugares diferentes. ¿Cuál es el problema?', options:['Ninguno','No tiene una ubicación única y definida','Falta una segunda herramienta','Debe quedar siempre visible'], correctIndex:1 },
  { id:'s2-3', s:'S2', prompt:'Terminaste de utilizar una herramienta que otro compañero necesitará más tarde. ¿Qué hacés?', options:['Se la dejás sobre su puesto','La devolvés a su ubicación definida','La guardás donde haya espacio','La dejás visible'], correctIndex:1 },
  { id:'s3-1', s:'S3', prompt:'Todos los días aparece suciedad debajo del mismo equipo. ¿Qué representa mejor aplicar 5S?', options:['Limpiarla al final del día','Colocar algo debajo','Limpiar e investigar qué la origina','Esperar a la limpieza general'], correctIndex:2 },
  { id:'s3-2', s:'S3', prompt:'Durante una tarea se produce un derrame. ¿Cuál es la conducta correcta?', options:['Esperar al horario de limpieza','Actuar según el procedimiento y recuperar cuanto antes la condición segura y limpia','Cubrirlo temporalmente','Avisar al siguiente turno'], correctIndex:1 },
  { id:'s3-3', s:'S3', prompt:'¿Quién contribuye a mantener limpio y ordenado un puesto?', options:['Sólo maestranza','Sólo el encargado','Todas las personas que utilizan el espacio según sus responsabilidades','El último turno'], correctIndex:2 },
  { id:'s4-1', s:'S4', prompt:'Cada integrante guarda correctamente los elementos, pero cada uno en lugares diferentes. ¿Qué falta?', options:['Limpieza','Más espacio','Un criterio común','Más elementos'], correctIndex:2 },
  { id:'s4-2', s:'S4', prompt:'Sólo el encargado sabe dónde corresponde cada elemento. ¿Está bien estandarizado?', options:['Sí','Sí, si nunca falta','No, el criterio debe ser claro para todo el equipo','No, todo debería guardarse junto'], correctIndex:2 },
  { id:'s4-3', s:'S4', prompt:'¿Para qué sirve identificar claramente las ubicaciones?', options:['Para que se vea más prolijo','Para que cualquiera reconozca dónde corresponde cada elemento','Para evitar limpiar','Para almacenar más'], correctIndex:1 },
  { id:'s5-1', s:'S5', prompt:'Se hizo una jornada 5S y el sector quedó impecable. Un mes después volvió al desorden. ¿Qué falló?', options:['Clasificar','Ordenar','Limpiar','Sostener'], correctIndex:3 },
  { id:'s5-2', s:'S5', prompt:'¿Cuándo puede considerarse que 5S funciona realmente?', options:['Cuando queda impecable antes de una visita','Cuando las condiciones acordadas se mantienen como parte habitual del trabajo','Cuando hay muchos carteles','Cuando se hace limpieza profunda semanal'], correctIndex:1 },
  { id:'s5-3', s:'S5', prompt:'Al comenzar tu turno detectás que el puesto no cumple el estándar acordado. ¿Qué hacés?', options:['Lo dejás igual','Recuperás el estándar dentro de tus responsabilidades y comunicás el desvío si corresponde','Esperás al responsable','Lo corregís al final'], correctIndex:1 },
]

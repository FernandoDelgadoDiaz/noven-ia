import { supabase } from '../../lib/supabase'
import type { Desafio5SSector } from './config'

export type EvalSession = { evaluacionId:string; accessToken:string }
export type InicioResult = EvalSession & { status:'started'|'in_progress'|'completed'; respondidas?:number; puntaje?:number; porcentaje?:number; resultado?:string }
export type Pregunta = { orden:number; total:number; pregunta_id:string; pregunta:string; imagen_url:string|null; tipo:'situacional'|'fotografica'; opciones:string[] }
export type Resultado = { puntaje:number; porcentaje:number; resultado:string; por_s:Record<string,number> }
export type Ranking = { mi_posicion:number|null; mi_puntaje:number; mi_porcentaje:number; top10:Array<{posicion:number;nombre:string;sector:string;puntaje:number;porcentaje:number}>; sectores:Array<{posicion:number;sector:string;promedio:number;evaluados:number;afianzados:number}> }

function unwrap<T>(data:T|null,error:{message:string}|null):T{
  if(error) throw new Error(error.message)
  if(!data) throw new Error('Sin respuesta del servidor')
  return data
}

export async function iniciarEvaluacion(input:{legajo:string;nombre:string;apellido:string;sector:Desafio5SSector}):Promise<InicioResult>{
  const {data,error}=await supabase.rpc('desafio5s_iniciar',{p_legajo:input.legajo,p_nombre:input.nombre,p_apellido:input.apellido,p_sector:input.sector})
  const d=unwrap<any>(data,error)
  return {status:d.status,evaluacionId:d.evaluacion_id,accessToken:d.access_token,respondidas:d.respondidas,puntaje:d.puntaje,porcentaje:Number(d.porcentaje??0),resultado:d.resultado}
}

export async function obtenerPregunta(session:EvalSession,orden:number):Promise<Pregunta>{
  const {data,error}=await supabase.rpc('desafio5s_pregunta',{p_evaluacion_id:session.evaluacionId,p_access_token:session.accessToken,p_orden:orden})
  return unwrap<Pregunta>(data,error)
}

export async function responder(session:EvalSession,orden:number,opcionPosicion:number){
  const {data,error}=await supabase.rpc('desafio5s_responder',{p_evaluacion_id:session.evaluacionId,p_access_token:session.accessToken,p_orden:orden,p_opcion_posicion:opcionPosicion})
  return unwrap<any>(data,error)
}

export async function obtenerResultado(session:EvalSession):Promise<Resultado>{
  const {data,error}=await supabase.rpc('desafio5s_resultado',{p_evaluacion_id:session.evaluacionId,p_access_token:session.accessToken})
  return unwrap<Resultado>(data,error)
}

export async function obtenerRanking(session:EvalSession):Promise<Ranking>{
  const {data,error}=await supabase.rpc('desafio5s_ranking',{p_evaluacion_id:session.evaluacionId,p_access_token:session.accessToken})
  return unwrap<Ranking>(data,error)
}

export async function accesoRankingPorLegajo(legajo:string):Promise<EvalSession>{
  const {data,error}=await supabase.rpc('desafio5s_acceso_ranking',{p_legajo:legajo})
  const d=unwrap<any>(data,error)
  return {evaluacionId:d.evaluacion_id,accessToken:d.access_token}
}

export async function iniciarPruebaAdmin():Promise<EvalSession>{
  const {data,error}=await supabase.rpc('desafio5s_admin_iniciar_prueba')
  const d=unwrap<any>(data,error)
  return {evaluacionId:d.evaluacion_id,accessToken:d.access_token}
}

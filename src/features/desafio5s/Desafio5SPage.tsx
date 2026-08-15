import { FormEvent, useState } from 'react'
import { DESAFIO_5S_SECTORES, type Desafio5SSector } from './config'
import { accesoRankingPorLegajo, iniciarEvaluacion, iniciarPruebaAdmin, obtenerPregunta, obtenerRanking, obtenerResultado, responder, type EvalSession, type Pregunta, type Ranking, type Resultado } from './api'
import './desafio5s.css'

type Person = { nombre:string; apellido:string; legajo:string; sector:Desafio5SSector }
type Screen = 'home'|'quiz'|'result'|'rankingAccess'|'ranking'

export default function Desafio5SPage(){
  const [screen,setScreen]=useState<Screen>('home')
  const [person,setPerson]=useState<Person>({nombre:'',apellido:'',legajo:'',sector:'Salón'})
  const [session,setSession]=useState<EvalSession|null>(null)
  const [question,setQuestion]=useState<Pregunta|null>(null)
  const [result,setResult]=useState<Resultado|null>(null)
  const [ranking,setRanking]=useState<Ranking|null>(null)
  const [testMode,setTestMode]=useState(false)
  const [rankingLegajo,setRankingLegajo]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function loadQuestion(s:EvalSession,orden:number){
    setQuestion(await obtenerPregunta(s,orden))
    setScreen('quiz')
  }

  async function start(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('')
    try{
      const started=await iniciarEvaluacion(person)
      const s={evaluacionId:started.evaluacionId,accessToken:started.accessToken}; setSession(s); setTestMode(false)
      if(started.status==='completed'){
        setResult(await obtenerResultado(s)); setScreen('result'); return
      }
      const next=Math.min((started.respondidas??0)+1,15)
      await loadQuestion(s,next)
    }catch(err){setError(err instanceof Error?err.message:'No se pudo iniciar la evaluación')}
    finally{setBusy(false)}
  }

  async function startAdminTest(){
    setBusy(true);setError('')
    try{
      const s=await iniciarPruebaAdmin(); setSession(s);setTestMode(true);setResult(null);setRanking(null);await loadQuestion(s,1)
    }catch(err){setError('Para usar Modo Prueba, ingresá previamente como administrador autorizado. '+(err instanceof Error?err.message:''))}
    finally{setBusy(false)}
  }

  async function answer(optionIndex:number){
    if(!session||!question||busy)return
    setBusy(true);setError('')
    try{
      const r=await responder(session,question.orden,optionIndex+1)
      if(r.status==='completed'){
        setResult(await obtenerResultado(session));setScreen('result')
      }else await loadQuestion(session,question.orden+1)
    }catch(err){setError(err instanceof Error?err.message:'No se pudo guardar la respuesta')}
    finally{setBusy(false)}
  }

  async function showRanking(s=session){
    if(!s)return
    setBusy(true);setError('')
    try{setRanking(await obtenerRanking(s));setScreen('ranking')}
    catch(err){setError(err instanceof Error?err.message:'No se pudo cargar el ranking')}
    finally{setBusy(false)}
  }

  async function rankingByLegajo(e:FormEvent){
    e.preventDefault();setBusy(true);setError('')
    try{const s=await accesoRankingPorLegajo(rankingLegajo);setSession(s);setRanking(await obtenerRanking(s));setScreen('ranking')}
    catch(err){setError(err instanceof Error?err.message:'No se encontró una evaluación finalizada')}
    finally{setBusy(false)}
  }

  return <main className="d5-app">
    <header className="d5-header"><div className="d5-brand">LA ANÓNIMA</div><span>DESAFÍO 5S</span></header>
    {testMode&&<div className="d5-test">MODO PRUEBA ADMINISTRADOR · NO COMPUTA EN RESULTADOS</div>}
    {error&&<div className="d5-error">{error}</div>}

    {screen==='home'&&<section className="d5-home">
      <div className="d5-hero"><p>CAPACITACIÓN INTERNA</p><h1>Desafío<br/><strong>5S</strong></h1><span>15 situaciones · 5 principios · una forma de trabajar mejor.</span></div>
      <form className="d5-card" onSubmit={start}>
        <h2>Identificate para comenzar</h2>
        <label>Nombre<input required value={person.nombre} onChange={e=>setPerson({...person,nombre:e.target.value})}/></label>
        <label>Apellido<input required value={person.apellido} onChange={e=>setPerson({...person,apellido:e.target.value})}/></label>
        <label>Legajo<input required value={person.legajo} onChange={e=>setPerson({...person,legajo:e.target.value})}/></label>
        <label>Sector<select value={person.sector} onChange={e=>setPerson({...person,sector:e.target.value as Desafio5SSector})}>{DESAFIO_5S_SECTORES.map(s=><option key={s}>{s}</option>)}</select></label>
        <button className="d5-primary" disabled={busy}>{busy?'INGRESANDO...':'COMENZAR DESAFÍO'}</button>
        <button type="button" className="d5-link" onClick={()=>{setError('');setScreen('rankingAccess')}}>Ya participé · Ver ranking</button>
        <button type="button" className="d5-admin" disabled={busy} onClick={startAdminTest}>Administrador · Modo prueba</button>
      </form>
    </section>}

    {screen==='rankingAccess'&&<section className="d5-result"><form className="d5-card" onSubmit={rankingByLegajo}><h2>Ver ranking</h2><p>Ingresá tu legajo. El acceso está disponible sólo después de haber finalizado el desafío.</p><label>Legajo<input autoFocus required value={rankingLegajo} onChange={e=>setRankingLegajo(e.target.value)}/></label><button className="d5-primary" disabled={busy}>INGRESAR</button><button type="button" className="d5-secondary" onClick={()=>setScreen('home')}>VOLVER</button></form></section>}

    {screen==='quiz'&&question&&<section className="d5-quiz">
      <div className="d5-progress"><span>Pregunta {question.orden} de {question.total}</span><b>{Math.round((question.orden/question.total)*100)}%</b><div><i style={{width:`${(question.orden/question.total)*100}%`}}/></div></div>
      <article className="d5-question">{question.imagen_url&&<img className="d5-photo" src={question.imagen_url} alt="Situación real de la sucursal"/>}<h2>{question.pregunta}</h2><div className="d5-options">{question.opciones.map((o,i)=><button disabled={busy} key={`${i}-${o}`} onClick={()=>answer(i)}><b>{String.fromCharCode(65+i)}</b>{o}</button>)}</div></article>
      <p className="d5-footnote">Elegí la opción que mejor representa cómo aplicarías 5S en el trabajo.</p>
    </section>}

    {screen==='result'&&result&&<section className="d5-result">
      <div className="d5-score"><small>DESAFÍO COMPLETADO</small><strong>{result.puntaje}<span>/15</span></strong><b>{Number(result.porcentaje).toFixed(1)}%</b></div>
      <h2>{result.resultado.split('_').join(' ')}</h2>
      <div className="d5-breakdown">{[1,2,3,4,5].map(s=><div key={s}><span>S{s}</span><b>{result.por_s?.[`S${s}`]??0}/3</b></div>)}</div>
      <p>{testMode?'Esta partida fue de prueba y no modifica ningún ranking ni estadística oficial.':'Tu evaluación oficial quedó finalizada. Ese legajo no puede volver a realizarla.'}</p>
      {!testMode&&<button className="d5-primary" disabled={busy} onClick={()=>showRanking()}>VER RANKING</button>}
      {testMode&&<button className="d5-primary" disabled={busy} onClick={startAdminTest}>PROBAR NUEVAMENTE</button>}
      <button className="d5-secondary" onClick={()=>{setTestMode(false);setScreen('home');setError('')}}>VOLVER AL INICIO</button>
    </section>}

    {screen==='ranking'&&ranking&&<section className="d5-ranking"><p>RESULTADOS EN VIVO</p><h1>Ranking 5S</h1><div className="d5-my-rank">Tu posición actual: <strong>{ranking.mi_posicion?`${ranking.mi_posicion}°`:'—'}</strong> · {ranking.mi_puntaje}/15</div><h3>Ranking individual</h3><div className="d5-table">{ranking.top10.map(r=><div key={`${r.posicion}-${r.nombre}`}><b>{r.posicion}°</b><span>{r.nombre}</span><small>{r.sector}</small><strong>{Number(r.porcentaje).toFixed(1)}%</strong></div>)}</div><h3>Ranking por sectores</h3><div className="d5-table">{ranking.sectores.map(r=><div key={r.sector}><b>{r.posicion}°</b><span>{r.sector}</span><small>{r.evaluados} evaluados</small><strong>{Number(r.promedio).toFixed(1)}%</strong></div>)}</div><button className="d5-secondary" onClick={()=>setScreen('home')}>VOLVER</button></section>}
  </main>
}

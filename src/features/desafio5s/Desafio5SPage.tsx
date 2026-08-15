import { FormEvent, useMemo, useState } from 'react'
import { DESAFIO_5S_SECTORES, type Desafio5SSector } from './config'
import { DESAFIO_5S_QUESTIONS } from './questions'
import './desafio5s.css'

type Person = { nombre:string; apellido:string; legajo:string; sector:Desafio5SSector }
type Screen = 'home'|'quiz'|'result'|'ranking'

const shuffle = <T,>(values:T[]) => [...values].sort(() => Math.random() - .5)

export default function Desafio5SPage(){
  const [screen,setScreen]=useState<Screen>('home')
  const [person,setPerson]=useState<Person>({nombre:'',apellido:'',legajo:'',sector:'Salón'})
  const [testMode,setTestMode]=useState(false)
  const [questions,setQuestions]=useState(DESAFIO_5S_QUESTIONS)
  const [index,setIndex]=useState(0)
  const [answers,setAnswers]=useState<number[]>([])

  const score=useMemo(()=>answers.reduce((sum,a,i)=>sum+(a===questions[i]?.correctIndex?1:0),0),[answers,questions])
  const percent=Math.round((score/15)*100)
  const status=score>=12?'CONOCIMIENTO AFIANZADO':score>=9?'REQUIERE REFUERZO':'REQUIERE REEVALUACIÓN'

  function start(e:FormEvent){
    e.preventDefault()
    if(!testMode && (!person.nombre.trim()||!person.apellido.trim()||!person.legajo.trim())) return
    setQuestions(shuffle(DESAFIO_5S_QUESTIONS))
    setAnswers([]);setIndex(0);setScreen('quiz')
  }
  function answer(option:number){
    const next=[...answers,option]; setAnswers(next)
    if(index===14) setScreen('result'); else setIndex(index+1)
  }
  function restartTest(){ setQuestions(shuffle(DESAFIO_5S_QUESTIONS));setAnswers([]);setIndex(0);setScreen('quiz') }
  const q=questions[index]

  return <main className="d5-app">
    <header className="d5-header"><div className="d5-brand">LA ANÓNIMA</div><span>DESAFÍO 5S</span></header>
    {testMode&&<div className="d5-test">MODO PRUEBA ADMINISTRADOR · NO COMPUTA EN RESULTADOS</div>}

    {screen==='home'&&<section className="d5-home">
      <div className="d5-hero"><p>CAPACITACIÓN INTERNA</p><h1>Desafío<br/><strong>5S</strong></h1><span>15 situaciones · 5 principios · una forma de trabajar mejor.</span></div>
      <form className="d5-card" onSubmit={start}>
        <h2>Identificate para comenzar</h2>
        <label>Nombre<input value={person.nombre} disabled={testMode} onChange={e=>setPerson({...person,nombre:e.target.value})}/></label>
        <label>Apellido<input value={person.apellido} disabled={testMode} onChange={e=>setPerson({...person,apellido:e.target.value})}/></label>
        <label>Legajo<input inputMode="numeric" value={person.legajo} disabled={testMode} onChange={e=>setPerson({...person,legajo:e.target.value})}/></label>
        <label>Sector<select value={person.sector} disabled={testMode} onChange={e=>setPerson({...person,sector:e.target.value as Desafio5SSector})}>{DESAFIO_5S_SECTORES.map(s=><option key={s}>{s}</option>)}</select></label>
        <button className="d5-primary">COMENZAR DESAFÍO</button>
        <button type="button" className="d5-link" onClick={()=>setScreen('ranking')}>Ya participé · Ver ranking</button>
        <button type="button" className="d5-admin" onClick={()=>setTestMode(v=>!v)}>{testMode?'Salir del modo prueba':'Administrador · Modo prueba'}</button>
      </form>
    </section>}

    {screen==='quiz'&&q&&<section className="d5-quiz">
      <div className="d5-progress"><span>Pregunta {index+1} de 15</span><b>{Math.round(((index+1)/15)*100)}%</b><div><i style={{width:`${((index+1)/15)*100}%`}}/></div></div>
      <article className="d5-question"><span className="d5-pill">{q.s}</span><h2>{q.prompt}</h2><div className="d5-options">{q.options.map((o,i)=><button key={o} onClick={()=>answer(i)}><b>{String.fromCharCode(65+i)}</b>{o}</button>)}</div></article>
      <p className="d5-footnote">Elegí la opción que mejor representa cómo aplicarías 5S en el trabajo.</p>
    </section>}

    {screen==='result'&&<section className="d5-result">
      <div className="d5-score"><small>DESAFÍO COMPLETADO</small><strong>{score}<span>/15</span></strong><b>{percent}%</b></div>
      <h2>{status}</h2><p>{testMode?'Esta partida fue de prueba y no modifica ningún ranking.':'Tu participación quedó finalizada. El resultado oficial no puede repetirse con el mismo legajo.'}</p>
      <button className="d5-primary" onClick={()=>setScreen('ranking')}>VER RANKING</button>
      {testMode&&<button className="d5-secondary" onClick={restartTest}>PROBAR NUEVAMENTE</button>}
    </section>}

    {screen==='ranking'&&<section className="d5-ranking"><p>RESULTADOS EN VIVO</p><h1>Ranking 5S</h1><div className="d5-podium"><div><b>2</b><strong>Panadería</strong><span>89%</span></div><div><b>1</b><strong>Carnicería</strong><span>92%</span></div><div><b>3</b><strong>Salón</strong><span>87%</span></div></div><div className="d5-ranking-note">Vista de diseño. Los datos reales se alimentarán exclusivamente de participaciones oficiales.</div><button className="d5-secondary" onClick={()=>setScreen(testMode?'result':'home')}>VOLVER</button></section>}
  </main>
}

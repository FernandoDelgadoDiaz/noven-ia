import { useEffect, useMemo, useState } from 'react'
import { habilitarReevaluacion, obtenerAdminDashboard, type AdminDashboard } from './api'
import './desafio5s.css'

export default function Desafio5SAdminPage(){
  const [data,setData]=useState<AdminDashboard|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [filter,setFilter]=useState('')
  const [onlyAction,setOnlyAction]=useState(false)

  async function refresh(){
    setBusy(true);setError('')
    try{setData(await obtenerAdminDashboard())}
    catch(e){setError(e instanceof Error?e.message:'No se pudo cargar el panel')}
    finally{setBusy(false)}
  }
  useEffect(()=>{void refresh()},[])

  const personas=useMemo(()=>{
    const all=data?.personas??[]
    return all.filter(p=>{
      const term=filter.trim().toLowerCase()
      const match=!term||`${p.nombre} ${p.legajo} ${p.sector}`.toLowerCase().includes(term)
      const action=!onlyAction||p.resultado!=='AFIANZADO'
      return match&&action
    })
  },[data,filter,onlyAction])

  async function enable(legajo:string){
    if(!window.confirm(`¿Habilitar una nueva evaluación para el legajo ${legajo}?`))return
    setBusy(true);setError('')
    try{await habilitarReevaluacion(legajo);await refresh()}
    catch(e){setError(e instanceof Error?e.message:'No se pudo habilitar la reevaluación')}
    finally{setBusy(false)}
  }

  if(!data)return <main className="d5-app"><section className="d5-result"><h2>Panel Desafío 5S</h2><p>{busy?'Cargando resultados...':error||'Sin datos'}</p></section></main>
  const g=data.general
  return <main className="d5-app">
    <header className="d5-header"><div className="d5-brand">LA ANÓNIMA</div><span>DESAFÍO 5S · ADMIN</span></header>
    {error&&<div className="d5-error">{error}</div>}
    <section className="d5-admin-page">
      <div className="d5-admin-title"><div><p>RELEVAMIENTO EN VIVO</p><h1>Panel de resultados</h1></div><button className="d5-secondary" disabled={busy} onClick={refresh}>ACTUALIZAR</button></div>
      <div className="d5-kpis">
        <div><span>Evaluados</span><b>{g.evaluados}/{g.esperados}</b></div>
        <div><span>Pendientes</span><b>{g.pendientes}</b></div>
        <div><span>Afianzados</span><b>{g.afianzados}</b></div>
        <div><span>Refuerzo</span><b>{g.refuerzo}</b></div>
        <div><span>Reevaluación</span><b>{g.reevaluacion}</b></div>
        <div><span>Promedio</span><b>{Number(g.promedio).toFixed(1)}%</b></div>
      </div>

      <div className="d5-admin-grid">
        <article><h3>Resultado por S</h3><div className="d5-s-bars">{data.por_s.map(x=><div key={x.s}><span>{x.s}</span><div><i style={{width:`${x.porcentaje}%`}}/></div><b>{Number(x.porcentaje).toFixed(1)}%</b></div>)}</div></article>
        <article><h3>Resultado por sector</h3><div className="d5-sector-list">{data.sectores.map(s=><div key={s.sector}><span>{s.sector}</span><small>{s.evaluados} evaluados</small><b>{Number(s.promedio).toFixed(1)}%</b></div>)}</div></article>
      </div>

      <article className="d5-people"><div className="d5-people-head"><h3>Colaboradores</h3><div><input placeholder="Buscar nombre, legajo o sector" value={filter} onChange={e=>setFilter(e.target.value)}/><label><input type="checkbox" checked={onlyAction} onChange={e=>setOnlyAction(e.target.checked)}/> Sólo requieren acción</label></div></div>
        <div className="d5-admin-table"><div className="head"><b>Colaborador</b><b>Sector</b><b>Resultado</b><b>Puntaje</b><b>Acción</b></div>{personas.map(p=><div key={p.legajo}><span><strong>{p.nombre}</strong><small>Legajo {p.legajo}</small></span><span>{p.sector}</span><span>{p.resultado.split('_').join(' ')}</span><b>{p.puntaje}/15 · {Number(p.porcentaje).toFixed(1)}%</b><button disabled={busy} onClick={()=>enable(p.legajo)}>HABILITAR REEVALUACIÓN</button></div>)}</div>
      </article>
    </section>
  </main>
}

import React, { useState } from 'react'
export const Tabs = ({ defaultValue, children, className='' }:{ defaultValue:string, children?:any, className?:string }) => {
  const [val, setVal] = useState(defaultValue)
  return <div className={className}>
    {React.Children.map(children, (c:any)=>React.cloneElement(c, { val, setVal }))}
  </div>
}
export const TabsList = ({ children, val, setVal }:{ children?: any, val?:string, setVal?:(v:string)=>void }) => (
  <div className="inline-flex bg-slate-200 rounded-xl p-1">{React.Children.map(children, (c:any)=>React.cloneElement(c, { val, setVal }))}</div>
)
export const TabsTrigger = ({ value, children, val, setVal }:{ value:string, children?:React.ReactNode, val?:string, setVal?:(v:string)=>void }) => (
  <button onClick={()=>setVal?.(value)} className={`px-3 py-1 rounded-lg ${val===value?'bg-white shadow':''}`}>{children}</button>
)
export const TabsContent = ({ value, children, val }:{ value:string, children?:React.ReactNode, val?:string }) => val===value ? <div>{children}</div> : null

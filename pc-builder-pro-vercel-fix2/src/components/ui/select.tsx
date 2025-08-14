import React, { useState } from 'react'
export const Select = ({ value, onValueChange, children }:{ value?: string, onValueChange?: (v:string)=>void, children?: React.ReactNode }) => {
  const [open, setOpen] = useState(false)
  const arr = React.Children.toArray(children) as React.ReactElement[]
  const match = arr.find(el => React.isValidElement(el) && (el.props as any).value === value) as React.ReactElement | undefined
  const text = match ? match.props.children : (value || '')
  return <div className="relative w-full">
    <button className="border rounded-xl px-3 py-2 w-full text-left" onClick={()=>setOpen(o=>!o)}>{text || 'เลือก'}</button>
    {open && <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl max-h-56 overflow-auto shadow">
      {arr.map((child, i) => React.isValidElement(child) ? React.cloneElement(child, { key: i, onSelect: (v:string)=>{ onValueChange?.(v); setOpen(false);} }) : child)}
    </div>}
  </div>
}
export const SelectTrigger = ({ className='', children }:{className?:string, children?:React.ReactNode}) => <div className={className}>{children}</div>
export const SelectValue = ({ placeholder }:{placeholder?:string}) => <span className="text-slate-500">{placeholder}</span>
export const SelectContent = ({ children }:{children?: React.ReactNode}) => <div>{children}</div>
export const SelectItem = ({ value, children, onSelect }:{ value:string, children?:React.ReactNode, onSelect?:(v:string)=>void }) => (
  <div className="px-3 py-2 hover:bg-slate-100 cursor-pointer" onClick={()=>onSelect?.(value)}>{children}</div>
)

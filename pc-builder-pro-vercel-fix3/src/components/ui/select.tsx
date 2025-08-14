import React, { useState } from 'react'

type SelectProps = {
  value?: string
  onValueChange?: (v: string) => void
  children?: React.ReactNode
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false)

  const arr = React.Children.toArray(children) as React.ReactElement[]
  const match = arr.find(el => React.isValidElement(el) && (el.props as any).value === value) as React.ReactElement | undefined
  const text = match ? (match.props as any).children : (value || '')

  return (
    <div className="relative w-full">
      <button type="button" className="border rounded-xl px-3 py-2 w-full text-left" onClick={() => setOpen(o => !o)}>
        {text || 'เลือก'}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl max-h-56 overflow-auto shadow">
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return child
            return React.cloneElement(child as React.ReactElement<any>, {
              onSelect: (v: string) => { onValueChange?.(v); setOpen(false) }
            } as any)
          })}
        </div>
      )}
    </div>
  )
}

export const SelectTrigger: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className='', children }) => (
  <div className={className}>{children}</div>
)

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span className="text-slate-500">{placeholder}</span>
)

export const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>

type SelectItemProps = {
  value: string
  onSelect?: (v: string) => void
  children?: React.ReactNode
}
export const SelectItem: React.FC<SelectItemProps> = ({ value, onSelect, children }) => (
  <div role="option" className="px-3 py-2 hover:bg-slate-100 cursor-pointer" onClick={() => onSelect?.(value)}>
    {children}
  </div>
)

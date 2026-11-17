import type { InputHTMLAttributes, ReactNode } from 'react'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  requiredMark?: boolean
  children?: ReactNode
}

export default function FormField({ id, label, error, requiredMark, children, ...inputProps }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const mark = requiredMark ? <span className="required-mark" aria-hidden="true">*</span> : null
  const message = error ? <span className="field-error" id={errorId}>{error}</span> : null

  // Custom controls (file, tags) contain their own buttons, which cannot sit inside the caption label.
  if (children) {
    return (
      <div className="form-field">
        <label htmlFor={id}>{label}{mark}</label>
        {children}
        {message}
      </div>
    )
  }

  return (
    <label className="form-field" htmlFor={id}>
      {requiredMark ? <span>{label}{mark}</span> : label}
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={errorId} {...inputProps} />
      {message}
    </label>
  )
}

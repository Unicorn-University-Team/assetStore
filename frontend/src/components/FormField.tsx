import type { InputHTMLAttributes } from 'react'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}

export default function FormField({ id, label, error, ...inputProps }: FormFieldProps) {
  return (
    <label className="form-field" htmlFor={id}>
      {label}
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </label>
  )
}

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  label: string
}

// A row of toggle buttons that filters a table by status, e.g. open / resolved / rejected.
export default function StatusFilter<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div className="filter-tabs" role="group" aria-label={label}>
      {options.map((item) => (
        <button type="button" key={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}
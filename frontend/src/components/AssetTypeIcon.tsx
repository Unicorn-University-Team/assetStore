const PATHS: Record<string, string> = {
  '3d': 'M6 1 L11 3.5 V8.5 L6 11 L1 8.5 V3.5 Z M1 3.5 L6 6 L11 3.5 M6 6 V11',
  map: 'M1 3 L4 2 L8 3 L11 2 V10 L8 11 L4 10 L1 11 Z M4 2 V10 M8 3 V11',
  environment: 'M1 10.5 L4.5 4 L7 8 L8.5 6 L11 10.5 Z',
  '2d': 'M1.5 2 H10.5 V10 H1.5 Z M1.5 8.5 L4.5 6 L7 8 L8.5 7 L10.5 8.5 M8 4.5 h0.01',
  sound: 'M2 5 V7 M4 3 V9 M6 1.5 V10.5 M8 3 V9 M10 5 V7',
}

export default function AssetTypeIcon({ type }: { type: string }) {
  return (
    <svg className="asset-type-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[type] ?? PATHS['3d']} />
    </svg>
  )
}

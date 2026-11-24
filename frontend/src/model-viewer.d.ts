// <model-viewer> (@google/model-viewer) for JSX: the attributes AssetPreview uses. The element registers itself
// when its module is imported (AssetPreview loads it only for 3D assets).
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string
        alt: string
        'camera-controls'?: string
        'auto-rotate'?: string
        'touch-action'?: string
        'shadow-intensity'?: string
        'interaction-prompt'?: string
      }
    }
  }
}

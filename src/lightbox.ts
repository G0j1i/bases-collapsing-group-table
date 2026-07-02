import { App } from 'obsidian'

export interface LightboxField {
  label: string
  value: string
}

export interface LightboxItem {
  src: string
  title: string
  fields: LightboxField[]
  // File size in bytes, when known (shown alongside pixel dimensions).
  size?: number
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// A minimal full-screen image viewer for the cards view: prev/next (arrows,
// side buttons, swipe, keys), close (Esc, double-click, swipe-down, outside
// click), and a fade-in info box at the top-right. Self-contained — appended to
// the active document's body and torn down on close, no Component needed.
export const openLightbox = (app: App, items: LightboxItem[], start: number): void => {
  if (items.length === 0) return
  let index = Math.max(0, Math.min(start, items.length - 1))

  // Use activeDocument (not the global `document`) so it works in popout windows;
  // capture it once so open and close target the same document.
  const doc = activeDocument
  const overlay = doc.body.createDiv('bcgt-lightbox')
  const img = overlay.createEl('img', { cls: 'bcgt-lightbox-img', attr: { draggable: 'false' } })
  const info = overlay.createDiv('bcgt-lightbox-info')

  const prevBtn = overlay.createEl('button', {
    cls: 'bcgt-lightbox-nav bcgt-lightbox-prev',
    text: '←',
    attr: { 'aria-label': 'Previous' },
  })
  const nextBtn = overlay.createEl('button', {
    cls: 'bcgt-lightbox-nav bcgt-lightbox-next',
    text: '→',
    attr: { 'aria-label': 'Next' },
  })
  const closeBtn = overlay.createEl('button', {
    cls: 'bcgt-lightbox-close',
    text: '✕',
    attr: { 'aria-label': 'Close' },
  })
  // A single image has nothing to page through.
  if (items.length <= 1) {
    prevBtn.addClass('bcgt-hidden')
    nextBtn.addClass('bcgt-hidden')
  }

  const render = (): void => {
    const item = items[index]
    info.empty()
    info.createDiv({ cls: 'bcgt-lightbox-title', text: item.title })
    info.createDiv({ cls: 'bcgt-lightbox-counter', text: `${index + 1} / ${items.length}` })
    // Size is known now; pixel dimensions only after the image loads.
    const meta = info.createDiv({ cls: 'bcgt-lightbox-meta' })
    const sizeStr = item.size != null ? formatBytes(item.size) : ''
    meta.setText(sizeStr)
    img.onload = (): void => {
      const dims = `${img.naturalWidth} × ${img.naturalHeight}`
      meta.setText(sizeStr ? `${dims} · ${sizeStr}` : dims)
    }
    img.src = item.src
    for (const f of item.fields) {
      const row = info.createDiv('bcgt-lightbox-field')
      row.createSpan({ cls: 'bcgt-lightbox-flabel', text: f.label })
      row.createSpan({ cls: 'bcgt-lightbox-fvalue', text: f.value })
    }
  }

  const go = (delta: number): void => {
    index = (index + delta + items.length) % items.length
    render()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }
  const close = (): void => {
    doc.removeEventListener('keydown', onKey)
    overlay.remove()
  }

  doc.addEventListener('keydown', onKey)
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    go(-1)
  })
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    go(1)
  })
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })
  // Keep double-clicking a control from bubbling up to the close-on-dblclick.
  for (const el of [prevBtn, nextBtn, closeBtn, info]) {
    el.addEventListener('dblclick', (e) => e.stopPropagation())
    el.addEventListener('click', (e) => e.stopPropagation())
  }
  overlay.addEventListener('dblclick', () => close())
  // Single-click on the dark area outside the image closes; clicking the image
  // itself does nothing (double-click closes it).
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  // Touch: horizontal swipe pages, a downward swipe closes.
  let sx = 0
  let sy = 0
  overlay.addEventListener(
    'touchstart',
    (e) => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    },
    { passive: true },
  )
  overlay.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) go(dx > 0 ? -1 : 1)
      else if (dy > 60 && dy > Math.abs(dx)) close()
    },
    { passive: true },
  )

  render()
}

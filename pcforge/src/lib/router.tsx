import React, { useEffect, useState } from 'react'

// Minimal hash router: '#/path?query'

export function useRoute(): { path: string; query: URLSearchParams } {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, '') || '/')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#/, '') || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const [path, qs] = hash.split('?')
  return { path: path || '/', query: new URLSearchParams(qs ?? '') }
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`
  window.scrollTo({ top: 0 })
}

export function Link({ to, children, className, onClick, title }: {
  to: string; children: React.ReactNode; className?: string; onClick?: () => void; title?: string
}) {
  return (
    <a
      href={`#${to}`}
      className={className}
      title={title}
      onClick={e => {
        e.preventDefault()
        onClick?.()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

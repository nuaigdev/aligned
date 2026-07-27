'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy portal link'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? '#3B6D11' : '#888780', display: 'flex', padding: '4px',
        transition: 'color .15s',
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

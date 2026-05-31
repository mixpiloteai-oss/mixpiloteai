import React, { useState, useRef, useEffect } from 'react'
import { GUIDE_SECTIONS, type GuideSection } from './UserGuideData'

interface UserGuidePanelProps {
  onClose: () => void
}

export default function UserGuidePanel({ onClose }: UserGuidePanelProps) {
  const [selectedId, setSelectedId] = useState<string>(GUIDE_SECTIONS[0].id)
  const [search, setSearch] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const filteredSections: GuideSection[] = search.trim()
    ? GUIDE_SECTIONS.filter(section =>
        section.title.toLowerCase().includes(search.toLowerCase()) ||
        section.steps.some(
          step =>
            step.action.toLowerCase().includes(search.toLowerCase()) ||
            step.description.toLowerCase().includes(search.toLowerCase())
        )
      )
    : GUIDE_SECTIONS

  const activeSection: GuideSection | undefined =
    filteredSections.find(s => s.id === selectedId) ?? filteredSections[0]

  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find(s => s.id === selectedId)) {
      setSelectedId(filteredSections[0].id)
    }
  }, [filteredSections, selectedId])

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [selectedId])

  const badgeStyle: React.CSSProperties = {
    background: '#0a0a14',
    border: '1px solid #2a2a4e',
    borderRadius: 4,
    padding: '2px 8px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#10b981',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          maxHeight: '85vh',
          background: '#0d0d1a',
          border: '1px solid #1a1a2e',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            background: '#0a0a14',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
            📖 Guide Utilisateur Neurotek Studio
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 4,
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid #1a1a2e' }}>
          <input
            type="text"
            placeholder="Rechercher dans le guide…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#111128',
              border: '1px solid #2a2a4e',
              borderRadius: 6,
              color: '#e2e8f0',
              fontSize: 13,
              padding: '8px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: '1px solid #1a1a2e',
              overflowY: 'auto',
              padding: '8px 0',
              background: '#0a0a14',
            }}
          >
            {filteredSections.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 12, padding: '16px', textAlign: 'center' }}>
                Aucun résultat
              </div>
            ) : (
              filteredSections.map(section => {
                const isActive = section.id === (activeSection?.id ?? '')
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedId(section.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '9px 16px',
                      background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? '3px solid #7c3aed' : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: isActive ? '#e2e8f0' : '#94a3b8',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{section.icon}</span>
                    <span style={{ flex: 1, lineHeight: 1.3 }}>{section.title}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
            }}
          >
            {!activeSection ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>
                Sélectionner une section dans la liste.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 20,
                    paddingBottom: 12,
                    borderBottom: '1px solid #1a1a2e',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{activeSection.icon}</span>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
                    {activeSection.title}
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeSection.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: 14,
                        padding: '12px 14px',
                        background: '#0a0a14',
                        borderRadius: 8,
                        border: '1px solid #1a1a2e',
                      }}
                    >
                      {/* Step number */}
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: '#7c3aed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>
                            {step.action}
                          </span>
                          {step.shortcut && (
                            <span style={badgeStyle}>{step.shortcut}</span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

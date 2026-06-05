import React, { useState, useCallback } from 'react'
import { useBrowserStore } from '../../store/browserStore'
import type { FolderNode } from '../../audio/browser/types'

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:           '#08080f',
  hover:        'rgba(255,255,255,0.03)',
  selectedBg:   'rgba(124,58,237,0.15)',
  selectedBdr:  '#7c3aed',
  text:         '#94a3b8',
  countText:    '#3f4966',
  scrollbar:    'rgba(255,255,255,0.06)',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────
interface FolderNodeItemProps {
  node:         FolderNode
  depth:        number
  selectedPath: string | null
  onSelect:     (path: string | null) => void
  initExpanded: boolean
}

// ─── FolderNodeItem ───────────────────────────────────────────────────────────
function FolderNodeItem({
  node,
  depth,
  selectedPath,
  onSelect,
  initExpanded,
}: FolderNodeItemProps): React.ReactElement {
  const [expanded, setExpanded] = useState<boolean>(initExpanded)

  const hasChildren = node.children.length > 0
  const isSelected  = selectedPath === node.path
  const indentPx    = depth * 12

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((v) => !v)
  }, [])

  const handleSelect = useCallback(() => {
    onSelect(isSelected ? null : node.path)
  }, [isSelected, node.path, onSelect])

  return (
    <div>
      <div
        onClick={handleSelect}
        style={{
          display:         'flex',
          alignItems:      'center',
          paddingLeft:     indentPx + 6,
          paddingRight:    8,
          height:          22,
          cursor:          'pointer',
          userSelect:      'none',
          backgroundColor: isSelected ? C.selectedBg : 'transparent',
          borderLeft:      isSelected ? `2px solid ${C.selectedBdr}` : '2px solid transparent',
          fontSize:        10,
          color:           C.text,
          boxSizing:       'border-box',
          transition:      'background-color 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = C.hover
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
          }
        }}
      >
        {/* Toggle arrow */}
        <span
          onClick={hasChildren ? handleToggle : undefined}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          14,
            flexShrink:     0,
            color:          hasChildren ? '#6b7a99' : 'transparent',
            fontSize:       8,
            cursor:         hasChildren ? 'pointer' : 'default',
            marginRight:    2,
          }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : ''}
        </span>

        {/* Folder icon */}
        <span style={{ marginRight: 5, fontSize: 11, flexShrink: 0 }}>📁</span>

        {/* Name */}
        <span
          style={{
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {node.name || 'root'}
        </span>

        {/* Count badge */}
        <span
          style={{
            color:      C.countText,
            fontSize:   9,
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          {node.count.toLocaleString()}
        </span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              initExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FolderTree ───────────────────────────────────────────────────────────────
export default function FolderTree(): React.ReactElement {
  const folderTree     = useBrowserStore((s) => s.folderTree)
  const selectedFolder = useBrowserStore((s) => s.selectedFolder)
  const setSelected    = useBrowserStore((s) => s.setSelectedFolder)

  if (folderTree === null) {
    return (
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flex:           1,
          color:          '#3f4966',
          fontSize:       10,
          padding:        16,
          textAlign:      'center',
          userSelect:     'none',
        }}
      >
        No folders loaded.
        <br />
        Add a folder to start.
      </div>
    )
  }

  return (
    <div
      style={{
        flex:       1,
        overflowY:  'auto',
        overflowX:  'hidden',
        background: C.bg,
        paddingTop: 4,
        paddingBottom: 8,
        // Subtle scrollbar
        scrollbarWidth:       'thin',
        scrollbarColor:       `${C.scrollbar} transparent`,
      }}
    >
      <FolderNodeItem
        node={folderTree}
        depth={0}
        selectedPath={selectedFolder}
        onSelect={setSelected}
        initExpanded
      />
    </div>
  )
}

import Editor from '@monaco-editor/react'

export function CodeView({
  value,
  height = 320,
  readOnly = true,
  onChange,
  language = 'json',
  className,
}: {
  value: string
  height?: number | string
  readOnly?: boolean
  onChange?: (v: string) => void
  language?: string
  className?: string
}) {
  return (
    <div className={className} style={{ height }}>
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        theme="vs"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          lineHeight: 19,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          folding: true,
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          padding: { top: 10, bottom: 10 },
          wordWrap: 'on',
        }}
      />
    </div>
  )
}

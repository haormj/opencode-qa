import { useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { Button } from 'antd'

interface CustomComposerProps {
  placeholder?: string
  onSend: (type: string, text: string) => void
  typing?: boolean
  onStop?: () => void
  disabled?: boolean
  text?: string
  textOnce?: string
}

export interface CustomComposerRef {
  setText: (text: string) => void
}

const CustomComposer = forwardRef<CustomComposerRef, CustomComposerProps>(
  ({ placeholder = '请输入...', onSend, typing, onStop, disabled }, ref) => {
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      setText: (newText: string) => setText(newText)
    }))

    const handleSend = useCallback(() => {
      if (typing || disabled || !text.trim()) return
      onSend('text', text.trim())
      setText('')
    }, [text, typing, disabled, onSend])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (!e.shiftKey && e.key === 'Enter') {
        handleSend()
        e.preventDefault()
      }
    }, [handleSend])

    const handleStop = useCallback(() => {
      onStop?.()
    }, [onStop])

    const hasValue = !!text.trim()
    const showSendButton = !typing && hasValue
    const showStopButton = typing

    return (
      <div className="Composer" data-has-value={hasValue}>
        <div className="Composer-inputWrap">
          <textarea
            ref={inputRef}
            className="Input Input--outline Composer-input"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || typing}
          />
        </div>
        {(showSendButton || showStopButton) && (
          <div className="Composer-actions">
            {showSendButton && (
              <Button
                className="Composer-sendBtn"
                type="primary"
                onMouseDown={handleSend}
                disabled={disabled}
              >
                发送
              </Button>
            )}
            {showStopButton && (
              <Button
                className="Composer-stopBtn"
                type="default"
                onMouseDown={handleStop}
              >
                停止
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
)

CustomComposer.displayName = 'CustomComposer'

export default CustomComposer

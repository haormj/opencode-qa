export interface ParseState {
  inThinkBlock: boolean
  buffer: string
}

export interface ParseResult {
  type: 'text' | 'reasoning'
  content: string
}

const THINK_START_TAG = '<' + 'think' + '>'
const THINK_END_TAG = '<' + '/think' + '>'

export function parseThinkTags(delta: string, state: ParseState): ParseResult[] {
  const results: ParseResult[] = []
  let remaining = state.buffer + delta
  
  while (remaining.length > 0) {
    if (state.inThinkBlock) {
      const endIdx = remaining.indexOf(THINK_END_TAG)
      
      if (endIdx !== -1) {
        if (endIdx > 0) {
          results.push({ type: 'reasoning', content: remaining.substring(0, endIdx) })
        }
        remaining = remaining.substring(endIdx + THINK_END_TAG.length)
        state.inThinkBlock = false
      } else {
        const partialMatch = findPartialTag(remaining, THINK_END_TAG)
        if (partialMatch) {
          const contentLength = remaining.length - partialMatch.length
          if (contentLength > 0) {
            results.push({ type: 'reasoning', content: remaining.substring(0, contentLength) })
          }
          state.buffer = partialMatch
          return results
        }
        results.push({ type: 'reasoning', content: remaining })
        state.buffer = ''
        return results
      }
    } else {
      const startIdx = remaining.indexOf(THINK_START_TAG)
      
      if (startIdx !== -1) {
        if (startIdx > 0) {
          results.push({ type: 'text', content: remaining.substring(0, startIdx) })
        }
        remaining = remaining.substring(startIdx + THINK_START_TAG.length)
        state.inThinkBlock = true
      } else {
        const partialMatch = findPartialTag(remaining, THINK_START_TAG)
        if (partialMatch) {
          const contentLength = remaining.length - partialMatch.length
          if (contentLength > 0) {
            results.push({ type: 'text', content: remaining.substring(0, contentLength) })
          }
          state.buffer = partialMatch
          return results
        }
        results.push({ type: 'text', content: remaining })
        state.buffer = ''
        return results
      }
    }
  }
  
  state.buffer = ''
  return results
}

function findPartialTag(text: string, tag: string): string | null {
  for (let i = 1; i < tag.length; i++) {
    const partial = tag.substring(0, i)
    if (text.endsWith(partial)) {
      return partial
    }
  }
  return null
}

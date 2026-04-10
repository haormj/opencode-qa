import { describe, it, expect } from 'vitest'
import { parseThinkTags, type ParseState } from '../../src/services/think-tag-parser.js'

const THINK_START = '<' + 'think' + '>'
const THINK_END = '<' + '/think' + '>'

describe('parseThinkTags', () => {
  describe('basic cases', () => {
    it('should parse complete think block in single chunk', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`${THINK_START}hello world${THINK_END}`, state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'hello world' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle text without think tags', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags('normal text without tags', state)
      
      expect(result).toEqual([
        { type: 'text', content: 'normal text without tags' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle mixed content with think block', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`before ${THINK_START}during think${THINK_END} after`, state)
      
      expect(result).toEqual([
        { type: 'text', content: 'before ' },
        { type: 'reasoning', content: 'during think' },
        { type: 'text', content: ' after' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })
  })

  describe('streaming cases', () => {
    it('should handle think tag split across chunks', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      
      // First chunk ends with partial start tag
      let result = parseThinkTags('text with <thi', state)
      expect(result).toEqual([
        { type: 'text', content: 'text with ' }
      ])
      expect(state.buffer).toBe('<thi')
      
      // Second chunk completes start tag and has content
      result = parseThinkTags('nk>reasoning', state)
      expect(result).toEqual([
        { type: 'reasoning', content: 'reasoning' }
      ])
      expect(state.inThinkBlock).toBe(true)
    })

    it('should handle end tag split across chunks', () => {
      const state: ParseState = { inThinkBlock: true, buffer: '' }
      
      // First chunk ends with partial end tag
      let result = parseThinkTags('reasoning content</', state)
      expect(result).toEqual([
        { type: 'reasoning', content: 'reasoning content' }
      ])
      expect(state.buffer).toBe('</')
      
      // Second chunk completes end tag
      result = parseThinkTags('think>more text', state)
      expect(result).toEqual([
        { type: 'text', content: 'more text' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle multiple think blocks in sequence', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`${THINK_START}first${THINK_END} ${THINK_START}second${THINK_END} third`, state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'first' },
        { type: 'text', content: ' ' },
        { type: 'reasoning', content: 'second' },
        { type: 'text', content: ' third' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })
  })

  describe('edge cases', () => {
    it('should handle empty content in think block', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`${THINK_START}${THINK_END}empty`, state)
      
      expect(result).toEqual([
        { type: 'text', content: 'empty' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle unclosed think block', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`start ${THINK_START}text`, state)
      
      expect(result).toEqual([
        { type: 'text', content: 'start ' },
        { type: 'reasoning', content: 'text' }
      ])
      expect(state.inThinkBlock).toBe(true)
      expect(state.buffer).toBe('')
    })

    it('should handle think block at start', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`${THINK_START}leading reasoning${THINK_END}after`, state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'leading reasoning' },
        { type: 'text', content: 'after' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle think block at end', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`before${THINK_START}final`, state)
      
      expect(result).toEqual([
        { type: 'text', content: 'before' },
        { type: 'reasoning', content: 'final' }
      ])
      expect(state.inThinkBlock).toBe(true)
      expect(state.buffer).toBe('')
    })

    it('should handle consecutive think tags', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags(`${THINK_START}first${THINK_END}${THINK_START}second`, state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'first' },
        { type: 'reasoning', content: 'second' }
      ])
      expect(state.inThinkBlock).toBe(true)
      expect(state.buffer).toBe('')
    })

    it('should handle partial tags that look like real tags', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '' }
      const result = parseThinkTags('this is <not a tag', state)
      
      expect(result).toEqual([
        { type: 'text', content: 'this is <not a tag' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })
  })

  describe('continuation from previous state', () => {
    it('should continue from previous think block state', () => {
      const state: ParseState = { inThinkBlock: true, buffer: '' }
      const result = parseThinkTags(`continued reasoning ${THINK_END} done`, state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'continued reasoning ' },
        { type: 'text', content: ' done' }
      ])
      expect(state.inThinkBlock).toBe(false)
      expect(state.buffer).toBe('')
    })

    it('should handle buffer from previous chunk', () => {
      const state: ParseState = { inThinkBlock: false, buffer: '<thi' }
      const result = parseThinkTags('nk>reasoning here', state)
      
      expect(result).toEqual([
        { type: 'reasoning', content: 'reasoning here' }
      ])
      expect(state.inThinkBlock).toBe(true)
      expect(state.buffer).toBe('')
    })
  })
})

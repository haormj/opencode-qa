import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.stubGlobal('fetch', vi.fn())

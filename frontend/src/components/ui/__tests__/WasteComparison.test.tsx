import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WasteComparison, buildRows, cellClass, numericValues } from '@/components/ui/WasteComparison'
import { Waste, WasteType } from '@/api/types'

function makeWaste(overrides: Partial<Waste> = {}): Waste {
  return {
    waste_id: 1n,
    waste_type: WasteType.Paper,
    weight: 2000n,
    current_owner: 'ADDR_A',
    latitude: 0n,
    longitude: 0n,
    recycled_timestamp: 1700000000,
    is_active: true,
    is_confirmed: false,
    confirmer: '',
    ...overrides,
  }
}

// ── Pure helper tests ─────────────────────────────────────────────────────────

describe('numericValues', () => {
  it('converts numbers to numbers', () => {
    expect(numericValues([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('parses numeric strings', () => {
    expect(numericValues(['1.5', '2.5'])).toEqual([1.5, 2.5])
  })

  it('returns 0 for non-numeric strings', () => {
    expect(numericValues(['abc'])).toEqual([0])
  })
})

describe('cellClass', () => {
  it('returns green class for max value', () => {
    const cls = cellClass(10, [5, 10, 7], true)
    expect(cls).toContain('green')
  })

  it('returns red class for min value', () => {
    const cls = cellClass(5, [5, 10, 7], true)
    expect(cls).toContain('red')
  })

  it('returns empty string when all values are equal', () => {
    const cls = cellClass(5, [5, 5, 5], true)
    expect(cls).toBe('')
  })

  it('returns empty string when highlight is false', () => {
    const cls = cellClass(10, [5, 10], false)
    expect(cls).toBe('')
  })
})

describe('buildRows', () => {
  it('returns rows for each field', () => {
    const rows = buildRows([makeWaste()])
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it('weight row has highlight flag', () => {
    const rows = buildRows([makeWaste()])
    const weightRow = rows.find((r) => r.label === 'Weight (kg)')
    expect(weightRow?.highlight).toBe(true)
  })

  it('weight is converted from grams to kg', () => {
    const rows = buildRows([makeWaste({ weight: 5000n })])
    const weightRow = rows.find((r) => r.label === 'Weight (kg)')
    expect(weightRow?.values[0]).toBe(5)
  })
})

// ── Component tests ───────────────────────────────────────────────────────────

describe('WasteComparison component', () => {
  it('renders nothing for empty wastes', () => {
    const { container } = render(<WasteComparison wastes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders table with waste IDs', () => {
    render(<WasteComparison wastes={[makeWaste({ waste_id: 42n }), makeWaste({ waste_id: 99n })]} />)
    expect(screen.getAllByText('#42').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#99').length).toBeGreaterThan(0)
  })

  it('shows correct number of columns', () => {
    render(<WasteComparison wastes={[makeWaste({ waste_id: 1n }), makeWaste({ waste_id: 2n }), makeWaste({ waste_id: 3n })]} />)
    // 3 waste columns + 1 label column = 4 th elements
    const headers = document.querySelectorAll('th')
    expect(headers.length).toBe(4)
  })

  it('shows export button', () => {
    render(<WasteComparison wastes={[makeWaste(), makeWaste({ waste_id: 2n })]} />)
    expect(screen.getByText(/Export CSV/i)).toBeTruthy()
  })

  it('export button triggers download', () => {
    const click = vi.fn()
    const mockAnchor = { href: '', download: '', click, style: {} }
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement
      return origCreate(tag)
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url'), revokeObjectURL: vi.fn() })
    render(<WasteComparison wastes={[makeWaste(), makeWaste({ waste_id: 2n })]} />)
    fireEvent.click(screen.getByText(/Export CSV/i))
    expect(click).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

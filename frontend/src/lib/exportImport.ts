import { Waste, WasteType, Participant, ParticipantStats } from '@/api/types'
import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import { wasteTypeLabel, roleLabel, formatDate } from './helpers'

/* ────────────────────────────────────────────────────────────────
   CSV / JSON Export
   ──────────────────────────────────────────────────────────────── */

export function exportWasteToCSV(wastes: Waste[]): Blob {
  const headers = [
    'waste_id',
    'waste_type',
    'weight',
    'current_owner',
    'latitude',
    'longitude',
    'recycled_timestamp',
    'is_active',
    'is_confirmed',
    'confirmer',
  ]
  const rows = wastes.map((w) => [
    w.waste_id.toString(),
    wasteTypeLabel(w.waste_type),
    w.weight.toString(),
    w.current_owner,
    w.latitude.toString(),
    w.longitude.toString(),
    new Date(w.recycled_timestamp * 1000).toISOString(),
    w.is_active ? 'true' : 'false',
    w.is_confirmed ? 'true' : 'false',
    w.confirmer,
  ])
  const csv = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(',')).join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}

export function exportWasteToJSON(wastes: Waste[]): Blob {
  const data = wastes.map((w) => ({
    waste_id: w.waste_id.toString(),
    waste_type: wasteTypeLabel(w.waste_type),
    weight: w.weight.toString(),
    current_owner: w.current_owner,
    latitude: w.latitude.toString(),
    longitude: w.longitude.toString(),
    recycled_timestamp: w.recycled_timestamp,
    is_active: w.is_active,
    is_confirmed: w.is_confirmed,
    confirmer: w.confirmer,
  }))
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

function escapeCsvCell(val: string): string {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`
  return val
}

/* ────────────────────────────────────────────────────────────────
   PDF Export (Participant Stats)
   ──────────────────────────────────────────────────────────────── */

export function exportParticipantStatsToPDF(
  participant: Participant,
  stats: ParticipantStats
): Blob {
  const doc = new jsPDF()
  const margin = 14
  let y = 20

  doc.setFontSize(18)
  doc.text('Participant Report', margin, y)
  y += 10

  doc.setFontSize(12)
  doc.text(`Name: ${participant.name}`, margin, y)
  y += 7
  doc.text(`Address: ${participant.address}`, margin, y)
  y += 7
  doc.text(`Role: ${roleLabel(participant.role)}`, margin, y)
  y += 7
  doc.text(`Registered: ${formatDate(participant.registered_at)}`, margin, y)
  y += 12

  doc.setFontSize(14)
  doc.text('Statistics', margin, y)
  y += 10

  doc.setFontSize(12)
  doc.text(`Total Earned: ${stats.total_earned.toString()}`, margin, y)
  y += 7
  doc.text(`Materials Submitted: ${stats.materials_submitted}`, margin, y)
  y += 7
  doc.text(`Transfers Count: ${stats.transfers_count}`, margin, y)
  y += 12

  doc.setFontSize(10)
  doc.setTextColor(150)
  doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y)

  return doc.output('blob')
}

/* ────────────────────────────────────────────────────────────────
   CSV Import (Admin)
   ──────────────────────────────────────────────────────────────── */

export interface ImportWasteRow {
  waste_type: string
  weight: string
  latitude: string
  longitude: string
}

export interface ParsedImportResult {
  data: ImportWasteRow[]
  errors: string[]
  valid: boolean
  preview: ImportPreviewRow[]
}

export interface ImportPreviewRow extends ImportWasteRow {
  rowNumber: number
  errors: string[]
  valid: boolean
}

const VALID_WASTE_TYPES = Object.values(WasteType).filter(
  (v): v is number => typeof v === 'number'
)

export function parseWasteCSV(csvText: string): ParsedImportResult {
  const parseResult = Papa.parse<ImportWasteRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const errors: string[] = []
  if (parseResult.errors.length > 0) {
    errors.push(...parseResult.errors.map((e) => `Parse error: ${e.message}`))
  }

  const requiredHeaders = ['waste_type', 'weight', 'latitude', 'longitude']
  const headers = parseResult.meta.fields ?? []
  const missing = requiredHeaders.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`)
  }

  const preview: ImportPreviewRow[] = []
  const data: ImportWasteRow[] = []

  parseResult.data.forEach((row, idx) => {
    const rowNumber = idx + 2 // 1-based with header
    const rowErrors: string[] = []

    if (!row.waste_type || row.waste_type.trim() === '') {
      rowErrors.push('waste_type is required')
    } else {
      const normalized = row.waste_type.trim().toLowerCase()
      const isValidType = VALID_WASTE_TYPES.some(
        (wt) => wasteTypeLabel(wt).toLowerCase() === normalized || String(wt) === normalized
      )
      if (!isValidType) {
        rowErrors.push(`Invalid waste_type: "${row.waste_type}"`)
      }
    }

    const weightNum = Number(row.weight)
    if (Number.isNaN(weightNum) || weightNum <= 0) {
      rowErrors.push('weight must be a positive number')
    }

    const latNum = Number(row.latitude)
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      rowErrors.push('latitude must be between -90 and 90')
    }

    const lonNum = Number(row.longitude)
    if (Number.isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      rowErrors.push('longitude must be between -180 and 180')
    }

    const previewRow: ImportPreviewRow = {
      ...row,
      rowNumber,
      errors: rowErrors,
      valid: rowErrors.length === 0,
    }
    preview.push(previewRow)
    if (rowErrors.length === 0) {
      data.push(row)
    }
  })

  return {
    data,
    errors,
    valid: errors.length === 0 && preview.every((r) => r.valid),
    preview,
  }
}

/* ────────────────────────────────────────────────────────────────
   Template Download
   ──────────────────────────────────────────────────────────────── */

export function generateWasteTemplateCSV(): string {
  const headers = ['waste_type', 'weight', 'latitude', 'longitude']
  const exampleRows = [
    ['Plastic', '1500', '40.7128', '-74.006'],
    ['Metal', '2300', '51.5074', '-0.1278'],
    ['Glass', '800', '35.6762', '139.6503'],
  ]
  return [headers, ...exampleRows].map((r) => r.join(',')).join('\n')
}

/* ────────────────────────────────────────────────────────────────
   Generic Download Trigger
   ──────────────────────────────────────────────────────────────── */

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

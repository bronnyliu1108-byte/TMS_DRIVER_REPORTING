const STORAGE_KEY = 'tms-driver-event-records'

const initialEventRecords = [
  {
    id: 'seed-arrival-success',
    orderNumber: 'SO-240501',
    reportNode: 'arrival',
    reportResult: null,
    createdAt: '2026-04-30T08:10:00.000Z',
    remarks: 'Arrived at gate A',
    images: [],
    status: 'completed',
  },
  {
    id: 'seed-departure-pending',
    orderNumber: 'SO-240501',
    reportNode: 'departure',
    reportResult: 'success',
    createdAt: '2026-04-30T08:30:00.000Z',
    remarks: '',
    images: [],
    status: 'pending',
  },
  {
    id: 'seed-arrival-pending',
    orderNumber: 'SO-240518',
    reportNode: 'arrival',
    reportResult: null,
    createdAt: '2026-04-30T10:15:00.000Z',
    remarks: '',
    images: [],
    status: 'pending',
  },
]

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toISOString().slice(0, 10)

const delay = () =>
  new Promise((resolve) => {
    const timeoutMs = 500 + Math.floor(Math.random() * 301)
    window.setTimeout(resolve, timeoutMs)
  })

function normalizeLegacyRecord(record) {
  if (record.reportNode) {
    return {
      reportResult: null,
      ...record,
    }
  }

  const legacyType = record.reportType
  if (legacyType === 'arrival') {
    return {
      ...record,
      reportNode: 'arrival',
      reportResult: null,
    }
  }

  if (legacyType === 'exception') {
    return {
      ...record,
      reportNode: 'departure',
      reportResult: 'exception',
    }
  }

  return {
    ...record,
    reportNode: 'arrival',
    reportResult: null,
  }
}

function readReportsFromStorage() {
  if (typeof window === 'undefined') {
    return initialEventRecords
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialEventRecords))
    return initialEventRecords
  }

  try {
    const parsed = JSON.parse(raw)
    const records = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : initialEventRecords

    return records.map(normalizeLegacyRecord)
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialEventRecords))
    return initialEventRecords
  }
}

function writeReportsToStorage(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function hasOrderSupplement(records, orderNumber) {
  return records.some(
    (record) =>
      record.orderNumber === orderNumber &&
      (record.supplementUpdatedAt ||
        (record.remarks && record.remarks.trim()) ||
        (record.images && record.images.length > 0)),
  )
}

export function getLatestSupplementRecord(records, orderNumber) {
  return records
    .filter(
      (record) =>
        record.orderNumber === orderNumber &&
        (record.supplementUpdatedAt ||
          (record.remarks && record.remarks.trim()) ||
          (record.images && record.images.length > 0)),
    )
    .sort((left, right) => {
      const leftTimestamp = left.supplementUpdatedAt ?? left.createdAt
      const rightTimestamp = right.supplementUpdatedAt ?? right.createdAt
      return new Date(rightTimestamp) - new Date(leftTimestamp)
    })[0]
}

function completeOrderSupplement(records, orderNumber) {
  return records.map((record) =>
    record.orderNumber === orderNumber
      ? {
          ...record,
          status: 'completed',
        }
      : record,
  )
}

function getLatestPendingReportsForToday(records) {
  const todayKey = getTodayKey()
  const latestByOrder = new Map()

  records.forEach((record) => {
    if (hasOrderSupplement(records, record.orderNumber)) {
      return
    }

    if (record.status !== 'pending') {
      return
    }

    if (record.createdAt.slice(0, 10) !== todayKey) {
      return
    }

    const current = latestByOrder.get(record.orderNumber)
    if (!current || new Date(record.createdAt) > new Date(current.createdAt)) {
      latestByOrder.set(record.orderNumber, record)
    }
  })

  return Array.from(latestByOrder.values())
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
}

export async function getReports() {
  await delay()
  return readReportsFromStorage()
}

export async function createReport(reportData) {
  await delay()

  const { status: _ignoredStatus, ...safeReportData } = reportData
  const records = readReportsFromStorage()
  const orderAlreadySupplemented = hasOrderSupplement(records, safeReportData.orderNumber)
  const currentSubmissionHasSupplement =
    (safeReportData.remarks && safeReportData.remarks.trim()) ||
    (safeReportData.images && safeReportData.images.length > 0)
  const calculatedStatus =
    currentSubmissionHasSupplement || orderAlreadySupplemented ? 'completed' : 'pending'
  const createdAt = new Date().toISOString()
  const nextSupplementUpdatedAt =
    safeReportData.supplementUpdatedAt ?? (currentSubmissionHasSupplement ? createdAt : undefined)
  const createdRecord = {
    id: createId(),
    createdAt,
    reportResult: null,
    ...safeReportData,
    ...(nextSupplementUpdatedAt ? { supplementUpdatedAt: nextSupplementUpdatedAt } : {}),
    status: calculatedStatus,
  }

  let nextRecords = [createdRecord, ...records]

  if (currentSubmissionHasSupplement) {
    nextRecords = completeOrderSupplement(nextRecords, createdRecord.orderNumber)
  }

  writeReportsToStorage(nextRecords)
  return createdRecord
}

export async function updateReport(reportId, updateData) {
  await delay()

  const records = readReportsFromStorage()
  let updatedRecord = null

  const nextRecords = records.map((record) => {
    if (record.id !== reportId) {
      return record
    }

    updatedRecord = {
      ...record,
      ...updateData,
    }
    return updatedRecord
  })

  if (!updatedRecord) {
    throw new Error(`Report not found: ${reportId}`)
  }

  const updatedRecordHasSupplement =
    (updatedRecord.remarks && updatedRecord.remarks.trim()) ||
    (updatedRecord.images && updatedRecord.images.length > 0)

  const finalizedRecords = updatedRecordHasSupplement
    ? completeOrderSupplement(nextRecords, updatedRecord.orderNumber)
    : nextRecords

  writeReportsToStorage(finalizedRecords)
  return finalizedRecords.find((record) => record.id === reportId)
}

export async function completeOrderSupplementRecords(orderNumber, supplementData) {
  await delay()

  const records = readReportsFromStorage()
  const latestSupplementRecord = getLatestSupplementRecord(records, orderNumber)
  const latestOrderRecord = records
    .filter((record) => record.orderNumber === orderNumber)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0]
  const targetRecordId = latestSupplementRecord?.id ?? latestOrderRecord?.id
  const supplementUpdatedAt = new Date().toISOString()

  const supplementedRecords = records.map((record) => {
    if (record.id !== targetRecordId) {
      return record
    }

    return {
      ...record,
      remarks: supplementData.remarks !== undefined ? supplementData.remarks : record.remarks,
      images: supplementData.images !== undefined ? supplementData.images : record.images,
      supplementUpdatedAt,
    }
  })
  const finalizedRecords = completeOrderSupplement(supplementedRecords, orderNumber)

  writeReportsToStorage(finalizedRecords)
  return finalizedRecords.filter((record) => record.orderNumber === orderNumber)
}

export async function getIncompleteReports() {
  await delay()
  const records = readReportsFromStorage()
  return getLatestPendingReportsForToday(records)
}

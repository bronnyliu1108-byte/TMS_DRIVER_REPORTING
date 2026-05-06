import { useEffect, useMemo, useRef, useState } from 'react'
import {
  completeOrderSupplementRecords,
  createReport,
  getReports,
  hasOrderSupplement,
} from './services/reportApi'

const activeCompany = 'companyC'
const maxImages = 6

const companyConfig = {
  companyA: {
    mode: 'arrival-only',
  },
  companyB: {
    mode: 'departure-only',
  },
  companyC: {
    mode: 'arrival-departure',
  },
}

const createEmptyReport = () => ({
  orderNumber: '',
  reportNode: '',
  remarks: '',
  images: [],
})

function formatCopy(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  )
}

function getImageStatusSummary(images) {
  return images
    .filter((image) => image.status === 'success')
    .map((image) => ({
      id: image.id,
      name: image.name,
    }))
}

function formatEventTime(timestamp, language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function formatEventDateTime(timestamp, language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function getLatestRecord(records, node) {
  return records
    .filter((record) => record.reportNode === node)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0]
}

function getOrderStatus(records, companyKey) {
  const latestArrival = getLatestRecord(records, 'arrival')
  const latestDeparture = getLatestRecord(records, 'departure')

  if (companyKey === 'companyA') {
    if (!latestArrival?.reportResult) {
      return 'in-progress'
    }
    return latestArrival.reportResult
  }

  if (companyKey === 'companyB') {
    if (!latestDeparture?.reportResult) {
      return 'in-progress'
    }
    return latestDeparture.reportResult
  }

  if (!latestDeparture?.reportResult) {
    return 'in-progress'
  }

  return latestDeparture.reportResult
}

function getNodeOptionsForOrder(records, companyKey, text) {
  if (companyKey === 'companyA') {
    return [
      {
        value: 'arrival',
        label: text.report.nodeOptions.arrival,
        requiresResult: true,
      },
    ]
  }

  if (companyKey === 'companyB') {
    return [
      {
        value: 'departure',
        label: text.report.nodeOptions.departure,
        requiresResult: true,
      },
    ]
  }

  const latestArrival = getLatestRecord(records, 'arrival')
  const latestDeparture = getLatestRecord(records, 'departure')

  if (!latestArrival) {
    return [
      {
        value: 'arrival',
        label: text.report.nodeOptions.arrival,
        requiresResult: false,
      },
    ]
  }

  return [
    {
      value: 'arrival',
      label: text.report.nodeOptions.arrivalRerecord,
      requiresResult: false,
    },
    {
      value: 'departure',
      label: latestDeparture
        ? text.report.nodeOptions.departureRerecord
        : text.report.nodeOptions.departure,
      requiresResult: true,
    },
  ]
}

function ScanIcon() {
  return (
    <svg className="field-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M20 7V5a1 1 0 0 0-1-1h-2" />
      <path d="M4 17v2a1 1 0 0 0 1 1h2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 12h10" />
      <path d="M7 9h2" />
      <path d="M7 15h3" />
      <path d="M14 15h3" />
      <path d="M15 9h2" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg className="field-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16a3 3 0 0 0 3-3V8a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M7 12a5 5 0 0 0 10 0" />
      <path d="M12 17v3" />
      <path d="M9 20h6" />
    </svg>
  )
}

function ArrivalIcon() {
  return (
    <svg className="type-card-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
      <path d="m9.5 10.5 1.8 1.8 3.2-3.2" />
    </svg>
  )
}

function DepartureIcon() {
  return (
    <svg className="type-card-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h10" />
      <path d="m11 6 6 6-6 6" />
      <path d="M5 5v14" />
    </svg>
  )
}

function ReportPage({ driver, onSignOut, language, onLanguageChange, text }) {
  const [report, setReport] = useState(createEmptyReport)
  const [uploadError, setUploadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [eventRecords, setEventRecords] = useState([])
  const [showIncompleteList, setShowIncompleteList] = useState(false)
  const [activeSupplementOrder, setActiveSupplementOrder] = useState('')

  const uploadTimersRef = useRef(new Map())
  const toastTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const imagesRef = useRef([])

  const incompleteOrders = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const pendingByOrder = new Map()

    eventRecords.forEach((record) => {
      if (record.createdAt.slice(0, 10) !== todayKey) {
        return
      }

      if (hasOrderSupplement(eventRecords, record.orderNumber)) {
        return
      }

      if (record.status !== 'pending') {
        return
      }

      if (!pendingByOrder.has(record.orderNumber)) {
        pendingByOrder.set(record.orderNumber, [])
      }

      pendingByOrder.get(record.orderNumber).push(record)
    })

    return Array.from(pendingByOrder.entries())
      .map(([orderNumber, records]) => ({
        orderNumber,
        records: records.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
        latestCreatedAt: records.reduce(
          (latest, record) =>
            new Date(record.createdAt) > new Date(latest) ? record.createdAt : latest,
          records[0]?.createdAt ?? '',
        ),
      }))
      .sort((left, right) => new Date(right.latestCreatedAt) - new Date(left.latestCreatedAt))
  }, [eventRecords])
  const pendingCount = incompleteOrders.length
  const pendingOrderGroups = incompleteOrders.slice(0, 3)
  const isEditingIncomplete = Boolean(activeSupplementOrder)
  const successfulImageCount = report.images.filter((image) => image.status === 'success').length
  const hasRemarks = report.remarks.trim().length > 0
  const hasSupplement = hasRemarks || successfulImageCount > 0
  const uploadCountText = formatCopy(text.report.uploadCount, {
    count: String(report.images.length),
  })

  const orderRecords = useMemo(() => {
    const normalizedOrderNumber = isEditingIncomplete
      ? activeSupplementOrder.trim()
      : report.orderNumber.trim()
    if (!normalizedOrderNumber) {
      return []
    }

    return eventRecords.filter((record) => record.orderNumber === normalizedOrderNumber)
  }, [activeSupplementOrder, eventRecords, isEditingIncomplete, report.orderNumber])

  const nodeOptions = useMemo(
    () => getNodeOptionsForOrder(orderRecords, activeCompany, text),
    [orderRecords, text],
  )
  const hasBaseFields = report.orderNumber.trim() && report.reportNode
  const canSubmit = isEditingIncomplete ? hasSupplement : hasBaseFields
  const summaryArrivalRecord = useMemo(
    () => getLatestRecord(orderRecords, 'arrival'),
    [orderRecords],
  )
  const summaryDepartureRecord = useMemo(
    () => getLatestRecord(orderRecords, 'departure'),
    [orderRecords],
  )
  const _currentOrderStatus = useMemo(
    () => getOrderStatus(orderRecords, activeCompany),
    [orderRecords],
  )
  const remarksPlaceholder =
    report.reportNode === 'departure'
      ? text.report.remarksPlaceholderDeparture
      : report.reportNode === 'arrival'
        ? text.report.remarksPlaceholderArrival
        : text.report.remarksPlaceholderDefault

  useEffect(() => {
    imagesRef.current = report.images
  }, [report.images])

  useEffect(() => {
    const loadData = async () => {
      try {
        const reports = await getReports()
        setEventRecords(reports)
      } catch (error) {
        console.error('Failed to load reports', error)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    return () => {
      uploadTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      uploadTimersRef.current.clear()
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
      imagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    if (isEditingIncomplete) {
      return
    }

    if (!report.reportNode) {
      return
    }

    const nextSelectedNode = nodeOptions.find((option) => option.value === report.reportNode)
    if (!nextSelectedNode) {
      setReport((current) => ({
        ...current,
        reportNode: '',
      }))
    }
  }, [isEditingIncomplete, nodeOptions, report.reportNode])

  const refreshReports = async () => {
    const reports = await getReports()
    setEventRecords(reports)
  }

  const showToastMessage = (message) => {
    setToastMessage(message)
    setShowToast(true)

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setShowToast(false)
      setToastMessage('')
    }, 2000)
  }

  const clearUploadTask = (imageId) => {
    const timerId = uploadTimersRef.current.get(imageId)
    if (timerId) {
      window.clearTimeout(timerId)
      uploadTimersRef.current.delete(imageId)
    }
  }

  const releaseImages = (images) => {
    images.forEach((image) => {
      clearUploadTask(image.id)
      URL.revokeObjectURL(image.previewUrl)
    })
  }

  const resetForm = () => {
    setReport((current) => {
      releaseImages(current.images)
      return createEmptyReport()
    })
    setUploadError('')
    setIsSubmitting(false)
  }

  const startMockUpload = (imageId) => {
    clearUploadTask(imageId)

    const timerId = window.setTimeout(() => {
      setReport((current) => ({
        ...current,
        images: current.images.map((image) =>
          image.id === imageId
            ? { ...image, status: Math.random() > 0.14 ? 'success' : 'failed' }
            : image,
        ),
      }))
      uploadTimersRef.current.delete(imageId)
    }, 900 + Math.random() * 900)

    uploadTimersRef.current.set(imageId, timerId)
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files ?? [])

    if (!files.length) {
      return
    }

    const availableSlots = maxImages - report.images.length

    if (files.length > availableSlots) {
      setUploadError(text.report.uploadLimit)
    } else {
      setUploadError('')
    }

    const nextFiles = files.slice(0, availableSlots)

    if (!nextFiles.length) {
      event.target.value = ''
      return
    }

    const nextImages = nextFiles.map((file) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }))

    setReport((current) => ({
      ...current,
      images: [...current.images, ...nextImages],
    }))

    nextImages.forEach((image) => startMockUpload(image.id))
    event.target.value = ''
  }

  const handleRetryUpload = (imageId) => {
    setReport((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, status: 'uploading' } : image,
      ),
    }))
    startMockUpload(imageId)
  }

  const handleRemoveImage = (imageId) => {
    setReport((current) => {
      const imageToRemove = current.images.find((image) => image.id === imageId)
      if (imageToRemove) {
        clearUploadTask(imageId)
        URL.revokeObjectURL(imageToRemove.previewUrl)
      }

      return {
        ...current,
        images: current.images.filter((image) => image.id !== imageId),
      }
    })
  }

  const handleSelectNode = (nextNode) => {
    if (isEditingIncomplete) {
      return
    }

    setReport((current) => ({
      ...current,
      reportNode: nextNode,
    }))
  }

  const handleBannerToggle = () => {
    if (!pendingCount) {
      return
    }

    setShowIncompleteList((current) => !current)
  }

  const handleBackToMainForm = () => {
    if (isEditingIncomplete) {
      setActiveSupplementOrder('')
      resetForm()
    }

    setShowIncompleteList(false)
  }

  const handleLoadIncomplete = (orderNumber) => {
    resetForm()
    setActiveSupplementOrder(orderNumber)
    setShowIncompleteList(false)
    setReport({
      orderNumber: orderNumber,
      reportNode: '',
      remarks: '',
      images: [],
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!canSubmit || isSubmitting) {
      return
    }

    const successfulImages = getImageStatusSummary(report.images)
    const hasOptionalContent = hasRemarks || successfulImages.length > 0
    setIsSubmitting(true)

    try {
      if (isEditingIncomplete) {
        await completeOrderSupplementRecords(activeSupplementOrder, {
          remarks: report.remarks.trim(),
          images: successfulImages,
        })
        await refreshReports()
        resetForm()
        setActiveSupplementOrder('')
        showToastMessage(text.report.successToast)
      } else {
        await createReport({
          orderNumber: report.orderNumber.trim(),
          reportNode: report.reportNode,
          reportResult: null,
          remarks: report.remarks.trim(),
          images: successfulImages,
        })
        await refreshReports()
        resetForm()
        showToastMessage(hasOptionalContent ? text.report.successToast : text.report.pendingToast)
      }
    } catch (error) {
      console.error('Failed to submit report', error)
      setIsSubmitting(false)
      showToastMessage(text.report.submitFailed)
    }
  }

  return (
    <section className="screen screen-report">
      <div className="top-bar top-bar-report">
        <div className="language-switcher" aria-label="Language switcher">
          <button
            className={`language-option ${language === 'zh' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onLanguageChange('zh')}
          >
            {text.languageSwitcher.zh}
          </button>
          <button
            className={`language-option ${language === 'en' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onLanguageChange('en')}
          >
            {text.languageSwitcher.en}
          </button>
        </div>
      </div>

      <header className="driver-header">
        <div className="driver-summary">
          <span className="driver-name">{driver.name}</span>
        </div>
        <button className="text-button driver-signout" type="button" onClick={onSignOut}>
          {text.report.signOut}
        </button>
      </header>

      {pendingCount > 0 && (
        <section className="card recent-section">
          <button className="recent-section-header" type="button" onClick={handleBannerToggle}>
            <div className="recent-section-header-copy">
              <span className="incomplete-banner-copy">
                {formatCopy(text.report.recentBanner, { count: String(pendingCount) })}
              </span>
            </div>
            <span className="incomplete-banner-toggle" aria-hidden="true">
              {showIncompleteList ? '^' : 'v'}
            </span>
          </button>

          <div className={`recent-sheet-wrap ${showIncompleteList ? 'is-open' : ''}`}>
            <div className="recent-sheet">
              {pendingOrderGroups.length ? (
                <div className="recent-list">
                  {pendingOrderGroups.map((group) => (
                    <button
                      key={group.orderNumber}
                      className="recent-item"
                      type="button"
                      onClick={() => handleLoadIncomplete(group.orderNumber)}
                    >
                      <div className="recent-item-main">
                        <div className="recent-item-copy">
                          <span className="recent-item-order">{group.orderNumber}</span>
                        </div>
                        <span className="recent-item-arrow" aria-hidden="true">
                          &gt;
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-helper-text">{text.report.recentEmpty}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <form className="card form-card report-card report-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{text.report.orderLabel}</span>
          <div className="field-with-action">
            <input
              className="text-input text-input-with-icon"
              type="text"
              value={report.orderNumber}
              onChange={(event) =>
                setReport((current) => ({
                  ...current,
                  orderNumber: event.target.value,
                }))
              }
              placeholder={text.report.orderPlaceholder}
              disabled={isEditingIncomplete}
            />
            <button
              className="field-action-button"
              type="button"
              onClick={() => console.log('scan triggered')}
              disabled={isEditingIncomplete}
              aria-label="Scan order number"
            >
              <ScanIcon />
            </button>
          </div>
        </label>

        {!isEditingIncomplete && (
          <div className="field">
            <div className="type-card-group">
              {nodeOptions.map((option) => (
                <button
                  key={option.value}
                  className={`type-card ${report.reportNode === option.value ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => handleSelectNode(option.value)}
                >
                  <span className="type-card-icon">
                    {option.value === 'arrival' ? <ArrivalIcon /> : <DepartureIcon />}
                  </span>
                  <span className="type-card-copy">
                    <span className="type-card-title">{option.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isEditingIncomplete && (
          <div className="field">
            <div className="supplement-summary">
              {summaryArrivalRecord && (
                <div className="supplement-summary-row">
                  <span className="supplement-summary-label">{text.report.summaryArrival}</span>
                  <span className="supplement-summary-value">
                    {formatEventDateTime(summaryArrivalRecord.createdAt, language)}
                  </span>
                </div>
              )}
              {summaryDepartureRecord && (
                <div className="supplement-summary-row">
                  <span className="supplement-summary-label">{text.report.summaryDeparture}</span>
                  <span className="supplement-summary-value">
                    {formatEventDateTime(summaryDepartureRecord.createdAt, language)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-divider" aria-hidden="true" />

        <label className="field">
          <span className="field-label">{text.report.remarksLabel}</span>
          <div className="field-with-action">
            <textarea
              className="text-input text-area text-area-with-icon"
              value={report.remarks}
              onChange={(event) =>
                setReport((current) => ({
                  ...current,
                  remarks: event.target.value,
                }))
              }
              placeholder={remarksPlaceholder}
            />
            <button
              className="field-action-button field-action-button-bottom"
              type="button"
              onClick={() => console.log('voice input triggered')}
              aria-label="Voice input"
            >
              <MicIcon />
            </button>
          </div>
        </label>

        <div className="field upload-group">
          <div className="recent-item-main">
            <span className="field-label">{text.report.uploadLabel}</span>
            <span className="upload-meta">{uploadCountText}</span>
          </div>

          <div className="upload-grid">
            {report.images.map((image) => (
              <div key={image.id} className="upload-tile">
                <img className="upload-tile-image" src={image.previewUrl} alt={image.name} />

                <div className="upload-status-overlay">
                  {image.status === 'uploading' && <span className="tile-spinner" />}

                  {image.status === 'success' && (
                    <span
                      className="tile-status-icon success"
                      aria-label={text.report.uploadSuccessIconLabel}
                    >
                      ✓
                    </span>
                  )}

                  {image.status === 'failed' && (
                    <div className="tile-failed-actions">
                      <span
                        className="tile-status-icon failed"
                        aria-label={text.report.uploadFailedIconLabel}
                      >
                        !
                      </span>
                      <button
                        className="tile-retry-button"
                        type="button"
                        onClick={() => handleRetryUpload(image.id)}
                      >
                        {text.report.retry}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  className="upload-remove"
                  type="button"
                  onClick={() => handleRemoveImage(image.id)}
                  aria-label={text.report.removeImageLabel}
                >
                  ×
                </button>
              </div>
            ))}

            {report.images.length < maxImages && (
              <button
                className="upload-slot"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={text.report.uploadTriggerLabel}
              >
                <span className="upload-slot-plus">+</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />

          {uploadError && <p className="status-banner status-banner-error">{uploadError}</p>}
        </div>

        {isEditingIncomplete && !hasSupplement && (
          <p className="field-helper-text">{text.report.supplementRequiredHelper}</p>
        )}

        <div className="sticky-submit">
          <div className="form-action-bar">
            {isEditingIncomplete && (
              <button
                className="secondary-action-button"
                type="button"
                onClick={handleBackToMainForm}
              >
                {text.report.back}
              </button>
            )}
            <button className="primary-button" type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting && <span className="button-spinner" />}
              {isSubmitting ? text.report.submitting : text.report.submit}
            </button>
          </div>
        </div>
      </form>

      {showToast && <div className="toast-success">{toastMessage}</div>}
    </section>
  )
}

export default ReportPage

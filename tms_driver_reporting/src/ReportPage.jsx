import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  completeOrderSupplementRecords,
  createReport,
  getLatestSupplementRecord,
  getReports,
} from './services/reportApi'

const activeCompany = 'companyC'
const maxImages = 6
const scannerRegionId = 'order-scanner-region'
const SpeechRecognitionConstructor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null
const isIPhoneSafari =
  typeof navigator !== 'undefined' &&
  /iPhone/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)

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

const createEmptyOriginalSupplement = () => ({
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

function createStoredImagePreview(name) {
  const label = encodeURIComponent(name || 'Image')
  return `data:image/svg+xml;utf8,${`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#dbeafe"/><text x="60" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#0f172a">${label}</text></svg>`}`
}

function normalizeStoredImages(images) {
  return (images ?? []).map((image, index) => ({
    id: image.id ?? `stored-${index}-${image.name ?? 'image'}`,
    name: image.name ?? `image-${index + 1}`,
    previewUrl: image.previewUrl ?? createStoredImagePreview(image.name),
    status: 'success',
  }))
}

function getComparableImages(images) {
  return images
    .filter((image) => image.status === 'success')
    .map((image) => ({
      id: image.id,
      name: image.name,
    }))
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
  const [showHistoryList, setShowHistoryList] = useState(false)
  const [activeOrderNumber, setActiveOrderNumber] = useState('')
  const [originalHistorySupplement, setOriginalHistorySupplement] = useState(
    createEmptyOriginalSupplement,
  )
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const uploadTimersRef = useRef(new Map())
  const toastTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const orderInputRef = useRef(null)
  const remarksInputRef = useRef(null)
  const imagesRef = useRef([])
  const scannerInstanceRef = useRef(null)
  const scanResolvedRef = useRef(false)
  const recognitionRef = useRef(null)

  const historyOrders = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const recordsByOrder = new Map()

    eventRecords.forEach((record) => {
      if (record.createdAt.slice(0, 10) !== todayKey) {
        return
      }

      if (!recordsByOrder.has(record.orderNumber)) {
        recordsByOrder.set(record.orderNumber, [])
      }

      recordsByOrder.get(record.orderNumber).push(record)
    })

    return Array.from(recordsByOrder.entries())
      .map(([orderNumber, records]) => {
        const sortedRecords = records.sort(
          (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
        )

        return {
          orderNumber,
          records: sortedRecords,
          latestCreatedAt: sortedRecords[0]?.createdAt ?? '',
        }
      })
      .sort((left, right) => new Date(right.latestCreatedAt) - new Date(left.latestCreatedAt))
  }, [eventRecords])

  const historyCount = historyOrders.length
  const isViewingHistoryOrder = Boolean(activeOrderNumber)
  const successfulImageCount = report.images.filter((image) => image.status === 'success').length
  const hasRemarks = report.remarks.trim().length > 0
  const hasSupplementContent = hasRemarks || successfulImageCount > 0
  const uploadCountText = formatCopy(text.report.uploadCount, {
    count: String(report.images.length),
  })

  const orderRecords = useMemo(() => {
    const normalizedOrderNumber = isViewingHistoryOrder
      ? activeOrderNumber.trim()
      : report.orderNumber.trim()

    if (!normalizedOrderNumber) {
      return []
    }

    return eventRecords.filter((record) => record.orderNumber === normalizedOrderNumber)
  }, [activeOrderNumber, eventRecords, isViewingHistoryOrder, report.orderNumber])

  const nodeOptions = useMemo(
    () => getNodeOptionsForOrder(orderRecords, activeCompany, text),
    [orderRecords, text],
  )
  const hasBaseFields = report.orderNumber.trim() && report.reportNode
  const isSupplementDirty =
    report.remarks !== originalHistorySupplement.remarks ||
    JSON.stringify(getComparableImages(report.images)) !==
      JSON.stringify(originalHistorySupplement.images)
  const canSubmit = isViewingHistoryOrder
    ? Boolean(report.reportNode) || isSupplementDirty
    : Boolean(hasBaseFields)
  const summaryArrivalRecord = useMemo(
    () => getLatestRecord(orderRecords, 'arrival'),
    [orderRecords],
  )
  const summaryDepartureRecord = useMemo(
    () => getLatestRecord(orderRecords, 'departure'),
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
        if (image.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(image.previewUrl)
        }
      })

      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        try {
          recognition.onresult = null
          recognition.onerror = null
          recognition.onend = null
          recognition.stop()
        } catch {}
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const stopScanner = async () => {
      const scanner = scannerInstanceRef.current
      scannerInstanceRef.current = null

      if (!scanner) {
        return
      }

      try {
        const state = scanner.getState()
        if (state === 2) {
          await scanner.stop()
        }
      } catch {}

      try {
        await scanner.clear()
      } catch {}
    }

    if (!isScannerOpen) {
      scanResolvedRef.current = false
      stopScanner()
      return undefined
    }

    const startScanner = async () => {
      try {
        await warmupCameraAccess()

        if (cancelled) {
          return
        }

        const cameras = await Html5Qrcode.getCameras()

        if (cancelled) {
          return
        }

        if (!cameras.length) {
          showToastMessage(text.report.noCameraDetected)
          setIsScannerOpen(false)
          return
        }

        const rearCamera = cameras.find((camera) =>
          /back|rear|environment/i.test(camera.label ?? ''),
        )
        const scanner = new Html5Qrcode(scannerRegionId)
        scannerInstanceRef.current = scanner

        await scanner.start(
          {
            deviceId: { exact: rearCamera?.id ?? cameras[0].id },
            facingMode: 'environment',
          },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
          },
          (decodedText) => {
            if (scanResolvedRef.current) {
              return
            }

            scanResolvedRef.current = true
            const nextOrderNumber = decodedText.trim()
            handleOrderNumberChange(nextOrderNumber)
            setIsScannerOpen(false)
            showToastMessage(text.report.scanSuccessToast)
            window.setTimeout(() => {
              orderInputRef.current?.focus()
            }, 0)
          },
          () => {},
        )

        const scannerElement = document.getElementById(scannerRegionId)
        const videoElement = scannerElement?.querySelector('video')
        if (videoElement) {
          videoElement.setAttribute('playsinline', 'true')
          videoElement.setAttribute('muted', 'true')
          videoElement.autoplay = true
          videoElement.muted = true
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error('Scanner init error', error)
        const message = String(error?.message ?? error ?? '')
        const denied = /denied|notallowed|permission/i.test(message)
        const unsupported =
          /media-devices-unavailable|secure|https|notsupported|unsupported/i.test(message)

        showToastMessage(
          denied
            ? text.report.cameraAccessDenied
            : unsupported
              ? text.report.cameraOpenUnsupported
              : text.report.noCameraDetected,
        )
        setIsScannerOpen(false)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [isScannerOpen, text.report.cameraAccessDenied, text.report.noCameraDetected, text.report.scanSuccessToast])

  useEffect(() => {
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
  }, [nodeOptions, report.reportNode])

  const refreshReports = async () => {
    const reports = await getReports()
    setEventRecords(reports)
  }

  const warmupCameraAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('media-devices-unavailable')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
      },
    })

    stream.getTracks().forEach((track) => track.stop())
  }

  const handleOpenScanner = () => {
    showToastMessage(text.report.scanOpeningToast)

    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      console.error('Scanner init error: unsupported camera environment')
      showToastMessage(text.report.cameraOpenUnsupported)
      return
    }

    setIsScannerOpen(true)
  }

  const stopVoiceRecognition = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    setIsListening(false)

    if (!recognition) {
      return
    }

    try {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
    } catch {}
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
      if (image.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(image.previewUrl)
      }
    })
  }

  const resetForm = () => {
    setReport((current) => {
      releaseImages(current.images)
      return createEmptyReport()
    })
    setOriginalHistorySupplement(createEmptyOriginalSupplement())
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
        if (imageToRemove.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(imageToRemove.previewUrl)
        }
      }

      return {
        ...current,
        images: current.images.filter((image) => image.id !== imageId),
      }
    })
  }

  const handleSelectNode = (nextNode) => {
    setReport((current) => ({
      ...current,
      reportNode: nextNode,
    }))
  }

  const handleStartVoiceInput = () => {
    showToastMessage(text.report.speechStartingToast)

    if (!SpeechRecognitionConstructor) {
      showToastMessage(
        isIPhoneSafari ? text.report.speechIosFallbackToast : text.report.speechUnsupportedToast,
      )
      return
    }

    if (isListening) {
      stopVoiceRecognition()
      return
    }

    const recognition = new SpeechRecognitionConstructor()
    recognitionRef.current = recognition
    recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? ''

      if (!transcript) {
        return
      }

      setReport((current) => ({
        ...current,
        remarks: current.remarks.trim()
          ? `${current.remarks}\n${transcript}`
          : transcript,
      }))

      window.setTimeout(() => {
        remarksInputRef.current?.focus()
      }, 0)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event)

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToastMessage(text.report.speechDeniedToast)
        return
      }

      if (event.error === 'no-speech') {
        showToastMessage(text.report.speechNoMatchToast)
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)
    }

    try {
      recognition.start()
      setIsListening(true)
      showToastMessage(text.report.speechListeningToast)
    } catch (error) {
      console.error('Speech recognition init error', error)
      recognitionRef.current = null
      setIsListening(false)
      showToastMessage(
        isIPhoneSafari ? text.report.speechIosFallbackToast : text.report.speechUnsupportedToast,
      )
    }
  }

  const handleHistoryToggle = () => {
    if (!historyCount) {
      return
    }

    setShowHistoryList((current) => !current)
  }

  const handleBackToMainForm = () => {
    if (isViewingHistoryOrder) {
      setActiveOrderNumber('')
      resetForm()
    }

    setShowHistoryList(false)
  }

  const handleLoadHistoryOrder = (orderNumber) => {
    const latestSupplementRecord = getLatestSupplementRecord(eventRecords, orderNumber)
    const normalizedImages = normalizeStoredImages(latestSupplementRecord?.images)

    resetForm()
    setActiveOrderNumber(orderNumber)
    setShowHistoryList(false)
    setOriginalHistorySupplement({
      remarks: latestSupplementRecord?.remarks ?? '',
      images: getComparableImages(normalizedImages),
    })
    setReport({
      orderNumber,
      reportNode: '',
      remarks: latestSupplementRecord?.remarks ?? '',
      images: normalizedImages,
    })
  }

  const handleOrderNumberChange = (value) => {
    const normalizedOrderNumber = value.trim()
    const matchedHistoryOrder = historyOrders.find(
      (historyOrder) => historyOrder.orderNumber === normalizedOrderNumber,
    )

    setReport((current) => ({
      ...current,
      orderNumber: value,
    }))

    if (matchedHistoryOrder) {
      handleLoadHistoryOrder(matchedHistoryOrder.orderNumber)
      return
    }

    if (!normalizedOrderNumber || activeOrderNumber === normalizedOrderNumber) {
      setActiveOrderNumber('')
    }
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
      if (isViewingHistoryOrder && !report.reportNode) {
        await completeOrderSupplementRecords(activeOrderNumber, {
          remarks: report.remarks.trim(),
          images: successfulImages,
        })
      } else {
        await createReport({
          orderNumber: report.orderNumber.trim(),
          reportNode: report.reportNode,
          reportResult: null,
          remarks: report.remarks.trim(),
          images: successfulImages,
          ...(isViewingHistoryOrder ? { supplementUpdatedAt: new Date().toISOString() } : {}),
        })
      }
      await refreshReports()
      resetForm()
      setActiveOrderNumber('')
      showToastMessage(hasOptionalContent ? text.report.successToast : text.report.pendingToast)
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

      {historyCount > 0 && (
        <section className="card recent-section">
          <button className="recent-section-header" type="button" onClick={handleHistoryToggle}>
            <div className="recent-section-header-copy">
              <span className="incomplete-banner-copy">
                {formatCopy(text.report.recentBanner, { count: String(historyCount) })}
              </span>
            </div>
            <span className="incomplete-banner-toggle" aria-hidden="true">
              {showHistoryList ? '^' : 'v'}
            </span>
          </button>

          <div className={`recent-sheet-wrap ${showHistoryList ? 'is-open' : ''}`}>
            <div className="recent-sheet">
              {historyOrders.length ? (
                <div className="recent-list">
                  {historyOrders.map((group) => (
                    <button
                      key={group.orderNumber}
                      className="recent-item"
                      type="button"
                      onClick={() => handleLoadHistoryOrder(group.orderNumber)}
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
              ref={orderInputRef}
              className="text-input text-input-with-icon"
              type="text"
              value={report.orderNumber}
              onChange={(event) => handleOrderNumberChange(event.target.value)}
              placeholder={text.report.orderPlaceholder}
              disabled={isViewingHistoryOrder}
            />
            <button
              className="field-action-button"
              type="button"
              onClick={handleOpenScanner}
              disabled={isViewingHistoryOrder}
              aria-label="Scan order number"
            >
              <ScanIcon />
            </button>
          </div>
        </label>

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

        {isViewingHistoryOrder && (
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
              ref={remarksInputRef}
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
              className={`field-action-button field-action-button-bottom ${
                isListening ? 'is-listening' : ''
              }`}
              type="button"
              onClick={handleStartVoiceInput}
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

        <div className="sticky-submit">
          <div className="form-action-bar">
            {isViewingHistoryOrder && (
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

      {isScannerOpen && (
        <div className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
          <div className="scanner-modal__topbar">
            <h2 id="scanner-title" className="scanner-modal__title">
              {text.report.scannerTitle}
            </h2>
            <button
              className="scanner-modal__close"
              type="button"
              onClick={() => setIsScannerOpen(false)}
            >
              {text.report.closeScanner}
            </button>
          </div>

          <div className="scanner-modal__body">
            <div className="scanner-modal__frame">
              <div id={scannerRegionId} className="scanner-modal__viewport" />
            </div>
          </div>
        </div>
      )}

      {showToast && <div className="toast-success">{toastMessage}</div>}
    </section>
  )
}

export default ReportPage

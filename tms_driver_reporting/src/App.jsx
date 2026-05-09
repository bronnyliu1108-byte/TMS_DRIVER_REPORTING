import { useEffect, useState } from 'react'
import './App.css'
import LoginPage from './LoginPage'
import ReportPage from './ReportPage'

const SESSION_STORAGE_KEY = 'TMS_DRIVER_SESSION'

const translations = {
  zh: {
    languageSwitcher: {
      zh: '中文',
      en: 'EN',
    },
    login: {
      eyebrow: 'TMS DRIVER REPORTING',
      title: '司机登录',
      description: '登录后可快速上报签收回单、异常照片和配送信息',
      tabs: {
        account: '账号登录',
        sms: '验证码登录',
      },
      accountLabel: '账号 / 手机号',
      accountPlaceholder: '请输入账号或手机号',
      passwordLabel: '密码',
      passwordPlaceholder: '请输入密码',
      phoneLabel: '手机号',
      phonePlaceholder: '请输入手机号',
      codeLabel: '验证码',
      codePlaceholder: '请输入验证码',
      getCode: '获取验证码',
      signIn: '登录',
      helper: '演示环境：任意账号密码或验证码均可登录',
      agreement: '我已阅读并同意《隐私政策》和《用户协议》',
    },
    report: {
      activeDriver: '当前司机',
      signOut: '退出登录',
      back: '返回',
      orderLabel: '订单号',
      orderPlaceholder: '请输入订单号',
      nodeLabel: '上报节点',
      resultLabel: '上报结果',
      nodeRequired: '请选择上报节点',
      resultRequired: '请选择上报结果',
      nodeLockedHelper: '上报节点已记录，无法修改',
      resultLockedHelper: '上报结果已记录，无法修改',
      supplementRequiredHelper: '请补充备注或上传图片后再提交',
      nodeOptions: {
        arrival: '到达',
        arrivalRerecord: '到达',
        departure: '离开',
        departureRerecord: '离开',
      },
      resultOptions: {
        success: '成功',
        exception: '异常',
      },
      remarksLabel: '订单备注（可选）',
      remarksPlaceholderDefault: '如有需要，可补充说明',
      remarksPlaceholderArrival: '如有需要，可补充说明',
      remarksPlaceholderDeparture: '如有需要，可补充说明',
      remarksPlaceholderException: '请填写异常情况说明',
      uploadLabel: '上传图片（可选）',
      uploadCount: '{count} / 6',
      uploadLimit: '最多上传6张图片',
      uploadTriggerLabel: '添加图片',
      scanTodoToast: '扫码功能待接入',
      scanOpeningToast: '正在打开扫码...',
      scanSuccessToast: '扫码成功',
      cameraAccessDenied: '无法访问摄像头',
      noCameraDetected: '未检测到摄像头',
      cameraOpenUnsupported: '当前浏览器无法打开摄像头，请使用 HTTPS 环境或更换浏览器',
      scannerTitle: '扫码识别',
      closeScanner: '关闭',
      speechListeningToast: '正在语音输入...',
      speechStartingToast: '正在启动语音输入...',
      speechUnsupportedToast: '当前浏览器不支持语音输入',
      speechIosFallbackToast: '当前浏览器不支持语音输入，请使用系统键盘语音输入',
      speechDeniedToast: '麦克风权限被拒绝',
      speechNoMatchToast: '未识别到语音',
      submit: '提交',
      submitting: '提交中...',
      successToast: '上报成功',
      pendingToast: '上报已记录，可稍后补充备注或图片',
      submitFailed: '提交失败，请稍后重试',
      retry: '重试',
      uploadSuccessIconLabel: '上传成功',
      uploadFailedIconLabel: '上传失败',
      removeImageLabel: '删除图片',
      recentBanner: '{count} 订单历史',
      recentSummary: '',
      statusLabel: '状态',
      statusPending: '待补充',
      statusComplete: '已完成',
      recentEmpty: '当前没有待补充上报',
      summaryArrival: '到达',
      summaryDeparture: '离开',
    },
    driverName: '张司机',
  },
  en: {
    languageSwitcher: {
      zh: '中文',
      en: 'EN',
    },
    login: {
      eyebrow: 'TMS DRIVER REPORTING',
      title: 'Driver Sign In',
      description: 'Sign in to quickly report POD, exception photos, and delivery updates.',
      tabs: {
        account: 'Account Login',
        sms: 'Code Login',
      },
      accountLabel: 'Account / Phone',
      accountPlaceholder: 'Enter your account or phone number',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      phoneLabel: 'Phone Number',
      phonePlaceholder: 'Enter your phone number',
      codeLabel: 'Verification Code',
      codePlaceholder: 'Enter verification code',
      getCode: 'Get Code',
      signIn: 'Sign In',
      helper: 'Demo: any account password or verification code works',
      agreement: 'I have read and agree to the Privacy Policy and User Agreement',
    },
    report: {
      activeDriver: 'Active Driver',
      signOut: 'Sign Out',
      back: 'Back',
      orderLabel: 'Order Number',
      orderPlaceholder: 'Enter order number',
      nodeLabel: 'Report Node',
      resultLabel: 'Report Result',
      nodeRequired: 'Please select a report node',
      resultRequired: 'Please select a report result',
      nodeLockedHelper: 'Report node is already recorded and cannot be changed.',
      resultLockedHelper: 'Report result is already recorded and cannot be changed.',
      supplementRequiredHelper: 'Add remarks or upload an image before submitting.',
      nodeOptions: {
        arrival: 'Arrival',
        arrivalRerecord: 'Arrival',
        departure: 'Departure',
        departureRerecord: 'Departure',
      },
      resultOptions: {
        success: 'Success',
        exception: 'Exception',
      },
      remarksLabel: 'Order Remarks (Optional)',
      remarksPlaceholderDefault: 'Add notes if needed',
      remarksPlaceholderArrival: 'Add notes if needed',
      remarksPlaceholderDeparture: 'Add notes if needed',
      remarksPlaceholderException: 'Describe the exception details',
      uploadLabel: 'Upload Images (Optional)',
      uploadCount: '{count} / 6',
      uploadLimit: 'Maximum 6 images',
      uploadTriggerLabel: 'Add image',
      scanTodoToast: 'Scan feature pending integration',
      scanOpeningToast: 'Opening scanner...',
      scanSuccessToast: 'Scan successful',
      cameraAccessDenied: 'Camera access denied',
      noCameraDetected: 'No camera detected',
      cameraOpenUnsupported: 'This browser cannot open the camera. Please use HTTPS or switch browsers.',
      scannerTitle: 'Scan Code',
      closeScanner: 'Close',
      speechListeningToast: 'Listening...',
      speechStartingToast: 'Starting voice input...',
      speechUnsupportedToast: 'Speech input not supported',
      speechIosFallbackToast: 'Speech input not supported. Please use iOS keyboard voice input.',
      speechDeniedToast: 'Microphone permission denied',
      speechNoMatchToast: 'No speech detected',
      submit: 'Submit',
      submitting: 'Submitting...',
      successToast: 'Report submitted',
      pendingToast: 'Report saved. You can add remarks or images later.',
      submitFailed: 'Submission failed. Please try again later.',
      retry: 'Retry',
      uploadSuccessIconLabel: 'Upload succeeded',
      uploadFailedIconLabel: 'Upload failed',
      removeImageLabel: 'Remove image',
      recentBanner: '{count} Order History',
      recentSummary: '',
      statusLabel: 'Status',
      statusPending: 'Pending Details',
      statusComplete: 'Completed',
      recentEmpty: 'No incomplete reports right now',
      summaryArrival: 'Arrival',
      summaryDeparture: 'Departure',
    },
    driverName: 'Alex Driver',
  },
}

const initialDriver = {
  name: '',
  id: '',
}

function App() {
  const [language, setLanguage] = useState('zh')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [driver, setDriver] = useState(initialDriver)
  const copy = translations[language]

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY)

      if (!rawSession) {
        return
      }

      const parsedSession = JSON.parse(rawSession)
      const savedDriver = parsedSession?.driver

      if (
        parsedSession?.isLoggedIn === true &&
        savedDriver &&
        typeof savedDriver.name === 'string' &&
        typeof savedDriver.id === 'string'
      ) {
        setDriver({
          name: savedDriver.name,
          id: savedDriver.id,
        })
        setIsLoggedIn(true)
        return
      }

      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [])

  const handleLogin = ({ account, password, phone, code, method }) => {
    const accountReady = method === 'account' && account.trim() && password.trim()
    const codeReady = method === 'sms' && phone.trim() && code.trim()

    if (!accountReady && !codeReady) {
      return
    }

    const nextDriver = {
      name: copy.driverName,
      id: method === 'account' ? account.trim() : phone.trim(),
    }

    setDriver(nextDriver)
    setIsLoggedIn(true)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          isLoggedIn: true,
          driver: nextDriver,
        }),
      )
    }
  }

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setDriver(initialDriver)
    setIsLoggedIn(false)
  }

  return (
    <main className="app-shell">
      <div className="phone-frame">
        {isLoggedIn ? (
          <ReportPage
            driver={driver}
            onSignOut={handleReset}
            language={language}
            onLanguageChange={setLanguage}
            text={copy}
          />
        ) : (
          <LoginPage
            onLogin={handleLogin}
            language={language}
            onLanguageChange={setLanguage}
            text={copy}
          />
        )}
      </div>
    </main>
  )
}

export default App

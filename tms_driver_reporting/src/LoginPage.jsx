import { useState } from 'react'

function LoginPage({ onLogin, language, onLanguageChange, text }) {
  const [loginMethod, setLoginMethod] = useState('sms')
  const [form, setForm] = useState({
    account: '',
    password: '',
    phone: '',
    code: '',
  })
  const [agreed, setAgreed] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onLogin({
      ...form,
      method: loginMethod,
    })
  }

  const isReady =
    agreed &&
    ((loginMethod === 'account' && form.account.trim() && form.password.trim()) ||
      (loginMethod === 'sms' && form.phone.trim() && form.code.trim()))

  const agreementCopy =
    language === 'zh'
      ? {
          prefix: '我已阅读并同意',
          privacy: '《隐私政策》',
          joiner: '和',
          terms: '《用户协议》',
        }
      : {
          prefix: 'I have read and agree to the',
          privacy: 'Privacy Policy',
          joiner: 'and',
          terms: 'User Agreement',
        }

  return (
    <section className="screen screen-login">
      <div className="top-bar">
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

      <div className="screen-copy">
        <p className="eyebrow">{text.login.eyebrow}</p>
      </div>

      <form className="card form-card login-card" onSubmit={handleSubmit}>
        <div className="login-input-area">
          <div className="login-tabs" role="tablist" aria-label="Login method">
            <button
              className={`login-tab ${loginMethod === 'account' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setLoginMethod('account')}
            >
              {text.login.tabs.account}
            </button>
            <button
              className={`login-tab ${loginMethod === 'sms' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setLoginMethod('sms')}
            >
              {text.login.tabs.sms}
            </button>
          </div>

          {loginMethod === 'account' ? (
            <>
              <label className="field">
                <span className="field-label">{text.login.accountLabel}</span>
                <input
                  className="text-input"
                  type="text"
                  name="account"
                  value={form.account}
                  onChange={handleChange}
                  placeholder={text.login.accountPlaceholder}
                />
              </label>

              <label className="field">
                <span className="field-label">{text.login.passwordLabel}</span>
                <input
                  className="text-input"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={text.login.passwordPlaceholder}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">{text.login.phoneLabel}</span>
                <input
                  className="text-input"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder={text.login.phonePlaceholder}
                />
              </label>

              <label className="field">
                <span className="field-label">{text.login.codeLabel}</span>
                <div className="code-row">
                  <input
                    className="text-input"
                    type="text"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder={text.login.codePlaceholder}
                  />
                  <button className="secondary-button" type="button">
                    {text.login.getCode}
                  </button>
                </div>
              </label>
            </>
          )}
        </div>

        <div className="login-action-area">
          <div className="agreement-row">
            <input
              id="login-agreement"
              className="agreement-checkbox"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <div className="agreement-copy">
              <label className="agreement-label" htmlFor="login-agreement">
                {agreementCopy.prefix}
              </label>
              <a className="agreement-link" href="/privacy" target="_blank" rel="noreferrer">
                {agreementCopy.privacy}
              </a>
              <span className="agreement-text">{agreementCopy.joiner}</span>
              <a className="agreement-link" href="/terms" target="_blank" rel="noreferrer">
                {agreementCopy.terms}
              </a>
            </div>
          </div>

          <button className="primary-button" type="submit" disabled={!isReady}>
            {text.login.signIn}
          </button>
        </div>
      </form>
    </section>
  )
}

export default LoginPage

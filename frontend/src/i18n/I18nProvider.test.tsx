import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageToggle } from '../components/layout/LanguageToggle'
import { useI18n } from '../hooks/useI18n'
import { I18nProvider } from './I18nProvider'
import { ar } from './ar'
import { en } from './en'
import { LANGUAGE_KEY } from './i18nContext'
import { isPlural, type Message } from './messages'

function Plurals() {
  const { t } = useI18n()
  const counts = [1, 2, 3, 11]
  return <p data-testid="plurals">{counts.map((c) => t('detail.entries', { count: c })).join('|')}</p>
}

function Probe() {
  const { t, language, direction } = useI18n()
  return (
    <>
      <p data-testid="state">{`${language}/${direction}`}</p>
      <p data-testid="nav">{t('nav.myRequests')}</p>
      <p data-testid="entries">{t('detail.entries', { count: 3 })}</p>
      <p data-testid="sentence">{t('timeline.created', { actor: 'Sam' })}</p>
    </>
  )
}

function renderI18n() {
  return render(
    <I18nProvider>
      <LanguageToggle />
      <Probe />
    </I18nProvider>,
  )
}

const state = () => screen.getByTestId('state').textContent
const text = (id: string) => screen.getByTestId(id).textContent

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * The catalogues are kept in step by the type system — `ar` is typed as
 * Catalogue, so a missing key will not compile. This asserts the parts types
 * cannot: that nothing was left blank, and that a plural entry carries the
 * forms its language actually uses.
 */
describe('the catalogues', () => {
  it('cover exactly the same keys', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
  })

  it('leaves nothing blank in either language', () => {
    const all: [string, Message][] = [...Object.entries(en), ...Object.entries(ar)]

    for (const [key, message] of all) {
      const forms = isPlural(message) ? Object.values(message) : [message]
      for (const form of forms) {
        expect(form.trim(), `${key} is empty`).not.toBe('')
      }
    }
  })

  // Arabic distinguishes six; writing only the English pair would be wrong for
  // roughly half the numbers a queue actually shows.
  it('gives Arabic plurals more than the two forms English needs', () => {
    for (const [key, message] of Object.entries(ar) as [string, Message][]) {
      if (!isPlural(message)) continue
      expect(Object.keys(message).length, `${key} has only English plural forms`).toBeGreaterThan(2)
    }
  })

  it('agrees on which entries are plural at all', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(isPlural(ar[key]), `${key} disagrees on plurality`).toBe(isPlural(en[key]))
    }
  })
})

describe('choosing a language', () => {
  it('starts in English when the browser asks for English', () => {
    renderI18n()

    expect(state()).toBe('en/ltr')
    expect(text('nav')).toBe('My requests')
  })

  // Someone whose browser is Arabic should not have to find a setting before
  // the tool speaks to them.
  it('starts in Arabic when the browser asks for Arabic', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar-EG')

    renderI18n()

    expect(state()).toBe('ar/rtl')
  })

  it('switches the words when Arabic is chosen', async () => {
    renderI18n()

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    expect(text('nav')).toBe('طلباتي')
  })

  // Translating the words while the layout still runs the other way reads as a
  // broken page rather than a foreign one.
  it('switches the page direction, not just the words', async () => {
    renderI18n()
    expect(document.documentElement.dir).toBe('ltr')

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('remembers the choice for next time', async () => {
    renderI18n()

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('ar')
  })

  it('restores a stored choice over the browser preference', () => {
    localStorage.setItem(LANGUAGE_KEY, 'ar')

    renderI18n()

    expect(state()).toBe('ar/rtl')
  })

  it('ignores a stored value that is not a language', () => {
    localStorage.setItem(LANGUAGE_KEY, 'klingon')

    renderI18n()

    expect(state()).toBe('en/ltr')
  })

  it('offers each language written in itself', () => {
    renderI18n()

    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['English', 'العربية'])
  })
})

describe('building a sentence', () => {
  it('interpolates into the whole phrase rather than concatenating fragments', () => {
    renderI18n()

    expect(text('sentence')).toBe('Sam submitted this request')
  })

  // Word order is not the same in both languages — the actor lands after the
  // verb in Arabic, which is only possible if the whole sentence is one entry.
  it('puts the actor where the language puts it', async () => {
    renderI18n()

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    expect(text('sentence')).toBe('قدّم Sam هذا الطلب')
  })

  it('picks the English plural', () => {
    renderI18n()

    expect(text('entries')).toBe('3 entries')
  })

  // 3 is `few` in Arabic — a different word from the one 1 or 11 would take,
  // and one English has no equivalent for. Digits stay Latin: generic `ar`
  // resolves that way in CLDR, and it matches the Latin reference numbers this
  // UI shows beside them.
  it('picks the Arabic plural form, which English has no equivalent for', async () => {
    renderI18n()

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    expect(text('entries')).toBe('3 أحداث')
  })

  it('picks a different Arabic form again for a number English would treat the same', async () => {
    render(
      <I18nProvider>
        <LanguageToggle />
        <Plurals />
      </I18nProvider>,
    )

    await userEvent.click(screen.getByRole('radio', { name: 'العربية' }))

    // one / two / few / many — four distinct words where English has one.
    expect(screen.getByTestId('plurals').textContent).toBe(
      'حدث واحد|حدثان|3 أحداث|11 حدثًا',
    )
  })
})

describe('useI18n outside a provider', () => {
  it('says so rather than rendering keys at a user', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/I18nProvider/)

    consoleError.mockRestore()
  })
})

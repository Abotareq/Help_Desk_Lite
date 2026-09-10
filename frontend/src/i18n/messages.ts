/**
 * A message is either a plain string or a set of plural forms.
 *
 * Which forms exist is decided by the language, not by us: English needs two,
 * Arabic needs up to six (zero, one, two, few, many, other). Intl.PluralRules
 * picks the right one, so nothing here has to know the rules for a language it
 * was not written for.
 */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>

export type Message = string | PluralForms

/** Values interpolated into `{placeholders}`. `count` also selects the plural. */
export type MessageVars = Record<string, string | number>

export function isPlural(message: Message): message is PluralForms {
  return typeof message !== 'string'
}

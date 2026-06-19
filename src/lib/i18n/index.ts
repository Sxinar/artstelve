export type Locale = 'tr' | 'en' | 'de' | 'fr' | 'es';
export const defaultLocale: Locale = 'tr';
class I18n {
  private currentLocale: Locale = defaultLocale;
  setLocale(locale: Locale): void {
    this.currentLocale = locale;
  }
  t(key: string): string {
    return key;
  }
}
export const i18n = new I18n();

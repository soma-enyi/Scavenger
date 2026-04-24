import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../config';

describe('i18n Configuration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should initialize with English as default', () => {
    expect(i18n.language).toBe('en');
  });

  it('should change language to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.language).toBe('es');
  });

  it('should change language to French', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.language).toBe('fr');
  });

  it('should change language to Chinese', async () => {
    await i18n.changeLanguage('zh');
    expect(i18n.language).toBe('zh');
  });

  it('should translate common.loading in English', () => {
    expect(i18n.t('common.loading')).toBe('Loading...');
  });

  it('should translate common.loading in Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('common.loading')).toBe('Cargando...');
  });

  it('should translate error messages', () => {
    expect(i18n.t('errors.network')).toBe('Network error occurred');
  });

  it('should fallback to English for missing translations', async () => {
    await i18n.changeLanguage('invalid');
    expect(i18n.language).toContain('en');
  });

  it('should persist language preference', async () => {
    await i18n.changeLanguage('fr');
    const stored = localStorage.getItem('i18nextLng');
    expect(stored).toBe('fr');
  });
});

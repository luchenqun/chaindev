'use client';

import { useEffect } from 'react';
import { useLocale } from '@/i18n/locale-provider';
import { translateRuntimeAttribute, translateRuntimeText } from '@/i18n/runtime-translations';

const OBSERVED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;

function shouldTranslateTextNode(node: Text) {
  const text = node.textContent?.trim();

  if (!text) {
    return false;
  }

  if (/^0x[0-9a-fA-F]+$/.test(text) || /^\d+(\.\d+)?$/.test(text)) {
    return false;
  }

  return /[A-Za-z]/.test(text);
}

function translateTextNode(node: Text, locale: 'en' | 'zh') {
  const original = node.textContent ?? '';
  const storedOriginal = node.parentElement?.dataset.i18nOriginalText;
  const source = storedOriginal ?? original;
  const translated = translateRuntimeText(source.trim(), locale);

  if (translated !== source.trim() && node.parentElement && !storedOriginal) {
    node.parentElement.dataset.i18nOriginalText = source.trim();
  }

  if (source.trim() !== translated) {
    node.textContent = original.replace(source.trim(), translated);
  } else if (locale === 'en' && storedOriginal) {
    node.textContent = original.replace(source.trim(), storedOriginal);
    delete node.parentElement?.dataset.i18nOriginalText;
  }
}

function translateElementAttributes(element: Element, locale: 'en' | 'zh') {
  for (const attribute of OBSERVED_ATTRIBUTES) {
    const value = element.getAttribute(attribute);

    if (!value) {
      continue;
    }

    const datasetKey = `i18nOriginal${attribute.replace(/(^|-)(\w)/g, (_match, _prefix, char) => char.toUpperCase())}`;
    const original = element.getAttribute(`data-${datasetKey}`) ?? value;
    const translated = translateRuntimeAttribute(original, locale);

    if (translated !== original && !element.hasAttribute(`data-${datasetKey}`)) {
      element.setAttribute(`data-${datasetKey}`, original);
    }

    if (locale === 'en' && element.hasAttribute(`data-${datasetKey}`)) {
      element.setAttribute(attribute, element.getAttribute(`data-${datasetKey}`) ?? original);
      element.removeAttribute(`data-${datasetKey}`);
      continue;
    }

    if (translated !== original) {
      element.setAttribute(attribute, translated);
    }
  }
}

function translateDocument(locale: 'en' | 'zh') {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    if (shouldTranslateTextNode(node)) {
      translateTextNode(node, locale);
    }
  });

  document.querySelectorAll('*').forEach((element) => {
    translateElementAttributes(element, locale);
  });
}

export function LocaleDomBridge() {
  const { locale } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
    translateDocument(locale);

    const observer = new MutationObserver(() => {
      translateDocument(locale);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...OBSERVED_ATTRIBUTES],
    });

    return () => {
      observer.disconnect();
    };
  }, [locale]);

  return null;
}

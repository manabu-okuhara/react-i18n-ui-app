function createAiLocaleReviewInput(bundle) {
  return {
    locale: {
      inputLocale: bundle.inputLocale,
      localeUsed: bundle.localeUsed,
      bundleLocale: bundle.bundleLocale,
      formattingLocale: bundle.formattingLocale,
      labelLanguage: bundle.labelLanguage,
      bundleSource: bundle.bundleSource,
      usedFallback: bundle.usedFallback,
      fallbackReason: bundle.fallbackReason,
      isMixedLocale: bundle.isMixedLocale
    },
    values: {
      languageName: bundle.values?.languageName,
      regionName: bundle.values?.regionName,
      currentDate: bundle.values?.currentDate,
      formattedNumber: bundle.values?.formattedNumber,
      percentValue: bundle.values?.percentValue,
      firstDayOfWeek: bundle.values?.firstDayOfWeek
    },
    messages: {
      title: bundle.messages?.title,
      inputLocaleSentence: bundle.messages?.inputLocaleSentence,
      languageSentence: bundle.messages?.languageSentence,
      regionSentence: bundle.messages?.regionSentence,
      dateSentence: bundle.messages?.dateSentence,
      numberSentence: bundle.messages?.numberSentence,
      percentSentence: bundle.messages?.percentSentence,
      firstDayOfWeekSentence: bundle.messages?.firstDayOfWeekSentence,
      pluralSentence: bundle.messages?.pluralSentence
    }
  };
}

function createAiLocaleReviewRequest(bundle) {
  return [
    'You are reviewing a localized UI result for an internationalization demo application.',
    'Evaluate the output rather than rewriting it.',
    'Focus on translation quality, terminology consistency, placeholder safety, plural clarity, and whether labels and formatted values feel coherent together.',
    'Return JSON only that matches the requested schema.',
    JSON.stringify(createAiLocaleReviewInput(bundle), null, 2)
  ].join('\n\n');
}

module.exports = {
  createAiLocaleReviewRequest
};

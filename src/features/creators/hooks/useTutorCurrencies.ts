import { useEffect, useState } from "react";
import { getPublicTutorCurrencies, type PublicTutorCurrencies } from "@/api/tutorCurrencies";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/utils/currency";

/**
 * The currencies the system admin has made available to tutors, or null until they load. A failed
 * load stays null, so callers fall back to every supported currency - the server still refuses a
 * disabled one.
 */
export function useTutorCurrencies(enabled = true): PublicTutorCurrencies | null {
  const [currencies, setCurrencies] = useState<PublicTutorCurrencies | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.resolve()
      .then(getPublicTutorCurrencies)
      .then((loaded) => {
        if (!cancelled && loaded) setCurrencies(loaded);
      })
      .catch(() => {
        // Keep every supported currency on offer.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return currencies;
}

/**
 * The currencies a tutor's picker offers: the enabled ones, plus `current` when it has since been
 * switched off - a saved profile or running subscription keeps its currency, and the select must
 * never show a blank value.
 */
export function tutorCurrencyOptions(
  currencies: PublicTutorCurrencies | null,
  current?: SupportedCurrency | null,
): SupportedCurrency[] {
  if (!currencies) return [...SUPPORTED_CURRENCIES];
  return SUPPORTED_CURRENCIES.filter(
    (code) => currencies.enabled.includes(code) || code === current,
  );
}

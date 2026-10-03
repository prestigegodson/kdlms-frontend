import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";
import { currencySymbol } from "@/utils/currency";

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> {
  currency: string;
}

/**
 * A text field for a money amount with the currency symbol as a leading adornment, opening the
 * phone's decimal keypad (`inputMode="decimal"`, not `type="number"`, which mangles grouping
 * commas and lets a scroll wheel change the value). Parse what it holds with `parseAmount`.
 */
export function MoneyInput({ currency, className = "", ...props }: MoneyInputProps) {
  const symbol = currencySymbol(currency);
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500 mobile:text-base"
        aria-hidden="true"
      >
        {symbol}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${symbol.length > 1 ? "pl-12" : "pl-7"} ${className}`}
        {...props}
      />
    </div>
  );
}

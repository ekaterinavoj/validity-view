import { Input } from "@/components/ui/input";

interface SuggestedTextInputProps {
  id: string;
  /** Previously-used values to offer as native autocomplete suggestions. */
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Plain text input with a native browser autocomplete dropdown built from values
 * already used elsewhere in the app (e.g. company names, doctors, medical facilities —
 * external entities we don't have a structured record for, unlike employees).
 *
 * Deliberately uses the native <datalist> instead of a custom combobox: it needs no
 * popover/open-state logic, works with keyboard and mouse out of the box, and still
 * lets the user type anything that isn't in the list — the simplest option that
 * actually solves "stop retyping the same company name slightly differently every time".
 */
export function SuggestedTextInput({
  id,
  suggestions,
  value,
  onChange,
  placeholder,
  disabled,
}: SuggestedTextInputProps) {
  const listId = `${id}-suggestions`;
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

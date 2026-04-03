import { type InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export function Input({
  label,
  containerClassName,
  labelClassName,
  inputClassName,
  ...props
}: InputProps) {
  return (
    <div className={containerClassName} style={{ display: "grid", gap: 8 }}>
      {label ? (
        <label className={labelClassName} style={{ fontSize: 14, color: "#4b5563" }}>
          {label}
        </label>
      ) : null}
      <input
        className={inputClassName}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 16,
        }}
        {...props}
      />
    </div>
  );
}

import { type ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  className?: string;
  textClassName?: string;
};

export function Button({
  label,
  className,
  textClassName,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className}
      style={{
        borderRadius: 8,
        border: "none",
        padding: "12px 16px",
        background: "#2563eb",
        color: "white",
        fontWeight: 600,
        cursor: "pointer",
      }}
      {...props}
    >
      <span className={textClassName}>{label}</span>
    </button>
  );
}

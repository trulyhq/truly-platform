import { Pressable, Text, type PressableProps } from "react-native";

export type ButtonProps = PressableProps & {
  label: string;
  className?: string;
  textClassName?: string;
};

export function Button({
  label,
  className = "bg-blue-600 px-4 py-3 rounded-lg",
  textClassName = "text-white font-semibold text-center",
  ...props
}: ButtonProps) {
  return (
    <Pressable className={className} accessibilityRole="button" {...props}>
      <Text className={textClassName}>{label}</Text>
    </Pressable>
  );
}

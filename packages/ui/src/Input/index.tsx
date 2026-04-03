import { TextInput, type TextInputProps, View, Text } from "react-native";

export type InputProps = TextInputProps & {
  label?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export function Input({
  label,
  containerClassName = "gap-2",
  labelClassName = "text-sm text-gray-600",
  inputClassName = "border border-gray-300 rounded-lg px-3 py-2 text-base",
  ...props
}: InputProps) {
  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName}>{label}</Text> : null}
      <TextInput className={inputClassName} {...props} />
    </View>
  );
}

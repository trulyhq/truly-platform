# @truly/ui

Shared universal UI primitives for Truly apps.

## Included components

- `Button`
- `Input`

## Usage

```tsx
import { Button, Input } from "@truly/ui";

export function LoginForm() {
  return (
    <>
      <Input
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <Input label="Password" placeholder="••••••••" secureTextEntry />
      <Button label="Sign in" />
    </>
  );
}
```

## Notes

- Components use `className` on React Native elements and are intended to be styled by NativeWind in consuming apps.
- Web/mobile app-level NativeWind/Tailwind config is handled in each app during Phase 4 steps 2 and 3.

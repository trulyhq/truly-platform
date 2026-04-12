import type { ExpoConfig } from "expo/config";

const appVariant = process.env.APP_VARIANT ?? "production";

const getBundleIdentifier = () => {
  if (appVariant === "staging") {
    return "com.trulyhq.trulymobile.staging";
  }

  return "com.trulyhq.trulymobile";
};

const getAppName = () => {
  if (appVariant === "staging") {
    return "Truly Mobile (Staging)";
  }

  return "Truly Mobile";
};

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const bundleIdentifier = getBundleIdentifier();

  return {
    ...config,
    name: getAppName(),
    ios: {
      ...config.ios,
      bundleIdentifier,
      infoPlist: {
        ...config.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...config.android,
      package: bundleIdentifier,
    },
    extra: {
      ...config.extra,
      appVariant,
    },
  };
};

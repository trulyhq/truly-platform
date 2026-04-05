const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

// ── Monorepo: let Metro see the entire workspace ──
config.watchFolders = [workspaceRoot];
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// ── Force a single copy of react & react-native ──
// The root node_modules has react@18.3.1 (for Next.js / styled-jsx), but the
// mobile app needs react@19.1.0. Without this, any workspace package
// (e.g. @truly/ui at packages/ui/) that imports "react" or
// "react/jsx-runtime" will walk up to root and get the wrong version.
//
// `extraNodeModules` is only a *fallback*; it doesn't override normal
// resolution. We need `resolveRequest` to intercept BEFORE resolution.
const mobileModules = path.resolve(projectRoot, "node_modules");

const forcedModules = {
  react: path.resolve(mobileModules, "react"),
  "react-native": path.resolve(mobileModules, "react-native"),
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exact match: "react", "react-native"
  if (forcedModules[moduleName]) {
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      forcedModules[moduleName],
      platform
    );
  }

  // Sub-path match: "react/jsx-runtime", "react/jsx-dev-runtime",
  // "react-native/Libraries/..." etc.
  for (const [pkg, pkgPath] of Object.entries(forcedModules)) {
    if (moduleName.startsWith(pkg + "/")) {
      const subPath = moduleName.slice(pkg.length);
      return context.resolveRequest(
        { ...context, resolveRequest: undefined },
        pkgPath + subPath,
        platform
      );
    }
  }

  // Everything else: default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest({ ...context, resolveRequest: undefined }, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});

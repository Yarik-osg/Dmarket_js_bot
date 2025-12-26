// Polyfill for require in webpack-dev-server client
// Returns a no-op function to prevent errors in Electron renderer
export default function require(module) {
    console.warn('require() called but not available in Electron renderer:', module);
    return {};
}


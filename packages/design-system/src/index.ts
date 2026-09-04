// Entry point for @collega/design-system.
//
// Deliberately non-empty while the package has no real code: the layer gate in
// eslint.config.js classifies an import by its *resolved* path, and tsconfig.eslint.json
// maps @collega/* here. With no file to resolve to, a cross-layer import reads as an
// external package and the boundaries rule passes silently — the gate looks configured
// and enforces nothing. Slices replace this export as they land.
export const PACKAGE_NAME = "@collega/design-system";

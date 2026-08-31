# datocms-listen

## 1.0.4

### Patch Changes

- 5436397: Require `@datocms/cda-client` 0.3.1, which keeps the API token out of its errors
  
  The dependency was pinned to `^0.2.5`, a range that cannot reach the release
  where `ApiError` stopped carrying the API token in clear text. This package
  never puts a token in an error of its own — it only borrows `buildRequestHeaders`
  from the client — but the old copy stayed in the dependency tree of everyone
  installing it, ours included.

## [0.1.0] - 2020-11-04

### Added

- First release!

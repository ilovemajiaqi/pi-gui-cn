// Guards assert on repository-relative paths, and those assertions use "/" so
// they read the same on every platform. `path.relative` yields "\" on Windows,
// so every guard that prints a path must normalize through here before it is
// reported. Keeping one helper also stops the next guard from reintroducing
// the platform-specific spelling.
import path from "node:path";

/** Repository-relative path with POSIX separators, stable on every platform. */
export function relativePosix(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

/** Normalize a path so two spellings of the same file compare equal. */
export function normalizePath(target) {
  return path.resolve(target).split(path.sep).join("/");
}

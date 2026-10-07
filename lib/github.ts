export const GITHUB_REPO = 'https://github.com/patrik64/pi-mono';
/** Package directory inside the monorepo. */
export const PACKAGE_DIR = 'packages/coding-agent';
export const DOCS_URL = 'https://github.com/patrik64/pi-mono/tree/main/packages/coding-agent/docs';

/** Blob URL for a repo-relative path like `src/core/agent-session.ts`. */
export function githubBlobUrl(sourcePath: string): string {
  return `${GITHUB_REPO}/blob/main/${PACKAGE_DIR}/${sourcePath}`;
}

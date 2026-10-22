/**
 * Resolve Vite's `base` path.
 *  - BASE_PATH env wins (e.g. BASE_PATH=/my-repo/).
 *  - On GitHub Actions it is derived from GITHUB_REPOSITORY:
 *      owner/planner      -> /planner/
 *      owner/owner.github.io -> /
 *  - Locally it is "/".
 * @param {Record<string,string|undefined>} env
 */
export function resolveBase(env) {
  const normalize = (p) => {
    let s = p.trim()
    if (!s.startsWith('/')) s = '/' + s
    if (!s.endsWith('/')) s += '/'
    return s
  }
  if (env.BASE_PATH) return normalize(env.BASE_PATH)
  const repo = env.GITHUB_REPOSITORY ? env.GITHUB_REPOSITORY.split('/')[1] : undefined
  if (env.GITHUB_ACTIONS && repo) {
    return repo.toLowerCase().endsWith('.github.io') ? '/' : `/${repo}/`
  }
  return '/'
}

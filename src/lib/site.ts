/**
 * Lives here rather than in the header so the header and the menu it renders
 * can both read it — importing it from the header made the two files a cycle,
 * and the menu's link list is evaluated at module scope.
 */
export const GITHUB_URL = 'https://github.com/t1dotdev/toprompt'

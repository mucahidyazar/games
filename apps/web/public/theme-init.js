// Runs before the stylesheet/React so a saved Light theme never flashes Navy.
(() => {
  let theme = 'navy'
  try { if (localStorage.getItem('games.theme') === 'light') theme = 'light' } catch { /* Storage is optional. */ }
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'navy' ? 'dark' : 'light'
})()

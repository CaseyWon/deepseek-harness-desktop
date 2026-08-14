const desktop = window.dshDesktop
const statusLabel = document.querySelector('#status-label')
const statusTitle = document.querySelector('#status-title')
const statusDetail = document.querySelector('#status-detail')
const progressBar = document.querySelector('#progress-bar')
const errorActions = document.querySelector('#error-actions')
const version = document.querySelector('#version')
const stepOrder = ['preparing', 'starting', 'connecting']

function renderStage(stage) {
  document.body.classList.toggle('error', stage.phase === 'error')
  document.body.classList.toggle('ready', stage.phase === 'ready')
  statusLabel.textContent = stage.phase === 'error' ? 'STARTUP INTERRUPTED' : stage.phase === 'ready' ? 'READY' : 'INITIALIZING'
  statusTitle.textContent = stage.title
  statusDetail.textContent = stage.detail
  progressBar.style.width = `${Math.max(4, stage.progress)}%`
  errorActions.hidden = stage.phase !== 'error'

  const current = Math.max(0, stepOrder.indexOf(stage.phase))
  document.querySelectorAll('.steps li').forEach((item, index) => {
    item.classList.toggle('active', stage.phase !== 'error' && index === current)
    item.classList.toggle('done', stage.phase === 'ready' || index < current)
  })
}

desktop.onStage(renderStage)
desktop.getState().then(state => {
  version.textContent = `Desktop ${state.version} · ${state.platform.toUpperCase()}`
})

document.querySelectorAll('[data-window]').forEach(button => {
  button.addEventListener('click', () => desktop.windowAction(button.dataset.window))
})
document.querySelector('#retry-button').addEventListener('click', () => desktop.restart())
document.querySelector('#log-button').addEventListener('click', () => desktop.openLog())
document.querySelector('#project-link').addEventListener('click', () => desktop.openProject())

renderStage({
  phase: 'preparing',
  title: '正在准备桌面环境',
  detail: '读取窗口与本地运行配置',
  progress: 12,
})

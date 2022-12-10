import 'github-markdown-css'
import 'highlight.js/styles/atom-one-dark.css'
import i18next from 'i18next';
import MarkdownIt from 'markdown-it'
import hljs from "highlight.js";
import ClipboardJS from 'clipboard';
import Browser from 'webextension-polyfill'
import { config } from './search-engine-configs.mjs'
import './styles.css'
import { getPossibleElementByQuerySelector } from './utils.mjs'

const resources = {
  en: {
    translation: {
      'loading': 'Waiting for ChatGPT response...',
      'response': {
        'title': '**ChatGPT:**',
        'unauthorized': 'Please login at <a href="https://chat.openai.com" target="_blank">chat.openai.com</a> first',
        'failed': 'Failed to load response from ChatGPT'
      },
      'copy': 'Copy code',
      'copied': 'Copied!',
    }
  },
  'zh-CN': {
    translation: {
      'loading': '👩‍🔬：请耐心等待返回智能搜索结果...',
      'response': {
        'title': '**🤔智能搜索:**',
        'unauthorized': '请先登录 <a href="https://chat.openai.com" target="_blank">官网网站</a>获得更好体验',
        'failed': '当前搜索人数太多，请刷新后重试'
      },
      'copy': '复制代码',
      'copied': '已复制!',
    }
  }
}

i18next.init({
  lng: navigator.language || navigator.userLanguage,
  resources
});
const { t } = i18next

const SVG = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
</svg>`

function getCopyBtnHTML(text) {
  return `<button class="copy-btn" data-clipboard-text="${text}">${SVG}${t('copy')}</button>`
}

function getCodeHTML(html, text) {
  return `<div class="code-block">
  <div class="copy-btn-wrapper">${getCopyBtnHTML(text)}</div>
  <pre>
    <code class="hljs">${html}</code>
  </pre>
</div>`
}

async function run(question, siteConfig) {
  const markdown = new MarkdownIt({
    highlight: function (str) {
      try {
        return getCodeHTML(hljs.highlightAuto(str).value, str);
      } catch (__) { /* empty */ }
  
      return getCodeHTML(markdown.utils.escapeHtml(str), str);
    }
  })

  const container = document.createElement('div')
  container.className = 'chat-gpt-container'
  container.innerHTML = `<p class="gpt-loading">${t('loading')}</p>`

  const siderbarContainer = getPossibleElementByQuerySelector(siteConfig.sidebarContainerQuery)
  if (siderbarContainer) {
    siderbarContainer.prepend(container)
  } else {
    container.classList.add('sidebar-free')
    const appendContainer = getPossibleElementByQuerySelector(siteConfig.appendContainerQuery)
    if (appendContainer) {
      appendContainer.appendChild(container)
    }
  }

  const clipboard = new ClipboardJS('.copy-btn');
  clipboard.on('success', function(e) {
    const button = e.trigger
    if (button) {
      button.classList.add('copied')
      button.innerHTML = `${SVG}${t('copied')}`
      // revert 1 second later
      let timer = setTimeout(function() {
        button.classList.remove('copied')
        button.innerHTML = `${SVG}${t('copy')}`
        setTimeout(timer)
        timer = null
      }, 3000)
    }
  });

  const port = Browser.runtime.connect()
  port.onMessage.addListener(function (msg) {
    if (msg.answer) {
      container.innerHTML = '<div id="answer" class="markdown-body" dir="auto"></div>'
      container.querySelector('#answer').innerHTML = markdown.render(
        `${t('response.title')}\n\n${msg.answer}`,
      )
    } else if (msg.error === 'UNAUTHORIZED') {
      container.innerHTML = `<p>${t('response.unauthorized')}</p>`
    } else {
      container.innerHTML = `<p>${t('response.failed')}</p>`
    }
  })
  port.postMessage({ question })
}

const siteRegex = new RegExp(Object.keys(config).join('|'))
const siteName = location.hostname.match(siteRegex)[0]

const searchInput = getPossibleElementByQuerySelector(config[siteName].inputQuery)
if (searchInput && searchInput.value) {
  // only run on first page
  const startParam = new URL(location.href).searchParams.get('start') || '0'
  if (startParam === '0') {
    run(searchInput.value, config[siteName])
  }
}

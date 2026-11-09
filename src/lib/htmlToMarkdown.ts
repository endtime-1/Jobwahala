/**
 * Turns pasted rich text (from Word, Google Docs, a web page) into the Markdown a post is written in.
 * It keeps headings (H1/H2 become ##, H3 and below ###), bold, italics, bullet and numbered lists, links and paragraphs.
 */
const walk = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()
  const children = () => Array.from(element.childNodes).map(walk).join('')

  switch (tag) {
    case 'script':
    case 'style':
    case 'head':
      return ''
    case 'h1':
    case 'h2':
      return `\n\n## ${children().trim()}\n\n`
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n\n### ${children().trim()}\n\n`
    case 'strong':
    case 'b': {
      const inner = children().trim()
      return inner ? `**${inner}**` : ''
    }
    case 'em':
    case 'i': {
      const inner = children().trim()
      return inner ? `*${inner}*` : ''
    }
    case 'a': {
      const href = element.getAttribute('href') ?? ''
      const inner = children().trim()
      return href && inner ? `[${inner}](${href})` : inner
    }
    case 'br':
      return '\n'
    case 'ul':
    case 'ol': {
      const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li')
      const lines = items.map((item, index) => `${tag === 'ol' ? `${index + 1}.` : '-'} ${walk(item).trim()}`)
      return `\n\n${lines.join('\n')}\n\n`
    }
    case 'li':
      return children()
    case 'p':
    case 'div':
    case 'blockquote':
      return `\n\n${children().trim()}\n\n`
    default:
      return children()
  }
}

export const htmlToMarkdown = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return walk(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Pasted HTML that carries structure worth keeping (not just a line of plain text in a wrapper). */
export const hasRichStructure = (html: string) => /<(h[1-6]|ul|ol|strong|b|em|i|a|blockquote)[\s>]/i.test(html)

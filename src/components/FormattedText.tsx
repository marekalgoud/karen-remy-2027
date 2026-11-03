import { Fragment, type ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g

  return text.split(tokenPattern).filter(Boolean).map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index}>{token.slice(1, -1)}</code>
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('__') && token.endsWith('__')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      return <em key={index}>{token.slice(1, -1)}</em>
    }
    return <Fragment key={index}>{token}</Fragment>
  })
}

export default function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let orderedItems: string[] = []
  let unorderedItems: string[] = []

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push(<p key={`paragraph-${blocks.length}`}>{paragraph.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{renderInline(line)}</Fragment>)}</p>)
    paragraph = []
  }

  function flushList() {
    if (!orderedItems.length) return
    blocks.push(<ol key={`list-${blocks.length}`}>{orderedItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ol>)
    orderedItems = []
  }

  function flushUnorderedList() {
    if (!unorderedItems.length) return
    blocks.push(<ul key={`list-${blocks.length}`}>{unorderedItems.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>)
    unorderedItems = []
  }

  for (const line of text.split('\n')) {
    const listItem = line.match(/^\s*\d+\.\s+(.+)$/)
    const bulletItem = line.match(/^\s*[-*+]\s+(.+)$/)
    if (listItem || bulletItem) {
      flushParagraph()
      if (listItem) {
        flushUnorderedList()
        orderedItems.push(listItem[1])
      } else {
        flushList()
        unorderedItems.push(bulletItem![1])
      }
    } else {
      flushList()
      flushUnorderedList()
      if (line.trim()) paragraph.push(line)
      else flushParagraph()
    }
  }

  flushList()
  flushUnorderedList()
  flushParagraph()

  return <div className="riddle-content">{blocks}</div>
}
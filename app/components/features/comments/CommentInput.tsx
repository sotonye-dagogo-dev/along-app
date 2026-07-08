"use client"

import Link from "next/link"
import { useState, useRef, useCallback, useEffect } from "react"
import { Send } from "lucide-react"

interface MentionUser {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar?: string | null
}

interface CommentInputProps {
  userName: string
  onSubmit: (text: string) => void
}

export default function CommentInput({ userName, onSubmit }: CommentInputProps) {
  const [text, setText] = useState("")
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([])
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const detectMention = useCallback((value: string, cursor: number) => {
    const before = value.slice(0, cursor)
    const atIdx = before.lastIndexOf("@")
    if (atIdx === -1 || (atIdx > 0 && value[atIdx - 1] !== " " && atIdx !== 0)) {
      setMentionQuery("")
      setMentionResults([])
      return
    }
    const query = before.slice(atIdx + 1)
    if (query.includes(" ")) {
      setMentionQuery("")
      setMentionResults([])
      return
    }
    setMentionQuery(query)
    setCursorPos(cursor)
  }, [])

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) {
      setMentionResults([])
      return
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setMentionResults(data.users ?? [])
      setMentionIndex(0)
    } catch {
      setMentionResults([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (mentionQuery.length >= 1) {
      debounceRef.current = setTimeout(() => searchUsers(mentionQuery), 200)
    } else {
      setMentionResults([])
    }
  }, [mentionQuery, searchUsers])

  const insertMention = (user: MentionUser) => {
    const before = text.slice(0, cursorPos)
    const atIdx = before.lastIndexOf("@")
    const after = text.slice(cursorPos)
    const newText = before.slice(0, atIdx) + `@${user.userName} ` + after
    setText(newText)
    setMentionQuery("")
    setMentionResults([])
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = atIdx + user.userName.length + 2
        textareaRef.current.setSelectionRange(pos, pos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    const cursor = e.target.selectionStart
    detectMention(value, cursor)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % mentionResults.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((prev) => (prev <= 0 ? mentionResults.length - 1 : prev - 1))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (mentionIndex >= 0 && mentionIndex < mentionResults.length) {
          e.preventDefault()
          insertMention(mentionResults[mentionIndex])
          return
        }
      }
      if (e.key === "Escape") {
        setMentionResults([])
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const highlightedHtml = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(
      /(@\w+)/g,
      '<span class="mention-highlight" style="color:var(--color-primary);background:var(--color-primary-muted);border-radius:3px;padding:0 2px">$1</span>'
    )

  return (
    <div className="flex items-start gap-2.5 mb-4 relative">
      <Link href={`/profile/${userName}`} className="no-underline">
        <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {initials}
        </div>
      </Link>
      <div className="flex-1 flex flex-col gap-1.5 relative">
        <div className="relative">
          <div
            aria-hidden
            className="w-full min-h-[60px] px-3 py-2.5 border border-border radius-sm text-sm font-sans pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
            dangerouslySetInnerHTML={{ __html: highlightedHtml + (text.endsWith('\n') ? '<br/>' : '') }}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onClick={(e) => detectMention(text, e.currentTarget.selectionStart)}
            placeholder="Add a comment... (use @ to mention)"
            className="w-full min-h-[60px] px-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none resize-none bg-transparent text-transparent caret-current transition-colors duration-fast focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted absolute inset-0"
          />
        </div>
        {mentionResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-card border border-border radius-md shadow-lg max-h-[160px] overflow-y-auto">
            {mentionResults.map((u, i) => (
              <button
                key={u.id}
                onClick={() => insertMention(u)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-none bg-transparent cursor-pointer font-sans ${
                  i === mentionIndex ? "bg-bg-elevated" : "hover:bg-bg-elevated"
                }`}
              >
                <div className="w-6 h-6 rounded-circle bg-primary-muted flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                  {u.firstName[0]}{u.lastName[0]}
                </div>
                <span className="font-medium text-text-primary">@{u.userName}</span>
                <span className="text-text-muted">{u.firstName} {u.lastName}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-9 h-9 rounded-circle bg-primary text-white flex items-center justify-center shrink-0 border-none cursor-pointer transition-colors duration-fast hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send comment"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

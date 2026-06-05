import { useEffect } from 'react'
import { useCollaborationStore } from '../store/collaborationStore'
import { collaborationClient } from '../services/CollaborationClient'

export function useCollaboration() {
  const connected = useCollaborationStore((s) => s.connected)
  const presence = useCollaborationStore((s) => s.presence)
  const chatMessages = useCollaborationStore((s) => s.chatMessages)
  const comments = useCollaborationStore((s) => s.comments)
  const resolveComment = useCollaborationStore((s) => s.resolveComment)

  const myUserId = collaborationClient.myUserId
  const myUserName = collaborationClient.myUserName
  const myUserColor = collaborationClient.myUserColor

  useEffect(() => {
    collaborationClient.connect('demo-project')
    return () => {
      collaborationClient.disconnect()
    }
  }, [])

  function sendChat(text: string): Promise<void> {
    return collaborationClient.sendChat(text)
  }

  function addComment(
    bar: number,
    trackId: string | undefined,
    text: string
  ): Promise<void> {
    return collaborationClient.addComment(bar, trackId, text)
  }

  function submitOp(
    type: Parameters<typeof collaborationClient.submitOp>[0],
    payload: Record<string, unknown>
  ): Promise<void> {
    return collaborationClient.submitOp(type, payload)
  }

  function updateCursor(bar: number, track: string): Promise<void> {
    return collaborationClient.updateCursor(bar, track)
  }

  function setUserName(name: string): void {
    collaborationClient.setUserName(name)
  }

  return {
    connected,
    presence,
    chatMessages,
    comments,
    myUserId,
    myUserName,
    myUserColor,
    sendChat,
    addComment,
    resolveComment,
    submitOp,
    updateCursor,
    setUserName,
  }
}

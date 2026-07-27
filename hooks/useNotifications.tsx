'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { AppNotification } from '@/types'

const supabase = createBrowserClient()

interface NotificationsContextType {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
})

export function NotificationsProvider({ children, teamMemberId }: { children: ReactNode; teamMemberId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const typed = data as unknown as AppNotification[]
      setNotifications(typed)
      setUnreadCount(typed.filter(n => !n.is_read).length)
    }
  }, [teamMemberId])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('team_member_id', teamMemberId).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  useEffect(() => {
    fetchNotifications()

    const channelName = `notifications:${teamMemberId}`
    supabase.getChannels().forEach(ch => { if (ch.topic === `realtime:${channelName}`) supabase.removeChannel(ch) })

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `team_member_id=eq.${teamMemberId}` }, () => fetchNotifications())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMemberId])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}

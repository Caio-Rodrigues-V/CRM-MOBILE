import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Contact {
  name: string;
  phone: string;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  status: 'open' | 'pending' | 'closed';
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  contacts: Contact;
}

export default function InboxScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'pending' | 'closed'>('open');
  const [agentFilter, setAgentFilter] = useState<'me' | 'queue' | 'all'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          status,
          last_message_text,
          last_message_at,
          unread_count,
          contacts (
            name,
            phone,
            avatar_url
          )
        `)
        .eq('status', statusFilter);

      // Apply agent queue/me filter
      if (agentFilter === 'me' && currentUserId) {
        query = query.eq('assigned_agent_id', currentUserId);
      } else if (agentFilter === 'queue') {
        query = query.is('assigned_agent_id', null);
      }

      const { data, error } = await query.order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        // @ts-ignore
        setConversations(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getUserId();
  }, []);

  useEffect(() => {
    fetchConversations();

    // Subscribe to changes in conversations
    console.log('Subscribing to realtime conversation updates for inbox');
    const channel = supabase
      .channel('inbox-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'wacrm', table: 'conversations' },
        (payload) => {
          console.log('Received realtime conversation payload:', payload);
          fetchConversations();
        }
      )
      .subscribe((status, err) => {
        console.log('Realtime channel status for inbox-updates:', status);
        if (err) {
          console.error('Realtime error for inbox-updates:', err);
        }
      });

    return () => {
      console.log('Unsubscribing from realtime conversation updates for inbox');
      supabase.removeChannel(channel);
    };
  }, [statusFilter, agentFilter, currentUserId]);

  const getInitials = (name?: string) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  const getStatusColor = (status: 'open' | 'pending' | 'closed') => {
    if (status === 'open') return colors.success;
    if (status === 'pending') return colors.warning;
    return colors.danger;
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const contactName = item.contacts?.name || item.contacts?.phone || 'Cliente';
    const isUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/chat/${item.id}`)}
        style={[
          styles.itemContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          }
        ]}
      >
        {/* Avatar */}
        <ThemedView
          style={[
            styles.avatarContainer,
            { backgroundColor: colors.backgroundElement }
          ]}
        >
          {item.contacts?.avatar_url ? (
            <Image source={{ uri: item.contacts.avatar_url }} style={styles.avatar} />
          ) : (
            <ThemedView style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.avatarPlaceholderText}>
                {getInitials(contactName)}
              </ThemedText>
            </ThemedView>
          )}
          
          <ThemedView
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(item.status) }
            ]}
          />
        </ThemedView>

        {/* Content */}
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.itemHeader}>
            <ThemedText type="smallBold" style={[styles.name, isUnread && styles.unreadName]} numberOfLines={1}>
              {contactName}
            </ThemedText>
            <ThemedText style={[styles.timeText, { color: isUnread ? colors.primary : colors.textSecondary }]}>
              {formatTime(item.last_message_at)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.itemFooter}>
            <ThemedText
              style={[
                styles.lastMessage,
                { color: colors.textSecondary },
                isUnread && [styles.unreadLastMsg, { color: colors.text }]
              ]}
              numberOfLines={1}
            >
              {item.last_message_text || 'Nenhuma mensagem'}
            </ThemedText>

            {isUnread && (
              <ThemedView style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.unreadText}>
                  {item.unread_count}
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedView style={styles.headerLeft}>
            <ThemedView style={[styles.logoDot, { backgroundColor: colors.primary }]} />
            <ThemedText type="title" style={styles.headerTitle}>waCRM</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Filters Tab (Telegram style) */}
        <ThemedView style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
          {(['open', 'pending', 'closed'] as const).map((status) => {
            const isActive = statusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  setLoading(true);
                  setStatusFilter(status);
                }}
                style={[
                  styles.filterTab,
                  isActive && [
                    styles.filterTabActive,
                    { borderBottomColor: colors.primary },
                  ],
                ]}
              >
                <ThemedText
                  type={isActive ? 'smallBold' : 'default'}
                  style={[
                    styles.filterText,
                    isActive ? { color: colors.primary } : { color: colors.textSecondary },
                    { textTransform: 'capitalize' }
                  ]}
                >
                  {status === 'open' ? 'Abertos' : status === 'pending' ? 'Pendentes' : 'Fechados'}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ThemedView>

        {/* Agent Filter Selector */}
        <ThemedView style={styles.agentFilterContainer}>
          {(['me', 'queue', 'all'] as const).map((filter) => {
            const isActive = agentFilter === filter;
            const label = filter === 'me' ? 'Minhas' : filter === 'queue' ? 'Fila Geral' : 'Todas';
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => {
                  setLoading(true);
                  setAgentFilter(filter);
                }}
                style={[
                  styles.agentFilterBtn,
                  isActive && [
                    styles.agentFilterBtnActive,
                    { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                  ]
                ]}
              >
                <ThemedText
                  style={[
                    styles.agentFilterText,
                    isActive ? { color: colors.primary, fontWeight: '600' } : { color: colors.textSecondary }
                  ]}
                >
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ThemedView>

        {/* List */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversationItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <ThemedView style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
                <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.two }}>
                  Nenhuma conversa encontrada
                </ThemedText>
              </ThemedView>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomWidth: 2,
  },
  filterText: {
    fontSize: 14,
  },
  agentFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  agentFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  agentFilterBtnActive: {
    borderWidth: 1,
  },
  agentFilterText: {
    fontSize: 13,
  },
  listContent: {
    paddingVertical: Spacing.one,
  },
  itemContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  avatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.two,
  },
  unreadName: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
    marginRight: Spacing.two,
  },
  unreadLastMsg: {
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
});

import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { InAppNotification } from '@/components/in-app-notification';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  // In-app notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    senderName: string;
    messageText: string;
    conversationId: string;
  }>({
    visible: false,
    senderName: '',
    messageText: '',
    conversationId: '',
  });

  useEffect(() => {
    console.log('Subscribing to global realtime incoming messages for in-app alerts');
    
    const channel = supabase
      .channel('global-incoming-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'wacrm', table: 'messages' },
        async (payload) => {
          console.log('Global message payload received:', payload);
          const newMsg = payload.new;
          
          if (newMsg && newMsg.sender_type === 'customer') {
            try {
              // Fetch contact name
              const { data: convData } = await supabase
                .from('conversations')
                .select('contacts(name)')
                .eq('id', newMsg.conversation_id)
                .single();

              if (convData && convData.contacts) {
                // @ts-ignore
                const senderName = convData.contacts.name || 'Cliente';
                setNotification({
                  visible: true,
                  senderName,
                  messageText: newMsg.content_text || 'Mídia recebida',
                  conversationId: newMsg.conversation_id,
                });
              }
            } catch (err) {
              console.error('Error handling in-app alert payload:', err);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Global realtime channel status:', status);
        if (err) {
          console.error('Global realtime subscription error:', err);
        }
      });

    return () => {
      console.log('Unsubscribing from global realtime messages');
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {/* Global In-app notification banner */}
      <InAppNotification
        visible={notification.visible}
        senderName={notification.senderName}
        messageText={notification.messageText}
        onPress={() => router.push(`/chat/${notification.conversationId}`)}
        onClose={() => setNotification((prev) => ({ ...prev, visible: false }))}
      />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inbox',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pipelines"
          options={{
            title: 'Funil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="funnel" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contatos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ajustes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

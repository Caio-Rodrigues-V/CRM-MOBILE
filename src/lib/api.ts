import { supabase } from './supabase';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

export async function sendWhatsAppMessage({
  conversationId,
  contactId,
  messageType,
  contentText,
  mediaUrl,
  templateName,
}: {
  conversationId?: string;
  contactId?: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'audio' | 'template';
  contentText?: string;
  mediaUrl?: string;
  templateName?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Não autenticado.');
  }

  const response = await fetch(`${SERVER_URL}/api/whatsapp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      contact_id: contactId,
      message_type: messageType,
      content_text: contentText,
      media_url: mediaUrl,
      template_name: templateName,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao enviar mensagem.');
  }

  return data;
}

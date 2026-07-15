import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Image,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

interface Message {
  id: string;
  sender_type: 'customer' | 'agent' | 'bot';
  content_type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'template';
  content_text: string | null;
  media_url: string | null;
  created_at: string;
  status: string;
  template_name?: string | null;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  body_text: string;
}

interface ContactNote {
  id: string;
  note_text: string;
  created_at: string;
  user_id: string;
}

// Audio Message Player Component
function AudioBubble({ uri, colors, isMe }: { uri: string; colors: any; isMe: boolean }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlayPause = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Audio play error:', err);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const getProgress = () => {
    if (duration === 0) return 0;
    return (position / duration) * 100;
  };

  const formatAudioTime = (millis: number) => {
    if (!millis) return '0:00';
    const totalSecs = Math.floor(millis / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <ThemedView style={styles.audioPlayerContainer}>
      <TouchableOpacity onPress={handlePlayPause}>
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={34}
          color={isMe ? '#FFFFFF' : colors.primary}
          style={styles.audioPlayIcon}
        />
      </TouchableOpacity>
      <ThemedView style={styles.audioProgressBarBg}>
        <ThemedView style={[
          styles.audioProgressBarActive, 
          { 
            width: `${getProgress()}%`,
            backgroundColor: isMe ? '#FFFFFF' : colors.primary 
          }
        ]} />
      </ThemedView>
      <ThemedText style={[
        styles.audioLabel, 
        { color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary }
      ]}>
        {formatAudioTime(position || duration)}
      </ThemedText>
    </ThemedView>
  );
}

const base64ToUint8Array = (base64: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    const bytesVal = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
    bytes[p++] = (bytesVal >> 16) & 255;
    if (p < bufferLength) {
      bytes[p++] = (bytesVal >> 8) & 255;
      if (p < bufferLength) {
        bytes[p++] = bytesVal & 255;
      }
    }
  }
  return bytes;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [status, setStatus] = useState<'open' | 'pending' | 'closed'>('open');
  const [assignedAgentName, setAssignedAgentName] = useState<string>('Sem responsável');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  // Audio Recording States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchConversation = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('status, assigned_agent_id, contact_id, contacts(id, name, phone, email)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error);
    } else if (data) {
      if (data.contacts) {
        // @ts-ignore
        setContact(data.contacts);
        // @ts-ignore
        fetchContactTags(data.contacts.id);
        // @ts-ignore
        fetchContactNotes(data.contacts.id);
      }
      if (data.status) {
        setStatus(data.status);
      }
      if (data.assigned_agent_id) {
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.assigned_agent_id)
          .single();
        
        if (agentProfile) {
          setAssignedAgentName(agentProfile.full_name);
        } else {
          setAssignedAgentName('Desconhecido');
        }
      } else {
        setAssignedAgentName('Sem responsável');
      }
    }
  };

  const fetchContactTags = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          tags (
            id,
            name,
            color
          )
        `)
        .eq('contact_id', contactId);

      if (error) {
        console.error('Error fetching contact tags:', error);
      } else if (data) {
        // @ts-ignore
        setTags(data.map(item => item.tags).filter(Boolean));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p) => {
          map[p.user_id] = p.full_name;
        });
        setProfilesMap(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchContactNotes = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_notes')
        .select('id, note_text, created_at, user_id')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
      } else {
        // @ts-ignore
        setNotes(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !contact) return;
    setAddingNote(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('contact_notes')
        .insert({
          contact_id: contact.id,
          note_text: newNoteContent.trim(),
          user_id: user.id,
        });

      if (error) {
        Alert.alert('Erro', 'Não foi possível salvar a anotação.');
      } else {
        setNewNoteContent('');
        fetchContactNotes(contact.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingNote(false);
    }
  };

  const fetchAccountId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setAccountId(profile.account_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    if (!accountId) return;
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, name, category, body_text')
        .eq('account_id', accountId)
        .in('status', ['APPROVED', 'Approved']);

      if (error) {
        console.error('Error fetching templates:', error);
      } else {
        // @ts-ignore
        setTemplates(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!id) return;

    // Fetch messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchConversation();
    fetchAccountId();
    fetchMessages();
    fetchProfiles();

    // Subscribe to new messages for this conversation
    console.log('Subscribing to realtime messages for conversation:', id);
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'wacrm',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          console.log('Received realtime message payload:', payload);
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Check if message is already in list
            if (prev.some((msg) => msg.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime channel status for chat:${id}:`, status);
        if (err) {
          console.error(`Realtime error for chat:${id}:`, err);
        }
      });

    return () => {
      console.log('Unsubscribing from realtime messages for conversation:', id);
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (accountId) {
      fetchTemplates();
    }
  }, [accountId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending || !id) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await sendWhatsAppMessage({
        conversationId: id,
        messageType: 'text',
        contentText: textToSend,
      });
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao enviar mensagem.');
      setInputText(textToSend); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const handleSelectTemplate = async (template: MessageTemplate) => {
    setTemplateModalVisible(false);
    setSending(true);

    try {
      await sendWhatsAppMessage({
        conversationId: id,
        messageType: 'template',
        templateName: template.name,
        contentText: undefined,
      });
      Alert.alert('Sucesso', 'Template enviado com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao enviar template.');
    } finally {
      setSending(false);
    }
  };

  // Audio Recording Methods
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão Negada', 'Precisamos de acesso ao microfone para gravar áudio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording || !accountId) return;
    console.log('Stopping and sending recording..');
    setIsRecording(false);
    setRecording(null);
    setSending(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('Erro', 'Gravação vazia.');
        setSending(false);
        return;
      }

      // Convert local URI to binary array using FileSystem to avoid Network request failed errors
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64Data);
      
      const fileName = `${Math.random().toString(36).substring(2, 15)}.mp4`;
      const filePath = `account-${accountId}/${fileName}`;

      // Upload to storage using raw Uint8Array
      const { data, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, bytes, {
          contentType: 'audio/mp4',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload audio error:', uploadError);
        Alert.alert('Erro', 'Falha ao subir gravação.');
        setSending(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Send via WhatsApp API
      await sendWhatsAppMessage({
        conversationId: id,
        messageType: 'audio',
        mediaUrl: publicUrl,
        contentText: undefined,
      });

    } catch (err) {
      console.error('Recording upload error:', err);
      Alert.alert('Erro', 'Ocorreu um erro ao enviar a gravação.');
    } finally {
      setSending(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    console.log('Canceling recording..');
    setIsRecording(false);
    setRecording(null);
    try {
      await recording.stopAndUnloadAsync();
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    if (!accountId) {
      Alert.alert('Erro', 'Não foi possível carregar os dados da sua conta.');
      return;
    }

    try {
      // 1. Request permissions
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permissão Negada', 'Precisamos de acesso para enviar imagens.');
        return;
      }

      // 2. Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ 
            quality: 0.8, 
            mediaTypes: ImagePicker.MediaTypeOptions.Images 
          });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const selectedAsset = result.assets[0];
      setSending(true);

      // Convert local URI to binary array using FileSystem to avoid Network request failed errors
      const base64Data = await FileSystem.readAsStringAsync(selectedAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64Data);
      const fileExt = selectedAsset.uri.split('.').pop() || 'jpg';
      
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `account-${accountId}/${fileName}`;

      // Upload to Supabase Storage using raw Uint8Array
      const { data, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, bytes, {
          contentType: selectedAsset.mimeType || `image/${fileExt}`,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Erro', 'Falha ao fazer o upload da imagem.');
        setSending(false);
        return;
      }

      // Get Public Url
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Send via WhatsApp API
      await sendWhatsAppMessage({
        conversationId: id,
        messageType: 'image',
        mediaUrl: publicUrl,
        contentText: undefined,
      });

    } catch (err: any) {
      console.error('Pick and upload image error:', err);
      Alert.alert('Erro', 'Ocorreu um erro ao enviar a imagem.');
    } finally {
      setSending(false);
    }
  };

  const handlePickMediaMenu = () => {
    Alert.alert(
      'Enviar Imagem',
      'Escolha a origem da foto:',
      [
        { text: 'Câmera', onPress: () => handlePickImage(true) },
        { text: 'Galeria', onPress: () => handlePickImage(false) },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const updateStatus = async (newStatus: 'open' | 'pending' | 'closed') => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        Alert.alert('Erro', 'Não foi possível atualizar o status.');
      } else {
        setStatus(newStatus);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChangeMenu = () => {
    Alert.alert(
      'Alterar Status',
      'Escolha o novo status desta conversa:',
      [
        { text: 'Aberto', onPress: () => updateStatus('open') },
        { text: 'Pendente', onPress: () => updateStatus('pending') },
        { text: 'Fechado', onPress: () => updateStatus('closed') },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleTransferAgent = async () => {
    if (!accountId) {
      Alert.alert('Erro', 'Não foi possível identificar o seu perfil.');
      return;
    }

    try {
      // Fetch all other agents in same account
      const { data: agents, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('account_id', accountId)
        .order('full_name');

      if (error || !agents) {
        Alert.alert('Erro', 'Não foi possível carregar a lista de agentes.');
        return;
      }

      // Render buttons for agent select Alert
      const buttons = agents.map((agent) => ({
        text: agent.full_name,
        onPress: async () => {
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ assigned_agent_id: agent.user_id })
            .eq('id', id);

          if (updateError) {
            Alert.alert('Erro', 'Não foi possível transferir a conversa.');
          } else {
            setAssignedAgentName(agent.full_name);
            Alert.alert('Sucesso', `Conversa transferida para ${agent.full_name}`);
          }
        }
      }));

      // Option to unassign
      buttons.push({
        text: 'Remover responsável (Fila)',
        onPress: async () => {
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ assigned_agent_id: null })
            .eq('id', id);

          if (updateError) {
            Alert.alert('Erro', 'Não foi possível remover o responsável.');
          } else {
            setAssignedAgentName('Sem responsável');
            Alert.alert('Sucesso', 'Conversa movida para a fila geral');
          }
        }
      });

      buttons.push({
        text: 'Cancelar',
        onPress: () => {},
        style: 'cancel'
      } as any);

      Alert.alert(
        'Transferir Conversa',
        'Selecione o agente para quem deseja atribuir o atendimento:',
        buttons as any,
        { cancelable: true }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getStatusColor = (statusName: 'open' | 'pending' | 'closed') => {
    if (statusName === 'open') return colors.success;
    if (statusName === 'pending') return colors.warning;
    return colors.danger;
  };

  const getStatusLabel = (statusName: 'open' | 'pending' | 'closed') => {
    if (statusName === 'open') return 'Aberto';
    if (statusName === 'pending') return 'Pendente';
    return 'Fechado';
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_type === 'agent' || item.sender_type === 'bot';
    
    return (
      <ThemedView
        style={[
          styles.messageBubbleContainer,
          isMe ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <ThemedView
          style={[
            styles.messageBubble,
            isMe
              ? [styles.myBubble, { backgroundColor: colors.myBubble }]
              : [styles.theirBubble, { backgroundColor: colors.theirBubble }],
          ]}
        >
          {item.content_type === 'image' && item.media_url ? (
            <Image
              source={{ uri: item.media_url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : item.content_type === 'audio' && item.media_url ? (
            <AudioBubble
              uri={item.media_url}
              colors={colors}
              isMe={isMe}
            />
          ) : item.content_type === 'document' && item.media_url ? (
            <TouchableOpacity
              onPress={() => item.media_url && Linking.openURL(item.media_url)}
              style={styles.documentContainer}
            >
              <Ionicons name="document-text" size={32} color={isMe ? '#FFFFFF' : colors.primary} />
              <ThemedView style={{ backgroundColor: 'transparent', flex: 1, gap: 1 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: isMe ? '#FFFFFF' : colors.text }} numberOfLines={1}>
                  {item.media_url.split('/').pop() || 'Documento PDF'}
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary }}>
                  Toque para abrir anexo
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ) : item.content_type === 'video' && item.media_url ? (
            <TouchableOpacity
              onPress={() => item.media_url && Linking.openURL(item.media_url)}
              style={styles.videoContainer}
            >
              <ThemedView style={[styles.videoPlaceholder, { backgroundColor: isMe ? 'rgba(0, 0, 0, 0.2)' : colors.backgroundElement }]}>
                <Ionicons name="play-circle" size={40} color={isMe ? '#FFFFFF' : colors.primary} />
                <ThemedText style={{ fontSize: 12, color: isMe ? '#FFFFFF' : colors.text, marginTop: 4 }}>
                  Vídeo Recebido
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ) : item.content_type === 'location' ? (
            <TouchableOpacity
              onPress={() => {
                const query = item.content_text || '';
                const url = Platform.select({
                  ios: `maps:0,0?q=${query}`,
                  android: `geo:0,0?q=${query}`,
                });
                if (url) Linking.openURL(url);
              }}
              style={styles.locationContainer}
            >
              <Ionicons name="map" size={24} color={isMe ? '#FFFFFF' : colors.primary} />
              <ThemedView style={{ backgroundColor: 'transparent', flex: 1, gap: 1 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: isMe ? '#FFFFFF' : colors.text }} numberOfLines={1}>
                  Localização Enviada
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary }} numberOfLines={1}>
                  {item.content_text || 'Ver no GPS'}
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ) : item.content_type === 'template' ? (
            <ThemedView style={styles.templateMessageContainer}>
              <ThemedView style={styles.templateHeader}>
                <Ionicons name="flash" size={16} color={isMe ? '#FFFFFF' : colors.primary} />
                <ThemedText style={[styles.templateTitle, { color: isMe ? '#FFFFFF' : colors.primary }]}>
                  Template: {item.template_name}
                </ThemedText>
              </ThemedView>
              <ThemedText style={[styles.messageText, { color: colors.text }]}>
                {item.content_text || 'Modelo de mensagem enviado.'}
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedText
              style={[
                styles.messageText,
                { color: colors.text },
              ]}
            >
              {item.content_text}
            </ThemedText>
          )}
          
          <ThemedView style={styles.messageMeta}>
            <ThemedText
              style={[
                styles.timeText,
                { color: colors.textSecondary },
              ]}
            >
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </ThemedText>

            {isMe && (
              <Ionicons
                name="checkmark-done"
                size={15}
                color={item.status === 'read' ? '#34B7F1' : colors.textSecondary}
                style={styles.checkIcon}
              />
            )}
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.chatBg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <ThemedView
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Contact Details Trigger */}
          <TouchableOpacity
            onPress={() => setDetailsModalVisible(true)}
            style={styles.headerTrigger}
          >
            <ThemedView style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.avatarText}>
                {getInitials(contact?.name)}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.headerInfo}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {contact?.name || 'Cliente'}
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                Resp: {assignedAgentName}
              </ThemedText>
            </ThemedView>
          </TouchableOpacity>

          {/* Transfer Button */}
          <TouchableOpacity onPress={handleTransferAgent} style={styles.headerActionBtn}>
            <Ionicons name="person-add-outline" size={20} color={colors.text} />
          </TouchableOpacity>

          {/* Status Badge Toggle */}
          <TouchableOpacity
            onPress={handleStatusChangeMenu}
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(status) }
            ]}
          >
            <ThemedText style={styles.statusBadgeText}>
              {getStatusLabel(status)}
            </ThemedText>
            <Ionicons name="chevron-down" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </ThemedView>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input Bar (Floating/Detached style) */}
            <ThemedView style={styles.inputContainer}>
              {isRecording ? (
                // Active Recording Status Bar
                <ThemedView style={[styles.inputBar, { backgroundColor: '#FADBD8', borderColor: '#EC7063', paddingVertical: 10, paddingHorizontal: Spacing.four, alignItems: 'center' }]}>
                  <Ionicons name="mic" size={20} color="#C0392B" style={styles.blinkingIcon} />
                  <ThemedText style={{ color: '#C0392B', fontWeight: 'bold', fontSize: 14, flex: 1, marginLeft: 8 }}>
                    Gravando mensagem de voz...
                  </ThemedText>
                  
                  <TouchableOpacity onPress={cancelRecording} style={styles.recordingActionBtn}>
                    <Ionicons name="trash-outline" size={20} color="#C0392B" />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={stopAndSendRecording} style={[styles.recordingActionBtn, { marginLeft: 12 }]}>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#27AE60" />
                  </TouchableOpacity>
                </ThemedView>
              ) : (
                // Normal text input bar
                <>
                  <ThemedView
                    style={[
                      styles.inputBar,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity onPress={() => setTemplateModalVisible(true)} style={styles.attachBtn}>
                      <Ionicons name="flash-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                        },
                      ]}
                      placeholder="Mensagem..."
                      placeholderTextColor={colors.textSecondary}
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                    />

                    <TouchableOpacity onPress={handlePickMediaMenu} style={styles.attachBtn}>
                      <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Send or Voice Record Action Button */}
                  {inputText.trim() ? (
                    <TouchableOpacity
                      onPress={handleSend}
                      disabled={sending}
                      style={[
                        styles.sendButton,
                        {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={startRecording}
                      disabled={sending}
                      style={[
                        styles.sendButton,
                        {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      <Ionicons name="mic" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ThemedView>
          </KeyboardAvoidingView>
        )}

        {/* Contact Details & Notes Modal */}
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <ThemedView style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContent, { backgroundColor: colors.background, height: '85%' }]}>
              {/* Modal Header */}
              <ThemedView style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>Ficha do Contato</ThemedText>
                <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </ThemedView>

              {/* Scrollable container using single FlatList */}
              <FlatList
                data={notes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalBody}
                ListHeaderComponent={
                  <ThemedView style={styles.modalHeaderInfoContainer}>
                    <ThemedView style={styles.modalAvatarContainer}>
                      <ThemedView style={[styles.modalAvatar, { backgroundColor: colors.primary }]}>
                        <ThemedText style={styles.modalAvatarText}>
                          {getInitials(contact?.name)}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText type="title" style={{ marginTop: 8 }}>
                        {contact?.name}
                      </ThemedText>
                    </ThemedView>

                    {/* Details Section */}
                    <ThemedView style={[styles.detailSection, { borderTopColor: colors.border }]}>
                      <ThemedView style={styles.detailRow}>
                        <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
                        <ThemedView style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>Telefone</ThemedText>
                          <ThemedText style={{ fontSize: 14, fontWeight: '500' }}>{contact?.phone}</ThemedText>
                        </ThemedView>
                      </ThemedView>

                      <ThemedView style={styles.detailRow}>
                        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                        <ThemedView style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>E-mail</ThemedText>
                          <ThemedText style={{ fontSize: 14, fontWeight: '500' }}>{contact?.email || 'Não informado'}</ThemedText>
                        </ThemedView>
                      </ThemedView>
                    </ThemedView>

                    {/* Tags Section */}
                    <ThemedView style={[styles.detailSection, { borderTopColor: colors.border, marginBottom: 12 }]}>
                      <ThemedText type="smallBold" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                        Tags do CRM
                      </ThemedText>
                      {tags.length === 0 ? (
                        <ThemedText style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' }}>
                          Sem tags vinculadas
                        </ThemedText>
                      ) : (
                        <ThemedView style={styles.tagsContainer}>
                          {tags.map((tag) => (
                            <ThemedView
                              key={tag.id}
                              style={[
                                styles.tagBadge,
                                { backgroundColor: tag.color || colors.primary }
                              ]}
                            >
                              <ThemedText style={styles.tagText}>{tag.name}</ThemedText>
                            </ThemedView>
                          ))}
                        </ThemedView>
                      )}
                    </ThemedView>

                    {/* Notes Section Header */}
                    <ThemedText type="smallBold" style={[styles.sectionTitle, { color: colors.textSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }]}>
                      Anotações Internas
                    </ThemedText>

                    {/* Add Note Area */}
                    <ThemedView style={styles.addNoteContainer}>
                      <TextInput
                        style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}
                        placeholder="Adicionar anotação interna..."
                        placeholderTextColor={colors.textSecondary}
                        value={newNoteContent}
                        onChangeText={setNewNoteContent}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={handleAddNote}
                        disabled={addingNote || !newNoteContent.trim()}
                        style={[styles.addNoteBtn, { backgroundColor: colors.primary }]}
                      >
                        {addingNote ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="add" size={20} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                }
                renderItem={({ item }) => (
                  <ThemedView style={[styles.noteCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <ThemedText style={styles.noteContent}>{item.note_text}</ThemedText>
                    <ThemedView style={styles.noteFooter}>
                      <ThemedText style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                        Por: {profilesMap[item.user_id] || 'Agente'}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>
                        {new Date(item.created_at).toLocaleDateString('pt-BR')} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                )}
                ListEmptyComponent={
                  <ThemedView style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ThemedText style={{ color: colors.textSecondary, fontStyle: 'italic', fontSize: 13 }}>
                      Nenhuma anotação registrada.
                    </ThemedText>
                  </ThemedView>
                }
              />
            </ThemedView>
          </ThemedView>
        </Modal>

        {/* Templates Selection Modal */}
        <Modal
          visible={templateModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setTemplateModalVisible(false)}
        >
          <ThemedView style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContent, { backgroundColor: colors.background, height: '70%' }]}>
              {/* Modal Header */}
              <ThemedView style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>Modelos de Mensagem (Templates)</ThemedText>
                <TouchableOpacity onPress={() => setTemplateModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </ThemedView>

              {/* Templates List */}
              {templates.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <Ionicons name="flash-off-outline" size={48} color={colors.textSecondary} />
                  <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.two }}>
                    Nenhum template aprovado cadastrado.
                  </ThemedText>
                </ThemedView>
              ) : (
                <FlatList
                  data={templates}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.modalListContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectTemplate(item)}
                      style={[styles.templateCard, { borderColor: colors.border }]}
                    >
                      <ThemedView style={styles.templateCardHeader}>
                        <ThemedText type="smallBold" style={{ textTransform: 'capitalize' }}>
                          {item.name.replace(/_/g, ' ')}
                        </ThemedText>
                        <ThemedView style={[styles.categoryBadge, { backgroundColor: colors.backgroundElement }]}>
                          <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>{item.category}</ThemedText>
                        </ThemedView>
                      </ThemedView>
                      <ThemedText style={[styles.templateBodyText, { color: colors.textSecondary }]} numberOfLines={3}>
                        {item.body_text}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                />
              )}
            </ThemedView>
          </ThemedView>
        </Modal>
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 2,
  },
  backButton: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
  headerTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.two,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginRight: 4,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.two,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 2,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 1,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  myBubble: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 8,
    marginBottom: 4,
  },
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    gap: 8,
  },
  audioPlayIcon: {
    marginRight: 2,
  },
  audioProgressBarBg: {
    flex: 1,
    height: 3.5,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 2,
    position: 'relative',
  },
  audioProgressBarActive: {
    height: '100%',
    borderRadius: 2,
  },
  audioLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 210,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    gap: 8,
  },
  videoContainer: {
    width: 210,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  videoPlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 210,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    gap: 8,
  },
  templateMessageContainer: {
    paddingVertical: 2,
    backgroundColor: 'transparent',
    gap: 4,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  templateTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  messageMeta: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  timeText: {
    fontSize: 10,
  },
  checkIcon: {
    marginLeft: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.one,
    gap: Spacing.one,
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  attachBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 24,
    maxHeight: 100,
    paddingHorizontal: Spacing.two,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
  },
  recordingActionBtn: {
    padding: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: 1,
  },
  modalBody: {
    padding: Spacing.four,
  },
  modalHeaderInfoContainer: {
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: 'transparent',
    width: '100%',
  },
  modalAvatarContainer: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  modalAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailSection: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalListContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  templateBodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
  },
  addNoteContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
  },
  addNoteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 6,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    backgroundColor: 'transparent',
  },
  blinkingIcon: {
    opacity: 0.85,
  },
});

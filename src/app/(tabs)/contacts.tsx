import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function ContactsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  // New contact fields state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .order('name');

      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        setContacts(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleContactPress = async (contact: Contact) => {
    setOpeningChat(contact.id);
    try {
      const { data: existingConvs, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .limit(1);

      if (checkError) {
        console.error('Check conversation error:', checkError);
        Alert.alert('Erro', 'Não foi possível buscar a conversa.');
        return;
      }

      if (existingConvs && existingConvs.length > 0) {
        router.push(`/chat/${existingConvs[0].id}`);
      } else {
        console.log('Creating new conversation for contact:', contact.id);
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('account_id')
          .single();

        if (profileError || !profileData) {
          Alert.alert('Erro', 'Não foi possível identificar sua conta.');
          return;
        }

        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            account_id: profileData.account_id,
            status: 'open',
            unread_count: 0,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Create conversation error:', createError);
          Alert.alert('Erro', 'Não foi possível iniciar a conversa.');
        } else if (newConv) {
          router.push(`/chat/${newConv.id}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningChat(null);
    }
  };

  const handleCreateContact = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Aviso', 'Nome e Telefone são campos obrigatórios.');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .single();

      if (!userProfile) {
        Alert.alert('Erro', 'Não foi possível identificar o seu perfil.');
        setCreating(false);
        return;
      }

      const { error } = await supabase
        .from('contacts')
        .insert({
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || null,
          account_id: userProfile.account_id,
        });

      if (error) {
        console.error('Create contact error:', error);
        Alert.alert('Erro', 'Não foi possível salvar o contato.');
      } else {
        Alert.alert('Sucesso', 'Contato cadastrado com sucesso!');
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setCreateModalVisible(false);
        fetchContacts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const renderContactItem = ({ item }: { item: Contact }) => {
    const isProcessing = openingChat === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleContactPress(item)}
        disabled={openingChat !== null}
        style={[
          styles.itemContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          }
        ]}
      >
        <ThemedView
          style={[
            styles.avatarPlaceholder,
            { backgroundColor: colors.primary }
          ]}
        >
          <ThemedText style={styles.avatarText}>
            {getInitials(item.name)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.infoContainer}>
          <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText style={[styles.details, { color: colors.textSecondary }]}>
            {item.phone} {item.email ? `• ${item.email}` : ''}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.actionContainer}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
          )}
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title">Contatos</ThemedText>
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </ThemedView>

        {/* Search Bar */}
        <ThemedView
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: colors.backgroundElement,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar contatos..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* List */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={renderContactItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <ThemedView style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.two }}>
                  Nenhum contato encontrado
                </ThemedText>
              </ThemedView>
            }
          />
        )}

        {/* Create Contact Modal */}
        <Modal
          visible={createModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <ThemedView style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[styles.modalContent, { backgroundColor: colors.background }]}
            >
              {/* Modal Header */}
              <ThemedView style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>Novo Contato</ThemedText>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </ThemedView>

              {/* Form Body */}
              <ThemedView style={styles.modalBody}>
                <ThemedView style={styles.inputWrapper}>
                  <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Nome Completo *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}
                    placeholder="Nome do cliente"
                    placeholderTextColor={colors.textSecondary}
                    value={newName}
                    onChangeText={setNewName}
                  />
                </ThemedView>

                <ThemedView style={styles.inputWrapper}>
                  <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>WhatsApp (com DDD) *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}
                    placeholder="Ex: 5521999999999"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    value={newPhone}
                    onChangeText={setNewPhone}
                  />
                </ThemedView>

                <ThemedView style={styles.inputWrapper}>
                  <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>E-mail</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}
                    placeholder="cliente@email.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    value={newEmail}
                    onChangeText={setNewEmail}
                  />
                </ThemedView>

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleCreateContact}
                  disabled={creating}
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.saveBtnText}>Salvar Contato</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
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
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  details: {
    fontSize: 12,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
    gap: Spacing.three,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

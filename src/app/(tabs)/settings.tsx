import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface UserProfile {
  email: string;
  fullName: string;
  role: string;
  accountName: string;
}

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`
          full_name,
          account_role,
          accounts (
            name
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile({
          email: user.email || '',
          fullName: profileData?.full_name || 'Agente',
          role: profileData?.account_role || 'agent',
          // @ts-ignore
          accountName: profileData?.accounts?.name || 'CRM',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.backgroundElement }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <ThemedView style={[styles.header, { backgroundColor: colors.background }]}>
          <ThemedText type="title">Ajustes</ThemedText>
        </ThemedView>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : (
          <ThemedView style={{ flex: 1, gap: Spacing.four }}>
            {/* User Profile Card */}
            <ThemedView style={[styles.profileCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ThemedView style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.avatarText}>
                  {profile ? getInitials(profile.fullName) : 'A'}
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.profileInfo}>
                <ThemedText type="subtitle" style={styles.fullName}>
                  {profile?.fullName}
                </ThemedText>
                <ThemedText style={[styles.email, { color: colors.textSecondary }]}>
                  {profile?.email}
                </ThemedText>
                
                <ThemedView style={[styles.roleTag, { backgroundColor: colors.primary + '15' }]}>
                  <ThemedText style={[styles.roleText, { color: colors.primary }]}>
                    {profile?.role === 'admin' ? 'Administrador' : 'Agente'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* Account Info */}
            <ThemedView style={[styles.menuSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ThemedView style={styles.menuItem}>
                <Ionicons name="business-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <ThemedView style={styles.menuItemContent}>
                  <ThemedText style={{ fontSize: 13, color: colors.textSecondary }}>Organização</ThemedText>
                  <ThemedText style={{ fontSize: 15, fontWeight: '500' }}>{profile?.accountName}</ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            {/* Actions Section */}
            <ThemedView style={[styles.menuSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 12 }} />
                <ThemedView style={styles.menuItemContent}>
                  <ThemedText style={{ fontSize: 15, fontWeight: '500', color: colors.danger }}>Sair da Conta</ThemedText>
                </ThemedView>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 2,
    marginBottom: Spacing.three,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    marginHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  fullName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 13,
  },
  roleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  menuSection: {
    marginHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: 'transparent',
  },
  menuItemContent: {
    flex: 1,
    backgroundColor: 'transparent',
    gap: 2,
  },
});

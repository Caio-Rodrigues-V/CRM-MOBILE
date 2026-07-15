import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? 'Credenciais de login inválidas.' : authError.message);
      } else {
        router.replace('/(tabs)/index');
      }
    } catch (err: any) {
      setError('Ocorreu um erro ao tentar realizar o login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <SafeAreaView style={styles.safeArea}>
            {/* Header / Logo */}
            <ThemedView style={styles.header}>
              <ThemedView style={[styles.logoIconContainer, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="chatbubbles" size={42} color={colors.primary} />
              </ThemedView>
              <ThemedText type="title" style={styles.title}>
                waCRM
              </ThemedText>
              <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                Acesse o painel para gerenciar atendimentos e responder clientes do WhatsApp®.
              </ThemedText>
            </ThemedView>

            {/* Form */}
            <ThemedView style={styles.form}>
              {error && (
                <ThemedView style={[styles.errorBox, { borderColor: colors.danger + '40' }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                  <ThemedText style={[styles.errorText, { color: colors.danger }]}>{error}</ThemedText>
                </ThemedView>
              )}

              {/* Email Input */}
              <ThemedView style={styles.inputWrapper}>
                <ThemedText type="smallBold" style={[styles.label, { color: emailFocused ? colors.primary : colors.textSecondary }]}>
                  E-mail
                </ThemedText>
                <ThemedView
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: emailFocused ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                      },
                    ]}
                    placeholder="exemplo@grupoddm.com.br"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </ThemedView>
              </ThemedView>

              {/* Password Input */}
              <ThemedView style={styles.inputWrapper}>
                <ThemedText type="smallBold" style={[styles.label, { color: passwordFocused ? colors.primary : colors.textSecondary }]}>
                  Senha
                </ThemedText>
                <ThemedView
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: passwordFocused ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                      },
                    ]}
                    placeholder="Sua senha"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </ThemedView>
              </ThemedView>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={styles.buttonText}
                  >
                    Entrar
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ThemedView>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    justifyContent: 'center',
    paddingVertical: Spacing.five,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.five,
    gap: Spacing.two,
  },
  logoIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  description: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  form: {
    gap: Spacing.four,
  },
  inputWrapper: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
});

import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, useColorScheme, Animated, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface InAppNotificationProps {
  visible: boolean;
  senderName: string;
  messageText: string;
  onPress: () => void;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export function InAppNotification({
  visible,
  senderName,
  messageText,
  onPress,
  onClose,
}: InAppNotificationProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const slideAnim = React.useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (visible) {
      // Slide Down
      Animated.spring(slideAnim, {
        toValue: 12,
        useNativeDriver: true,
        bounciness: 8,
      }).start();

      // Auto Hide after 4.5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 4500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    // Slide Up
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          onPress();
          handleClose();
        }}
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            shadowColor: '#000',
          },
        ]}
      >
        <ThemedView style={[styles.iconWrapper, { backgroundColor: colors.primary }]}>
          <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
        </ThemedView>

        <ThemedView style={styles.textContainer}>
          <ThemedText style={styles.sender} numberOfLines={1}>
            {senderName}
          </ThemedText>
          <ThemedText style={[styles.message, { color: colors.textSecondary }]} numberOfLines={1}>
            {messageText}
          </ThemedText>
        </ThemedView>

        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    position: 'absolute',
    top: 36,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width - 24,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  textContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    gap: 2,
  },
  sender: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
    marginLeft: Spacing.two,
  },
});

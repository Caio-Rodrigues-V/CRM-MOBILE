import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  order_index: number;
}

interface Deal {
  id: string;
  title: string;
  value: number | null;
  status: 'won' | 'lost' | 'open';
  created_at: string;
  stage_id: string;
  contacts: {
    name: string;
    phone: string;
  } | null;
}

export default function PipelinesScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching pipelines:', error);
      } else if (data && data.length > 0) {
        setPipelines(data);
        setSelectedPipeline(data[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchStagesAndDeals = async (pipelineId: string) => {
    setLoadingDeals(true);
    try {
      const { data: stagesData, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('id, name, order_index')
        .eq('pipeline_id', pipelineId)
        .order('order_index');

      if (stagesError) {
        console.error('Error fetching stages:', stagesError);
        return;
      }

      setStages(stagesData || []);
      
      if (stagesData && stagesData.length > 0) {
        const firstStageId = stagesData[0].id;
        setSelectedStageId(firstStageId);
        await fetchDealsForStage(firstStageId);
      } else {
        setDeals([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingDeals(false);
    }
  };

  const fetchDealsForStage = async (stageId: string) => {
    setLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          title,
          value,
          status,
          created_at,
          stage_id,
          contacts (
            name,
            phone
          )
        `)
        .eq('stage_id', stageId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deals:', error);
      } else {
        // @ts-ignore
        setDeals(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      fetchStagesAndDeals(selectedPipeline.id);
    }
  }, [selectedPipeline]);

  const handleStageSelect = (stageId: string) => {
    setSelectedStageId(stageId);
    fetchDealsForStage(stageId);
  };

  const handleMoveDeal = (deal: Deal) => {
    const otherStages = stages.filter((s) => s.id !== deal.stage_id);

    if (otherStages.length === 0) {
      Alert.alert('Informação', 'Não há outras etapas neste funil.');
      return;
    }

    const buttons = otherStages.map((stage) => ({
      text: stage.name,
      onPress: async () => {
        try {
          const { error } = await supabase
            .from('deals')
            .update({ stage_id: stage.id })
            .eq('id', deal.id);

          if (error) {
            Alert.alert('Erro', 'Não foi possível mover o negócio de etapa.');
          } else {
            Alert.alert('Sucesso', `Negócio movido para "${stage.name}"`);
            if (selectedStageId) {
              fetchDealsForStage(selectedStageId);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    }));

    buttons.push({
      text: 'Cancelar',
      onPress: () => {},
      style: 'cancel'
    } as any);

    Alert.alert(
      'Mover Negócio',
      `Escolha a nova etapa para "${deal.title}":`,
      buttons as any,
      { cancelable: true }
    );
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const renderDealItem = ({ item }: { item: Deal }) => {
    return (
      <TouchableOpacity
        onPress={() => handleMoveDeal(item)}
        style={[
          styles.dealCard,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <ThemedView style={styles.dealHeader}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.dealTitle}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.dealValue, { color: colors.primary }]}>
            {formatCurrency(item.value)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.dealFooter}>
          <ThemedView style={styles.contactRow}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <ThemedText style={[styles.contactName, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.contacts?.name || 'Sem contato'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <ThemedText style={[styles.dateText, { color: colors.textSecondary }]}>
              {new Date(item.created_at).toLocaleDateString('pt-BR')}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.backgroundElement }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <ThemedView style={[styles.header, { backgroundColor: colors.background }]}>
          <ThemedView style={styles.headerLeft}>
            <Ionicons name="funnel-outline" size={20} color={colors.primary} />
            <ThemedText type="title" style={styles.headerTitle}>Funil de Vendas</ThemedText>
          </ThemedView>
        </ThemedView>

        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : (
          <ThemedView style={{ flex: 1 }}>
            {/* Stages horizontal selector */}
            <ThemedView
              style={[
                styles.stagesContainer,
                {
                  backgroundColor: colors.background,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stagesScroll}>
                {stages.map((stage) => {
                  const isActive = selectedStageId === stage.id;
                  return (
                    <TouchableOpacity
                      key={stage.id}
                      onPress={() => handleStageSelect(stage.id)}
                      style={[
                        styles.stageTab,
                        isActive && [
                          styles.stageTabActive,
                          { borderBottomColor: colors.primary },
                        ],
                      ]}
                    >
                      <ThemedText
                        type={isActive ? 'smallBold' : 'default'}
                        style={[
                          styles.stageText,
                          isActive ? { color: colors.primary } : { color: colors.textSecondary },
                        ]}
                      >
                        {stage.name}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ThemedView>

            {/* Deals List */}
            {loadingDeals ? (
              <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
            ) : (
              <FlatList
                data={deals}
                keyExtractor={(item) => item.id}
                renderItem={renderDealItem}
                contentContainerStyle={styles.dealsList}
                ListEmptyComponent={
                  <ThemedView style={styles.emptyContainer}>
                    <Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />
                    <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.two }}>
                      Nenhum negócio nesta etapa
                    </ThemedText>
                  </ThemedView>
                }
              />
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  stagesContainer: {
    borderBottomWidth: 1,
  },
  stagesScroll: {
    paddingHorizontal: Spacing.four,
  },
  stageTab: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: Spacing.two,
  },
  stageTabActive: {
    borderBottomWidth: 2,
  },
  stageText: {
    fontSize: 14,
  },
  dealsList: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  dealCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dealTitle: {
    fontSize: 15,
    flex: 1,
    marginRight: Spacing.two,
  },
  dealValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: Spacing.one,
    marginTop: Spacing.one,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    flex: 1,
  },
  contactName: {
    fontSize: 12,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  dateText: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    backgroundColor: 'transparent',
  },
});

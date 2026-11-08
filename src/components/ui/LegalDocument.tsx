import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { LEGAL, type LegalSection } from '@/src/lib/legal';
import { colors } from '@/src/theme/colors';

export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <Screen showBack>
      <ScreenTitle title={title} subtitle={`Atualizado em ${LEGAL.updatedAt}`} />
      {!LEGAL.reviewed ? (
        <View style={styles.draft} accessibilityRole="alert">
          <Text style={styles.draftText}>
            Versão preliminar, em revisão. O texto final será publicado antes do lançamento.
          </Text>
        </View>
      ) : null}
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  draft: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  draftText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  section: { marginBottom: 18 },
  heading: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  paragraph: { fontSize: 15, lineHeight: 22, color: colors.ink, marginBottom: 8 },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  Shield,
  BookOpen,
} from 'lucide-react-native';

import { Card } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'How do I get paid?',
    answer: 'Payments are processed weekly every Monday. Your earnings are automatically deposited to your linked bank account. You can also request instant payouts for a small fee.',
  },
  {
    id: '2',
    question: 'What if a dog gets injured during a walk?',
    answer: 'Safety is our priority. All walks are covered by our insurance policy. In case of an emergency, contact the owner immediately and seek veterinary care if needed. Report all incidents through the app.',
  },
  {
    id: '3',
    question: 'How do I increase my bookings?',
    answer: 'Complete your profile with a great photo and bio, maintain a high rating, respond quickly to requests, and stay available during peak hours (mornings and evenings).',
  },
  {
    id: '4',
    question: 'Can I set my own rates?',
    answer: 'Yes! You can set your hourly rate in your profile. We recommend checking local market rates to stay competitive while earning fairly.',
  },
  {
    id: '5',
    question: 'What happens if I need to cancel a walk?',
    answer: 'We understand emergencies happen. Cancel as early as possible through the app. Frequent last-minute cancellations may affect your rating and visibility.',
  },
];

const supportOptions = [
  {
    icon: MessageCircle,
    label: 'Live Chat',
    subtitle: 'Chat with support',
    action: () => {},
  },
  {
    icon: Mail,
    label: 'Email Support',
    subtitle: 'walkers@packwalk.com',
    action: () => Linking.openURL('mailto:walkers@packwalk.com'),
  },
  {
    icon: Phone,
    label: 'Phone Support',
    subtitle: '1-800-PACKWALK',
    action: () => Linking.openURL('tel:18007225925'),
  },
];

const resourceLinks = [
  { icon: BookOpen, label: 'Walker Guidelines', href: '#' },
  { icon: Shield, label: 'Safety Tips', href: '#' },
  { icon: FileText, label: 'Terms of Service', href: '#' },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(walker)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Support Options */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Card style={styles.supportCard} noPadding>
            {supportOptions.map((option, index) => (
              <Pressable
                key={index}
                style={[
                  styles.supportItem,
                  index !== supportOptions.length - 1 && styles.supportItemBorder,
                ]}
                onPress={option.action}
              >
                <View style={styles.supportIcon}>
                  <option.icon size={iconSizes.md} color={colors.sage} />
                </View>
                <View style={styles.supportContent}>
                  <Text style={styles.supportLabel}>{option.label}</Text>
                  <Text style={styles.supportSubtitle}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={iconSizes.sm} color={colors.inkMuted} />
              </Pressable>
            ))}
          </Card>
        </Animated.View>

        {/* FAQs */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Card style={styles.faqCard} noPadding>
            {faqs.map((faq, index) => (
              <View key={faq.id}>
                <Pressable
                  style={[
                    styles.faqItem,
                    expandedFaq !== faq.id && index !== faqs.length - 1 && styles.faqItemBorder,
                  ]}
                  onPress={() => toggleFaq(faq.id)}
                >
                  <View style={styles.faqQuestion}>
                    <HelpCircle size={18} color={colors.sage} />
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  </View>
                  {expandedFaq === faq.id ? (
                    <ChevronDown size={iconSizes.sm} color={colors.inkMuted} />
                  ) : (
                    <ChevronRight size={iconSizes.sm} color={colors.inkMuted} />
                  )}
                </Pressable>

                {expandedFaq === faq.id && (
                  <View style={[styles.faqAnswer, index !== faqs.length - 1 && styles.faqItemBorder]}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        </Animated.View>

        {/* Resources */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <Card style={styles.resourcesCard} noPadding>
            {resourceLinks.map((link, index) => (
              <Pressable
                key={index}
                style={[
                  styles.resourceItem,
                  index !== resourceLinks.length - 1 && styles.resourceItemBorder,
                ]}
              >
                <View style={styles.resourceIcon}>
                  <link.icon size={iconSizes.sm} color={colors.inkMuted} />
                </View>
                <Text style={styles.resourceLabel}>{link.label}</Text>
                <ChevronRight size={iconSizes.sm} color={colors.inkMuted} />
              </Pressable>
            ))}
          </Card>
        </Animated.View>

        <Text style={styles.versionText}>Packwalk Walker App v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    ...shadows.soft,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },

  // Support section
  supportCard: {
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },

  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  supportItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  supportIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  supportContent: {
    flex: 1,
  },

  supportLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  supportSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  // FAQ section
  faqCard: {
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },

  faqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  faqQuestion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  faqQuestionText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  faqAnswer: {
    padding: spacing.md,
    paddingTop: 0,
    backgroundColor: colors.paper,
  },

  faqAnswerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    lineHeight: 22,
  },

  // Resources section
  resourcesCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },

  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  resourceItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  resourceIcon: {
    marginRight: spacing.md,
  },

  resourceLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  versionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

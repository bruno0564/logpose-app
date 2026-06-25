import { View, StyleSheet, ScrollView, Dimensions } from 'react-native'
import Text from '../components/Text'
import PressableScale from '../components/PressableScale'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'

const PADDING = 20
const GAP = 12

function cardWidth() {
  const { width } = Dimensions.get('window')
  return Math.floor((width - PADDING * 2 - GAP) / 2)
}

const ITEMS = [
  { screen: 'Calendar', icon: 'calendar',            color: '#3b82f6', labelKey: 'nav.calendar', descKey: 'more.calendarDesc' },
  { screen: 'Tasks',    icon: 'checkmark-done',      color: '#22c55e', labelKey: 'nav.todo',     descKey: 'more.tasksDesc'    },
  { screen: 'Quotes',   icon: 'chatbubble-ellipses', color: '#f59e0b', labelKey: 'nav.quotes',   descKey: 'more.quotesDesc'   },
  { screen: 'Countdowns', icon: 'timer',             color: '#06b6d4', labelKey: 'nav.countdowns', descKey: 'more.countdownsDesc' },
  { screen: 'Habits',   icon: 'checkmark-circle',    color: '#ec4899', labelKey: 'nav.habits',   descKey: 'more.habitsDesc'   },
  { screen: 'Settings', icon: 'settings',            color: '#8b5cf6', labelKey: 'nav.settings', descKey: 'more.settingsDesc' },
]

function MoreCard({ item }) {
  const nav    = useNavigation()
  const { theme: t } = useTheme()
  const { t: tr }    = useLang()
  const w = cardWidth()

  return (
    <PressableScale
      onPress={() => nav.navigate(item.screen)}
      style={[styles.card(t, item.color), { width: w }]}
    >
      <View style={styles.iconWrap(t, item.color)}>
        <Ionicons name={item.icon} size={26} color={item.color} />
      </View>
      <Text style={styles.label(t)}>{tr(item.labelKey)}</Text>
      <Text style={styles.desc(t)}>{tr(item.descKey)}</Text>
    </PressableScale>
  )
}

export default function MoreScreen() {
  const { theme: t } = useTheme()
  const { t: tr }    = useLang()
  const insets       = useSafeAreaInsets()

  return (
    <FadeInView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: PADDING,
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          gap: GAP,
        }}
      >
        <Text style={styles.title(t)}>{tr('more.title')}</Text>

        <View style={styles.grid}>
          {ITEMS.map(item => (
            <MoreCard key={item.screen} item={item} />
          ))}
        </View>
      </ScrollView>
    </FadeInView>
  )
}

const styles = {
  title: (t) => ({
    color: t.cartoon ? t.accent : t.text,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: t.fontTitle,
    textTransform: t.cartoon ? 'uppercase' : 'none',
    letterSpacing: t.cartoon ? 1 : -0.5,
    marginBottom: 8,
    ...titleShadow(t),
  }),
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: (t, accentColor) => ({
    backgroundColor: t.surface,
    borderRadius: t.cartoon ? 14 : 16,
    padding: 18,
    gap: 10,
    borderWidth: t.cartoon ? t.cardBorderWidth : 1,
    borderColor: t.cartoon ? t.cardBorderColor : t.border,
    ...(t.cartoon ? t.shadow : {
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    }),
  }),
  iconWrap: (t, accentColor) => ({
    width: 48,
    height: 48,
    borderRadius: t.cartoon ? 10 : 12,
    backgroundColor: accentColor + '18',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  label: (t) => ({
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: t.fontTitle,
    textTransform: t.cartoon ? 'uppercase' : 'none',
    letterSpacing: t.cartoon ? 0.5 : 0,
  }),
  desc: (t) => ({
    color: t.text3,
    fontSize: 12,
    lineHeight: 17,
  }),
}

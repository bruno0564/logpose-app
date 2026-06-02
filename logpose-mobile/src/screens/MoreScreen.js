import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import FadeInView from '../components/FadeInView'

const ITEMS = [
  {
    screen:  'Calendar',
    icon:    'calendar',
    color:   '#3b82f6',
    labelKey: 'nav.calendar',
    descKey:  'more.calendarDesc',
  },
  {
    screen:  'Tasks',
    icon:    'checkmark-done',
    color:   '#22c55e',
    labelKey: 'nav.todo',
    descKey:  'more.tasksDesc',
  },
  {
    screen:  'Quotes',
    icon:    'chatbubble-ellipses',
    color:   '#f59e0b',
    labelKey: 'nav.quotes',
    descKey:  'more.quotesDesc',
  },
  {
    screen:  'Settings',
    icon:    'settings',
    color:   '#8b5cf6',
    labelKey: 'nav.settings',
    descKey:  'more.settingsDesc',
  },
]

function MoreCard({ item }) {
  const nav = useNavigation()
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = cardStyles(t, item.color)

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => nav.navigate(item.screen)}
      activeOpacity={0.75}
    >
      <View style={s.iconWrap}>
        <Ionicons name={item.icon} size={28} color={item.color} />
      </View>
      <Text style={s.label}>{tr(item.labelKey)}</Text>
      <Text style={s.desc}>{tr(item.descKey)}</Text>
    </TouchableOpacity>
  )
}

export default function MoreScreen() {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)

  return (
    <FadeInView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{tr('more.title')}</Text>
        <View style={s.grid}>
          {ITEMS.map(item => (
            <MoreCard key={item.screen} item={item} />
          ))}
        </View>
      </ScrollView>
    </FadeInView>
  )
}

const cardStyles = (t, accentColor) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: t.cartoon ? 14 : 16,
    padding: 20,
    gap: 10,
    borderWidth: t.cartoon ? t.cardBorderWidth : 1,
    borderColor: t.cartoon ? t.cardBorderColor : t.border,
    ...(t.cartoon ? t.shadow : {
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: t.cartoon ? 10 : 14,
    backgroundColor: accentColor + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.cartoon ? 2 : 0,
    borderColor: t.cartoon ? t.cardBorderColor : 'transparent',
  },
  label: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: t.fontTitle,
    textTransform: t.cartoon ? 'uppercase' : 'none',
    letterSpacing: t.cartoon ? 0.5 : 0,
  },
  desc: {
    color: t.text3,
    fontSize: 12,
    lineHeight: 17,
  },
})

const makeStyles = (t) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: t.bg },
  content: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  title:   {
    color: t.cartoon ? t.accent : t.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    fontFamily: t.fontTitle,
    textTransform: t.cartoon ? 'uppercase' : 'none',
    letterSpacing: t.cartoon ? 1 : -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
})

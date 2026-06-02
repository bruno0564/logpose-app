import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Keyboard,
} from 'react-native'
import FadeInView from '../components/FadeInView'
import { Ionicons } from '@expo/vector-icons'
import {
  getTaskLists, insertTaskList, deleteTaskList,
  getTaskItems, insertTaskItem, toggleTaskItem, deleteTaskItem,
  getUnsyncedTaskLists, getPendingDeleteTaskLists, markTaskListSynced, deleteLocalTaskList,
  getUnsyncedTaskItems, getPendingDeleteTaskItems, markTaskItemSynced, deleteLocalTaskItem,
  upsertTaskListFromServer, upsertTaskItemFromServer,
  pruneStaleTaskLists, pruneStaleTaskItemsForList,
} from '../db/database'
import {
  isServerReachable,
  fetchAllTaskListsFromServer, postTaskListToServer, deleteTaskListFromServer,
  fetchTaskItemsFromServer, postTaskItemToServer, putTaskItemToServer, deleteTaskItemFromServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingTasks = false

function ListModal({ visible, value, onChange, onClose, onSave }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [kbHeight, setKbHeight] = useState(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[s.overlay, { paddingBottom: kbHeight }]}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{tr('tasks.newList')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" color={t.text2} size={22} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.modalInput}
            placeholder={tr('tasks.listNamePh')}
            placeholderTextColor={t.text3}
            value={value}
            onChangeText={onChange}
            autoFocus
            onSubmitEditing={onSave}
            returnKeyType="done"
          />
          <TouchableOpacity style={s.saveBtn} onPress={onSave}>
            <Text style={s.saveBtnText}>{tr('common.create')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function ConfirmModal({ visible, name, onConfirm, onCancel }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{tr('tasks.deleteList')}</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" color={t.text2} size={20} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: t.text2, fontSize: 14, marginBottom: 20 }}>
            {tr('tasks.deleteListMsg', { name })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={s.saveBtn} onPress={onCancel}>
              <Text style={[s.saveBtnText, { color: t.text2 }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: t.dangerBg }]} onPress={onConfirm}>
              <Text style={[s.saveBtnText, { color: t.dangerText }]}>{tr('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

export default function TasksScreen() {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [lists, setLists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const activeListRef = useRef(null)
  const [items, setItems] = useState([])
  const [newListName, setNewListName] = useState('')
  const [newItemTitle, setNewItemTitle] = useState('')
  const [listModalVisible, setListModalVisible] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [kbHeight, setKbHeight] = useState(0)

  const loadLists = useCallback(async () => {
    const rows = await getTaskLists()
    setLists(rows)
    return rows
  }, [])

  const loadItems = useCallback(async (localListId) => {
    const rows = await getTaskItems(localListId)
    setItems(rows)
  }, [])

  const sync = useCallback(async () => {
    if (syncingTasks) return
    syncingTasks = true
    try {
      if (!await isServerReachable()) return
      for (const lst of await getUnsyncedTaskLists()) {
        const created = await postTaskListToServer(lst.name)
        await markTaskListSynced(lst.id, created.id)
      }
      for (const item of await getUnsyncedTaskItems()) {
        if (item.server_id) {
          await putTaskItemToServer(item.server_id, item.title, item.done === 1)
        } else {
          const created = await postTaskItemToServer(item.list_server_id, item.title, item.done === 1)
          await markTaskItemSynced(item.id, created.id)
        }
      }
      for (const item of await getPendingDeleteTaskItems()) {
        await deleteTaskItemFromServer(item.server_id)
        await deleteLocalTaskItem(item.id)
      }
      for (const lst of await getPendingDeleteTaskLists()) {
        await deleteTaskListFromServer(lst.server_id)
        await deleteLocalTaskList(lst.id)
      }
      const serverLists = await fetchAllTaskListsFromServer()
      for (const serverList of serverLists) {
        const localListId = await upsertTaskListFromServer(serverList)
        const serverItems = await fetchTaskItemsFromServer(serverList.id)
        for (const serverItem of serverItems) {
          await upsertTaskItemFromServer(serverItem, localListId)
        }
        await pruneStaleTaskItemsForList(localListId, new Set(serverItems.map(i => i.id)))
      }
      await pruneStaleTaskLists(new Set(serverLists.map(l => l.id)))
    } catch {} finally {
      syncingTasks = false
      await loadLists()
      if (activeListRef.current) await loadItems(activeListRef.current.id)
    }
  }, [loadLists, loadItems])

  useFocusEffect(
    useCallback(() => {
      async function init() {
        await loadLists()
        sync()
      }
      init()
    }, [loadLists, sync])
  )

  useEffect(() => {
    activeListRef.current = activeList
    if (activeList) loadItems(activeList.id)
    else setItems([])
  }, [activeList])

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  async function handleAddList() {
    if (!newListName.trim()) return
    const localId = await insertTaskList(newListName.trim())
    setNewListName('')
    setListModalVisible(false)
    const rows = await loadLists()
    const created = rows.find(l => l.id === localId)
    if (created) setActiveList(created)
    sync()
  }

  function handleDeleteList(list) {
    setConfirmTarget(list)
  }

  async function confirmDeleteList() {
    const list = confirmTarget
    setConfirmTarget(null)
    await deleteTaskList(list.id)
    const rows = await loadLists()
    setActiveList(rows.length > 0 ? rows[0] : null)
    sync()
  }

  async function handleAddItem() {
    if (!newItemTitle.trim() || !activeList) return
    await insertTaskItem(activeList.id, newItemTitle.trim())
    setNewItemTitle('')
    await loadItems(activeList.id)
    sync()
  }

  async function handleToggle(item) {
    await toggleTaskItem(item.id, item.done === 0)
    await loadItems(activeList.id)
    sync()
  }

  async function handleDeleteItem(item) {
    await deleteTaskItem(item.id)
    await loadItems(activeList.id)
    sync()
  }

  const pending = items.filter(i => i.done === 0)
  const done = items.filter(i => i.done === 1)

  if (!activeList && lists.length === 0) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{tr('tasks.title')}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setListModalVisible(true)}>
            <Ionicons name="add" color={t.text} size={22} />
          </TouchableOpacity>
        </View>
        <View style={s.empty}>
          <Ionicons name="checkmark-done-outline" color={t.text4} size={56} />
          <Text style={s.emptyText}>{tr('tasks.noLists')}</Text>
          <Text style={s.emptySub}>{tr('tasks.firstListHint')}</Text>
        </View>
        <ListModal
          visible={listModalVisible}
          value={newListName}
          onChange={setNewListName}
          onClose={() => { setListModalVisible(false); setNewListName('') }}
          onSave={handleAddList}
        />
        <ConfirmModal
          visible={confirmTarget !== null}
          name={confirmTarget?.name ?? ''}
          onConfirm={confirmDeleteList}
          onCancel={() => setConfirmTarget(null)}
        />
      </View>
    )
  }

  return (
    <FadeInView style={s.container}>
      <View style={s.header}>
        {activeList ? (
          <TouchableOpacity onPress={() => setActiveList(null)}>
            <Ionicons name="chevron-back" color={t.accent} size={22} />
          </TouchableOpacity>
        ) : null}
        <Text style={s.title}>{activeList ? activeList.name : tr('tasks.title')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setListModalVisible(true)}>
          <Ionicons name="add" color={t.text} size={22} />
        </TouchableOpacity>
      </View>

      {!activeList ? (
        <FlatList
          data={lists}
          keyExtractor={l => String(l.id)}
          contentContainerStyle={s.listContainer}
          renderItem={({ item: list }) => (
            <TouchableOpacity style={s.listCard} onPress={() => setActiveList(list)}>
              <View style={s.listCardLeft}>
                <Ionicons name="list-outline" color={t.accent} size={18} />
                <Text style={s.listCardName}>{list.name}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteList(list)}>
                <Ionicons name="trash-outline" color={t.danger} size={16} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {lists.length > 1 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={lists}
              keyExtractor={l => String(l.id)}
              style={s.tabsRow}
              contentContainerStyle={s.tabsContent}
              renderItem={({ item: list }) => (
                <TouchableOpacity
                  style={[s.tab, activeList.id === list.id && s.tabActive]}
                  onPress={() => setActiveList(list)}
                >
                  <Text style={[s.tabText, activeList.id === list.id && s.tabTextActive]}>
                    {list.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <FlatList
            data={pending}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={[s.itemsContainer, { paddingBottom: kbHeight + 80 }]}
            ListEmptyComponent={
              <Text style={s.emptyItems}>{tr('tasks.emptyItems')}</Text>
            }
            ListFooterComponent={
              done.length > 0 ? (
                <View>
                  <Text style={s.doneLabel}>{tr('tasks.doneLabel')}</Text>
                  {done.map(item => (
                    <ItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDeleteItem} />
                  ))}
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ItemRow item={item} onToggle={handleToggle} onDelete={handleDeleteItem} />
            )}
          />

          <View style={[s.addItemRow, { bottom: kbHeight }]}>
            <TextInput
              style={s.addItemInput}
              placeholder={tr('tasks.newItemPh')}
              placeholderTextColor={t.text3}
              value={newItemTitle}
              onChangeText={setNewItemTitle}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addItemBtn} onPress={handleAddItem}>
              <Ionicons name="arrow-up" color={t.text} size={18} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ListModal
        visible={listModalVisible}
        value={newListName}
        onChange={setNewListName}
        onClose={() => { setListModalVisible(false); setNewListName('') }}
        onSave={handleAddList}
      />
      <ConfirmModal
        visible={confirmTarget !== null}
        name={confirmTarget?.name ?? ''}
        onConfirm={confirmDeleteList}
        onCancel={() => setConfirmTarget(null)}
      />
    </FadeInView>
  )
}

function ItemRow({ item, onToggle, onDelete }) {
  const { theme: t } = useTheme()
  const s = makeStyles(t)
  return (
    <View style={s.itemRow}>
      <TouchableOpacity style={s.checkBtn} onPress={() => onToggle(item)}>
        <View style={[s.checkCircle, item.done === 1 && s.checkCircleDone]}>
          {item.done === 1 && <Ionicons name="checkmark" color={t.text} size={12} />}
        </View>
      </TouchableOpacity>
      <Text style={[s.itemTitle, item.done === 1 && s.itemTitleDone]}>{item.title}</Text>
      <TouchableOpacity onPress={() => onDelete(item)} style={s.deleteBtn}>
        <Ionicons name="close" color={t.text4} size={16} />
      </TouchableOpacity>
    </View>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: t.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  title:           { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', flex: 1, marginHorizontal: 8, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  addBtn:          { backgroundColor: t.accent, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:       { color: t.text4, fontSize: 16, fontWeight: '600' },
  emptySub:        { color: t.text4, fontSize: 13 },
  listContainer:   { paddingHorizontal: 16, paddingBottom: 32 },
  listCard:        { backgroundColor: t.surface2, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  listCardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  listCardName:    { color: t.text, fontSize: 15, fontWeight: '600', fontFamily: t.fontTitle },
  tabsRow:         { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: t.surface2 },
  tabsContent:     { paddingHorizontal: 16, gap: 8 },
  tab:             { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  tabActive:       { backgroundColor: t.surface2 },
  tabText:         { color: t.text3, fontSize: 13, fontWeight: '500' },
  tabTextActive:   { color: t.accent },
  itemsContainer:  { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  emptyItems:      { color: t.text4, fontSize: 14, textAlign: 'center', marginTop: 40 },
  doneLabel:       { color: t.text4, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 },
  itemRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.surface2, gap: 12 },
  checkBtn:        { padding: 2 },
  checkCircle:     { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: t.text4, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: t.accent, borderColor: t.accent },
  itemTitle:       { flex: 1, color: t.text, fontSize: 15 },
  itemTitleDone:   { color: t.text4, textDecorationLine: 'line-through' },
  deleteBtn:       { padding: 4 },
  addItemRow:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 32, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.surface2, gap: 10 },
  addItemInput:    { flex: 1, backgroundColor: t.surface2, color: t.text, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  addItemBtn:      { backgroundColor: t.accent, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: t.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { color: t.text, fontSize: 16, fontWeight: '700', fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  modalInput:      { backgroundColor: t.border2, color: t.text, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  saveBtn:         { backgroundColor: t.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  saveBtnText:     { color: t.cartoon ? t.bg : t.text, fontWeight: '700', fontSize: 15, fontFamily: t.fontTitle },
})

import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Keyboard,
} from 'react-native'
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

let syncingTasks = false

function ListModal({ visible, value, onChange, onClose, onSave }) {
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
            <Text style={s.modalTitle}>Nueva lista</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" color="#aaa" size={22} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.modalInput}
            placeholder="Nombre de la lista"
            placeholderTextColor="#444"
            value={value}
            onChangeText={onChange}
            autoFocus
            onSubmitEditing={onSave}
            returnKeyType="done"
          />
          <TouchableOpacity style={s.saveBtn} onPress={onSave}>
            <Text style={s.saveBtnText}>Crear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function ConfirmModal({ visible, name, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Eliminar lista</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" color="#aaa" size={20} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
            ¿Eliminar "{name}" y todas sus tareas?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={s.saveBtn} onPress={onCancel}>
              <Text style={[s.saveBtnText, { color: '#aaa' }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: 'rgba(127,29,29,0.8)' }]} onPress={onConfirm}>
              <Text style={[s.saveBtnText, { color: '#fca5a5' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

export default function TasksScreen() {
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
    } catch { /* offline */ } finally {
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
          <Text style={s.title}>To-Do</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setListModalVisible(true)}>
            <Ionicons name="add" color="#fff" size={22} />
          </TouchableOpacity>
        </View>
        <View style={s.empty}>
          <Ionicons name="checkmark-done-outline" color="#2a2a2a" size={56} />
          <Text style={s.emptyText}>Sin listas todavía</Text>
          <Text style={s.emptySub}>Pulsa + para crear la primera</Text>
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
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {activeList ? (
          <TouchableOpacity onPress={() => setActiveList(null)}>
            <Ionicons name="chevron-back" color="#7c3aed" size={22} />
          </TouchableOpacity>
        ) : null}
        <Text style={s.title}>{activeList ? activeList.name : 'To-Do'}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setListModalVisible(true)}>
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      {/* Lists picker (when no active list selected or multiple lists) */}
      {!activeList ? (
        <FlatList
          data={lists}
          keyExtractor={l => String(l.id)}
          contentContainerStyle={s.listContainer}
          renderItem={({ item: list }) => (
            <TouchableOpacity style={s.listCard} onPress={() => setActiveList(list)}>
              <View style={s.listCardLeft}>
                <Ionicons name="list-outline" color="#7c3aed" size={18} />
                <Text style={s.listCardName}>{list.name}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteList(list)}>
                <Ionicons name="trash-outline" color="#ef4444" size={16} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* List tabs */}
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

          {/* Items */}
          <FlatList
            data={pending}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={[s.itemsContainer, { paddingBottom: kbHeight + 80 }]}
            ListEmptyComponent={
              <Text style={s.emptyItems}>Sin tareas pendientes.</Text>
            }
            ListFooterComponent={
              done.length > 0 ? (
                <View>
                  <Text style={s.doneLabel}>Completadas</Text>
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

          {/* Add item input — sube con el teclado */}
          <View style={[s.addItemRow, { bottom: kbHeight }]}>
            <TextInput
              style={s.addItemInput}
              placeholder="Nueva tarea..."
              placeholderTextColor="#444"
              value={newItemTitle}
              onChangeText={setNewItemTitle}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addItemBtn} onPress={handleAddItem}>
              <Ionicons name="arrow-up" color="#fff" size={18} />
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
    </View>
  )
}

function ItemRow({ item, onToggle, onDelete }) {
  return (
    <View style={s.itemRow}>
      <TouchableOpacity style={s.checkBtn} onPress={() => onToggle(item)}>
        <View style={[s.checkCircle, item.done === 1 && s.checkCircleDone]}>
          {item.done === 1 && <Ionicons name="checkmark" color="#fff" size={12} />}
        </View>
      </TouchableOpacity>
      <Text style={[s.itemTitle, item.done === 1 && s.itemTitleDone]}>{item.title}</Text>
      <TouchableOpacity onPress={() => onDelete(item)} style={s.deleteBtn}>
        <Ionicons name="close" color="#333" size={16} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f0f0f' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  title:           { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1, marginHorizontal: 8 },
  addBtn:          { backgroundColor: '#7c3aed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:       { color: '#333', fontSize: 16, fontWeight: '600' },
  emptySub:        { color: '#2a2a2a', fontSize: 13 },
  listContainer:   { paddingHorizontal: 16, paddingBottom: 32 },
  listCard:        { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listCardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  listCardName:    { color: '#e8e8e8', fontSize: 15, fontWeight: '600' },
  tabsRow:         { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tabsContent:     { paddingHorizontal: 16, gap: 8 },
  tab:             { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  tabActive:       { backgroundColor: '#1a1a1a' },
  tabText:         { color: '#444', fontSize: 13, fontWeight: '500' },
  tabTextActive:   { color: '#7c3aed' },
  itemsContainer:  { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  emptyItems:      { color: '#2a2a2a', fontSize: 14, textAlign: 'center', marginTop: 40 },
  doneLabel:       { color: '#333', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 },
  itemRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 12 },
  checkBtn:        { padding: 2 },
  checkCircle:     { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  itemTitle:       { flex: 1, color: '#ccc', fontSize: 15 },
  itemTitleDone:   { color: '#333', textDecorationLine: 'line-through' },
  deleteBtn:       { padding: 4 },
  addItemRow:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 32, backgroundColor: '#0f0f0f', borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 10 },
  addItemInput:    { flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  addItemBtn:      { backgroundColor: '#7c3aed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalInput:      { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  saveBtn:         { backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
})

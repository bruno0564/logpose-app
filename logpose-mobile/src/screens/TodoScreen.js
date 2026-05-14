import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Alert, Keyboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  getTodoLists, insertTodoList, deleteTodoList,
  getTodoItems, insertTodoItem, toggleTodoItem, deleteTodoItem,
  getUnsyncedTodoLists, getPendingDeleteTodoLists, markTodoListSynced, deleteLocalTodoList,
  getUnsyncedTodoItems, getPendingDeleteTodoItems, markTodoItemSynced, deleteLocalTodoItem,
  upsertTodoListFromServer, upsertTodoItemFromServer,
} from '../db/database'
import {
  isServerReachable,
  fetchAllTodoListsFromServer, postTodoListToServer, deleteTodoListFromServer,
  fetchTodoItemsFromServer, postTodoItemToServer, putTodoItemToServer, deleteTodoItemFromServer,
} from '../api/client'

export default function TodoScreen() {
  const [lists, setLists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const activeListRef = useRef(null)
  const [items, setItems] = useState([])
  const [newListName, setNewListName] = useState('')
  const [newItemTitle, setNewItemTitle] = useState('')
  const [listModalVisible, setListModalVisible] = useState(false)
  const [kbHeight, setKbHeight] = useState(0)

  const loadLists = useCallback(async () => {
    const rows = await getTodoLists()
    setLists(rows)
    return rows
  }, [])

  const loadItems = useCallback(async (localListId) => {
    const rows = await getTodoItems(localListId)
    setItems(rows)
  }, [])

  const sync = useCallback(async () => {
    try {
      const reachable = await isServerReachable()
      if (!reachable) return

      // Upload: new lists
      const unsyncedLists = await getUnsyncedTodoLists()
      for (const lst of unsyncedLists) {
        const created = await postTodoListToServer(lst.name)
        await markTodoListSynced(lst.id, created.id)
      }

      // Upload: new/updated items
      const unsyncedItems = await getUnsyncedTodoItems()
      for (const item of unsyncedItems) {
        if (item.server_id) {
          await putTodoItemToServer(item.server_id, item.title, item.done === 1)
        } else {
          const created = await postTodoItemToServer(item.list_server_id, item.title, item.done === 1)
          await markTodoItemSynced(item.id, created.id)
        }
      }

      // Upload: pending delete items
      const pendingItems = await getPendingDeleteTodoItems()
      for (const item of pendingItems) {
        await deleteTodoItemFromServer(item.server_id)
        await deleteLocalTodoItem(item.id)
      }

      // Upload: pending delete lists
      const pendingLists = await getPendingDeleteTodoLists()
      for (const lst of pendingLists) {
        await deleteTodoListFromServer(lst.server_id)
        await deleteLocalTodoList(lst.id)
      }

      // Pull: all lists and their items from server
      const serverLists = await fetchAllTodoListsFromServer()
      for (const serverList of serverLists) {
        const localListId = await upsertTodoListFromServer(serverList)
        const serverItems = await fetchTodoItemsFromServer(serverList.id)
        for (const serverItem of serverItems) {
          await upsertTodoItemFromServer(serverItem, localListId)
        }
      }
    } catch {
      // Sync failed silently — data stays local
    } finally {
      await loadLists()
      if (activeListRef.current) await loadItems(activeListRef.current.id)
    }
  }, [loadLists, loadItems])

  useEffect(() => {
    async function init() {
      const rows = await loadLists()
      if (rows.length > 0) setActiveList(rows[0])
      await sync()
    }
    init()
  }, [])

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
    const localId = await insertTodoList(newListName.trim())
    setNewListName('')
    setListModalVisible(false)
    const rows = await loadLists()
    const created = rows.find(l => l.id === localId)
    if (created) setActiveList(created)
    sync()
  }

  async function handleDeleteList(list) {
    Alert.alert(
      'Eliminar lista',
      `¿Eliminar "${list.name}" y todas sus tareas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => {
          await deleteTodoList(list.id)
          const rows = await loadLists()
          setActiveList(rows.length > 0 ? rows[0] : null)
          sync()
        }},
      ]
    )
  }

  async function handleAddItem() {
    if (!newItemTitle.trim() || !activeList) return
    await insertTodoItem(activeList.id, newItemTitle.trim())
    setNewItemTitle('')
    await loadItems(activeList.id)
    sync()
  }

  async function handleToggle(item) {
    await toggleTodoItem(item.id, item.done === 0)
    await loadItems(activeList.id)
    sync()
  }

  async function handleDeleteItem(item) {
    await deleteTodoItem(item.id)
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
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {activeList && lists.length > 1 ? (
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

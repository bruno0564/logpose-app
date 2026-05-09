import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Alert, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getExercises, addExercise, updateExercise, deleteExercise } from '../db/database'

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Otro']

function ExerciseModal({ visible, exercise, onClose, onSave }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setName(exercise?.name ?? '')
    setMuscle(exercise?.muscle_group ?? '')
    setNotes(exercise?.notes ?? '')
  }, [exercise, visible])

  function handleSave() {
    if (!name.trim()) return
    onSave(name, muscle, notes)
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" color="#aaa" size={22} />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Nombre *</Text>
          <TextInput
            style={s.input}
            placeholder="Ej: Press banca"
            placeholderTextColor="#444"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={s.label}>Grupo muscular</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
            {MUSCLE_GROUPS.map(g => (
              <TouchableOpacity
                key={g}
                style={[s.chip, muscle === g && s.chipActive]}
                onPress={() => setMuscle(muscle === g ? '' : g)}
              >
                <Text style={[s.chipText, muscle === g && s.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Notas</Text>
          <TextInput
            style={s.input}
            placeholder="Ej: Agarre ancho"
            placeholderTextColor="#444"
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default function GymScreen() {
  const [exercises, setExercises] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setExercises(await getExercises())
  }, [])

  useEffect(() => { load() }, [])

  async function handleSave(name, muscle, notes) {
    if (editing) {
      await updateExercise(editing.id, name, muscle, notes)
    } else {
      await addExercise(name, muscle, notes)
    }
    setModalVisible(false)
    setEditing(null)
    await load()
  }

  function handleEdit(exercise) {
    setEditing(exercise)
    setModalVisible(true)
  }

  function handleDelete(exercise) {
    Alert.alert(
      'Eliminar ejercicio',
      `¿Eliminar "${exercise.name}"? También se borrarán todos sus registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: async () => {
          await deleteExercise(exercise.id)
          await load()
        }},
      ]
    )
  }

  // Agrupar por grupo muscular
  const grouped = exercises.reduce((acc, ex) => {
    const key = ex.muscle_group || 'Sin grupo'
    if (!acc[key]) acc[key] = []
    acc[key].push(ex)
    return acc
  }, {})

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Gym</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditing(null); setModalVisible(true) }}
        >
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      {exercises.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="barbell-outline" color="#2a2a2a" size={56} />
          <Text style={s.emptyText}>Sin ejercicios todavía</Text>
          <Text style={s.emptySub}>Pulsa + para añadir el primero</Text>
        </View>
      ) : (
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([group]) => group}
          contentContainerStyle={s.list}
          renderItem={({ item: [group, exs] }) => (
            <View style={s.group}>
              <Text style={s.groupLabel}>{group}</Text>
              {exs.map(ex => (
                <View key={ex.id} style={s.row}>
                  <View style={s.rowInfo}>
                    <Text style={s.rowName}>{ex.name}</Text>
                    {ex.notes ? <Text style={s.rowNotes}>{ex.notes}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleEdit(ex)} style={s.iconBtn}>
                    <Ionicons name="pencil-outline" color="#555" size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(ex)} style={s.iconBtn}>
                    <Ionicons name="trash-outline" color="#ef4444" size={18} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        />
      )}

      <ExerciseModal
        visible={modalVisible}
        exercise={editing}
        onClose={() => { setModalVisible(false); setEditing(null) }}
        onSave={handleSave}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f0f0f' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  title:           { color: '#fff', fontSize: 22, fontWeight: '700' },
  addBtn:          { backgroundColor: '#7c3aed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:       { color: '#333', fontSize: 16, fontWeight: '600' },
  emptySub:        { color: '#2a2a2a', fontSize: 13 },
  list:            { paddingHorizontal: 16, paddingBottom: 32 },
  group:           { marginBottom: 24 },
  groupLabel:      { color: '#7c3aed', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 6 },
  rowInfo:         { flex: 1 },
  rowName:         { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowNotes:        { color: '#555', fontSize: 12, marginTop: 2 },
  iconBtn:         { padding: 6 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  label:           { color: '#555', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input:           { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  chipRow:         { flexDirection: 'row', marginBottom: 4 },
  chip:            { backgroundColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  chipActive:      { backgroundColor: '#7c3aed' },
  chipText:        { color: '#555', fontSize: 13 },
  chipTextActive:  { color: '#fff' },
  saveBtn:         { backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
})

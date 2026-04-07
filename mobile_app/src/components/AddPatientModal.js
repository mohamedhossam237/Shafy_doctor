import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { 
  Modal, Portal, Text, TextInput, Button, IconButton, 
  SegmentedButtons, HelperText, Surface, useTheme,
  Divider, Menu, List
} from 'react-native-paper';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../providers/AuthProvider';

export default function AddPatientModal({ visible, onDismiss, onSaved }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showRelationPicker, setShowRelationPicker] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male',
    familyRelation: 'himself'
  });
  const [errors, setErrors] = useState({});
  const [linkedTo, setLinkedTo] = useState(null);

  const normalizePhone = (raw = '') => {
    const d = raw.replace(/\D/g, '');
    let digits = d.replace(/^0+/, '');
    return digits.startsWith('20') ? `+${digits}` : `+20${digits}`;
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Required';
    if (!form.phone.trim()) newErrors.phone = 'Required';
    else if (form.phone.length < 8) newErrors.phone = 'Too short';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const normalizedPhone = normalizePhone(form.phone);
      const patientsCol = collection(db, 'patients');

      // 1. Check Name Uniqueness
      const nameQ = query(
        patientsCol,
        where('associatedDoctors', 'array-contains', user.uid),
        where('name', '==', form.name.trim())
      );
      const nameSnap = await getDocs(nameQ);
      if (!nameSnap.empty) {
        setErrors({ name: 'Patient already exists' });
        setLoading(false);
        return;
      }

      // 2. Check Phone existence for relationship picker
      if (!showRelationPicker) {
        const phoneQ = query(
          patientsCol,
          where('associatedDoctors', 'array-contains', user.uid),
          where('phone', '==', normalizedPhone)
        );
        const phoneSnap = await getDocs(phoneQ);
        if (!phoneSnap.empty) {
          const primary = phoneSnap.docs.find(d => d.data().familyRelation === 'himself') || phoneSnap.docs[0];
          setLinkedTo(primary.id);
          setShowRelationPicker(true);
          setLoading(false);
          return;
        }
      }

      // 3. Save
      const payload = {
        ...form,
        name: form.name.trim(),
        phone: normalizedPhone,
        age: form.age ? Number(form.age) : null,
        associatedDoctors: [user.uid],
        registeredBy: user.uid,
        linkedTo: linkedTo || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'patients'), payload);
      reset();
      onSaved?.();
      onDismiss();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({ name: '', phone: '', age: '', gender: 'male', familyRelation: 'himself' });
    setErrors({});
    setShowRelationPicker(false);
    setLinkedTo(null);
  };

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={submitting ? undefined : onDismiss} 
        contentContainerStyle={styles.modal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView>
            <View style={styles.header}>
              <Text variant="headlineSmall" style={styles.title}>New Patient</Text>
              <IconButton icon="close" onPress={onDismiss} />
            </View>

            <View style={styles.body}>
              <TextInput
                label="Full Name"
                value={form.name}
                onChangeText={t => setForm(f => ({...f, name: t}))}
                error={!!errors.name}
                mode="outlined"
                style={styles.input}
              />
              {errors.name && <HelperText type="error">{errors.name}</HelperText>}

              <TextInput
                label="Phone Number"
                value={form.phone}
                onChangeText={t => setForm(f => ({...f, phone: t}))}
                error={!!errors.phone}
                mode="outlined"
                keyboardType="phone-pad"
                style={styles.input}
              />
              {errors.phone && <HelperText type="error">{errors.phone}</HelperText>}

              <View style={styles.row}>
                <TextInput
                  label="Age"
                  value={form.age}
                  onChangeText={t => setForm(f => ({...f, age: t.replace(/\D/g, '')}))}
                  mode="outlined"
                  keyboardType="numeric"
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                />
                <View style={{ flex: 1.5, justifyContent: 'center' }}>
                  <SegmentedButtons
                    value={form.gender}
                    onValueChange={v => setForm(f => ({...f, gender: v}))}
                    buttons={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                    ]}
                  />
                </View>
              </View>

              {showRelationPicker && (
                <Surface style={styles.relationPicker} elevation={1}>
                  <Text variant="labelLarge" style={styles.pickerLabel}>
                    الرقم مسجل بالفعل. اختر صلة القرابة:
                  </Text>
                  <SegmentedButtons
                    value={form.familyRelation}
                    onValueChange={v => setForm(f => ({...f, familyRelation: v}))}
                    buttons={[
                      { value: 'son', label: 'إبن' },
                      { value: 'wife', label: 'زوجة' },
                      { value: 'mom', label: 'أم' },
                      { value: 'dad', label: 'أب' },
                    ]}
                    density="compact"
                  />
                </Surface>
              )}

              <Button 
                mode="contained" 
                onPress={handleSave} 
                loading={loading}
                disabled={loading}
                style={styles.saveBtn}
                contentStyle={{ height: 48 }}
              >
                Create Patient
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#1a237e',
  },
  body: {
    padding: 20,
    paddingTop: 0,
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  relationPicker: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff8e1',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  pickerLabel: {
    marginBottom: 8,
    color: '#795548',
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 12,
  },
});

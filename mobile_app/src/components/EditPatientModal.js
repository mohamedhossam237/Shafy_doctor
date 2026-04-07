import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Modal, Portal, Text, TextInput, Button, 
  IconButton, useTheme, SegmentedButtons, HelperText 
} from 'react-native-paper';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function EditPatientModal({ visible, onDismiss, patient }) {
  const theme = useTheme();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [bloodType, setBloodType] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (patient) {
      setName(patient.name || '');
      setPhone(patient.phone || '');
      setAge(patient.age?.toString() || '');
      setGender(patient.gender || 'male');
      setBloodType(patient.bloodType || '');
    }
  }, [patient, visible]);

  const handleUpdate = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        name,
        phone,
        age: age ? parseInt(age) : null,
        gender,
        bloodType,
        updatedAt: new Date(),
      });
      Alert.alert('Success', 'Patient updated successfully');
      onDismiss();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>Edit Patient</Text>
          <IconButton icon="close" onPress={onDismiss} />
        </View>

        <ScrollView>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          
          <TextInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <View style={styles.row}>
            <TextInput
              label="Age"
              value={age}
              onChangeText={setAge}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1, marginRight: 10 }]}
            />
            <TextInput
              label="Blood Type"
              value={bloodType}
              onChangeText={setBloodType}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. O+"
            />
          </View>

          <Text variant="labelLarge" style={styles.label}>Gender</Text>
          <SegmentedButtons
            value={gender}
            onValueChange={setGender}
            buttons={[
              { value: 'male', label: 'Male', icon: 'human-male' },
              { value: 'female', label: 'Female', icon: 'human-female' },
            ]}
            style={styles.segmented}
          />

          <Button 
            mode="contained" 
            onPress={handleUpdate} 
            loading={loading} 
            style={styles.updateBtn}
            contentStyle={{ height: 50 }}
          >
            Save Changes
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontWeight: 'bold', color: '#1a237e' },
  input: { marginBottom: 15 },
  row: { flexDirection: 'row', marginBottom: 15 },
  label: { marginBottom: 8, color: 'gray' },
  segmented: { marginBottom: 20 },
  updateBtn: { borderRadius: 12, marginTop: 10 }
});

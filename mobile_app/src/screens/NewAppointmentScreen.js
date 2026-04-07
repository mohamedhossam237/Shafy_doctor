import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Alert, Linking } from 'react-native';
import { 
  Text, TextInput, Button, IconButton, Surface, 
  useTheme, Divider, ActivityIndicator, Chip,
  SegmentedButtons, List, HelperText, Portal, Modal
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, query, where, getDocs, getDoc, 
  addDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../providers/AuthProvider';
import dayjs from 'dayjs';
import { getRelationLabel, getTodayString, normalizePhoneForWhatsApp, generateWhatsAppMessage } from '../lib/utils';

// Helpers
const pad = (n) => String(n).padStart(2, "0");
const mins = (hhmm) => {
  const [h = 0, m = 0] = String(hhmm).split(':').map(x => parseInt(x, 10) || 0);
  return h * 60 + m;
};
const weekdayKey = (date) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function NewAppointmentScreen({ navigation, route }) {
  const theme = useTheme();
  const { user } = useAuth();
  
  // Data State
  const [doctor, setDoctor] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [patients, setPatients] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  
  // Form State
  const [selectedPatient, setSelectedPatient] = useState(route?.params?.patient || null);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [dateStr, setDateStr] = useState(getTodayString());
  const [timeStr, setTimeStr] = useState('');
  const [type, setType] = useState('checkup');
  const [fees, setFees] = useState('');
  const [feesReason, setFeesReason] = useState('');
  const [note, setNote] = useState('');

  // UI State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    try {
      // 1. Fetch Doctor
      const docSnap = await getDoc(doc(db, 'doctors', user.uid));
      if (docSnap.exists()) {
        const d = ({ id: docSnap.id, ...docSnap.data() });
        setDoctor(d);
        const clns = d.clinics || [];
        setClinics(clns);

        // Smart Clinic Selection (Assistant App logic)
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const todayKey = weekdayKey(now);
        
        let defaultClinic = clns.find(c => {
          const hours = c.working_hours || {};
          const range = hours[todayKey];
          if (!range) return false;
          const [startS, endS] = range.split('-');
          return nowMins >= mins(startS) && nowMins < mins(endS);
        }) || clns[0] || null;

        if (defaultClinic) setSelectedClinicId(defaultClinic.id);
      }
      
      // 2. Fetch Patients
      const pSnap = await getDocs(query(collection(db, 'patients'), where('associatedDoctors', 'array-contains', user.uid)));
      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build Slots when Clinic/Date changes
  useEffect(() => {
    if (!doctor || !dateStr || !selectedClinicId) return;
    calculateSlots();
  }, [doctor, dateStr, selectedClinicId]);

  const calculateSlots = async () => {
    const selectedClinic = clinics.find(c => c.id === selectedClinicId) || doctor;
    const hours = selectedClinic?.working_hours || doctor?.working_hours;
    if (!hours) return;

    const day = weekdayKey(new Date(dateStr));
    const range = hours[day]; // format "09:00-17:00"
    if (!range || range === "") {
      setAvailableSlots([]);
      return;
    }

    const [startS, endS] = range.split('-');
    const [startH, startM] = startS.split(':').map(Number);
    const [endH, endM] = endS.split(':').map(Number);
    
    const step = hours.appointmentDuration || doctor?.appointmentDuration || doctor?.slotMinutes || 30;
    const slots = [];
    let current = startH * 60 + startM;
    const end = endH * 60 + endM;

    while (current + step <= end) {
      slots.push(`${pad(Math.floor(current/60))}:${pad(current%60)}`);
      current += step;
    }

    // Filter booked (Any patient)
    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', user.uid),
      where('date', '==', dateStr),
      where('clinicId', '==', selectedClinicId)
    );
    const snap = await getDocs(q);
    const booked = snap.docs
      .filter(d => d.data().status !== 'cancelled')
      .map(doc => doc.data().time);
    setAvailableSlots(slots.filter(s => !booked.includes(s)));
  };

  const basePrice = useMemo(() => {
    if (!doctor) return 0;
    return type === 'checkup' ? (doctor.checkupPrice || doctor.visitPrice || 0) : (doctor.followUpPrice || 0);
  }, [doctor, type]);

  const totalAmount = useMemo(() => {
    return Number(basePrice) + Number(fees || 0);
  }, [basePrice, fees]);

  const handleBook = async () => {
    if (!selectedPatient || !timeStr || !selectedClinicId) {
      Alert.alert('Missing Info', 'Please select a patient, clinic, and time.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Check if ANYONE already booked this slot (Double check)
      const slotQ = query(
        collection(db, 'appointments'),
        where('doctorId', '==', user.uid),
        where('date', '==', dateStr),
        where('time', '==', timeStr),
        where('clinicId', '==', selectedClinicId)
      );
      const slotSnap = await getDocs(slotQ);
      const isTaken = slotSnap.docs.some(d => d.data().status !== 'cancelled');
      if (isTaken) {
        Alert.alert('Conflict', 'This time slot was just taken by someone else.');
        setSubmitting(false);
        calculateSlots();
        return;
      }

      // 2. Check if THIS patient has appointment today
      const dupQ = query(
        collection(db, 'appointments'),
        where('doctorId', '==', user.uid),
        where('patientId', '==', selectedPatient.id),
        where('date', '==', dateStr)
      );
      const dupSnap = await getDocs(dupQ);
      const hasDup = dupSnap.docs.some(d => d.data().status !== 'cancelled');
      if (hasDup) {
        Alert.alert('Duplicate Booking', 'This patient already has an appointment今天.');
        setSubmitting(false);
        return;
      }

      const [y, m, d] = dateStr.split('-').map(Number);
      const [hh, mn] = timeStr.split(':').map(Number);
      const appointmentDate = new Date(y, m - 1, d, hh, mn);

      const payload = {
        doctorId: user.uid,
        doctorUID: user.uid,
        doctorName_en: doctor?.name_en || '',
        doctorName_ar: doctor?.name_ar || '',
        date: dateStr,
        time: timeStr,
        appointmentDate,
        appointmentType: type,
        bookingType: type,
        type: type,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientPhone: selectedPatient.phone,
        familyRelation: selectedPatient.familyRelation || 'himself',
        clinicId: selectedClinicId,
        basePrice: Number(basePrice),
        additionalFees: Number(fees || 0),
        extraCost: Number(fees || 0),
        extraReason: feesReason,
        totalAmount,
        totalCost: totalAmount,
        status: 'confirmed',
        source: 'Mobile_App',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'appointments'), payload);
      
      // WhatsApp Integration (Assistant App logic)
      const phone = normalizePhoneForWhatsApp(selectedPatient.phone);
      if (phone) {
        const msg = generateWhatsAppMessage(
          doctor?.name_ar || '', 
          doctor?.name_en || '', 
          dateStr, 
          timeStr, 
          selectedPatient.name
        );
        Linking.openURL(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      }

      Alert.alert('Success', 'Appointment booked successfully!');
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to book appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone?.includes(searchQuery)
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1976d2', '#42a5f5']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton icon="chevron-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text variant="headlineSmall" style={styles.headerTitle}>New Booking</Text>
          <View style={{ width: 48 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Patient Selection */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionLabel}>Patient Information</Text>
          {selectedPatient ? (
            <List.Item
              title={selectedPatient.name}
              subtitle={selectedPatient.phone}
              left={p => <Avatar.Text {...p} label={selectedPatient.name[0]} size={40} />}
              right={p => <IconButton icon="pencil" onPress={() => setShowPatientSearch(true)} />}
              style={styles.selectedPatient}
            />
          ) : (
            <Button mode="outlined" icon="account-search" onPress={() => setShowPatientSearch(true)} style={styles.searchInitiator}>
              Search Patient
            </Button>
          )}
        </Surface>

        {/* Clinic & Type */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionLabel}>Clinic & Service</Text>
          <SegmentedButtons
            value={type}
            onValueChange={setType}
            buttons={[
              { value: 'checkup', label: 'Examination' },
              { value: 'followup', label: 'Follow-up' },
            ]}
            style={styles.segmented}
          />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clinicList}>
            {clinics.map(c => (
              <Chip
                key={c.id}
                selected={selectedClinicId === c.id}
                onPress={() => setSelectedClinicId(c.id)}
                style={styles.clinicChip}
                showSelectedOverlay
              >
                {c.name_en || c.name_ar}
              </Chip>
            ))}
          </ScrollView>
        </Surface>

        {/* Date & Time */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionLabel}>Date & Time</Text>
          <View style={styles.inputRow}>
            <TextInput
              label="Date"
              value={dateStr}
              mode="outlined"
              editable={false}
              style={{ flex: 1 }}
              right={<TextInput.Icon icon="calendar" />}
            />
          </View>
          
          <View style={styles.slotsContainer}>
            {availableSlots.length > 0 ? (
              availableSlots.map(s => (
                <TouchableOpacity 
                  key={s} 
                  onPress={() => setTimeStr(s)}
                  style={[styles.slot, timeStr === s && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                >
                  <Text style={[styles.slotText, timeStr === s && { color: '#fff' }]}>{format12h(s, true)}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noSlots}>No slots available for this date.</Text>
            )}
          </View>
        </Surface>

        {/* Fees & Summary */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionLabel}>Payment Summary</Text>
          <View style={styles.totalRow}>
            <Text variant="bodyLarge">Total Amount</Text>
            <Text variant="headlineSmall" style={styles.totalText}>{totalAmount} EGP</Text>
          </View>
          <TextInput
            label="Additional Fees (Optional)"
            value={fees}
            onChangeText={setFees}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
          />
        </Surface>

        <Button 
          mode="contained" 
          onPress={handleBook} 
          loading={submitting}
          disabled={submitting}
          style={styles.bookBtn}
          contentStyle={{ height: 56 }}
        >
          Confirm Appointment
        </Button>
      </ScrollView>

      {/* Patient Search Modal */}
      <Portal>
        <Modal visible={showPatientSearch} onDismiss={() => setShowPatientSearch(false)} contentContainerStyle={styles.searchModal}>
          <Searchbar
            placeholder="Search patient..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.modalSearch}
          />
          <FlatList
            data={filteredPatients}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const rel = getRelationLabel(item.familyRelation);
              return (
                <List.Item
                  title={rel ? `${item.name} (${rel})` : item.name}
                  subtitle={item.phone}
                  onPress={() => {
                    setSelectedPatient(item);
                    setShowPatientSearch(false);
                  }}
                  left={p => <Avatar.Text {...p} label={item.name[0]} size={40} />}
                />
              );
            }}
            style={{ maxHeight: 400 }}
          />
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 50, paddingBottom: 15, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  scroll: { padding: 16 },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16 },
  sectionLabel: { fontWeight: 'bold', marginBottom: 12, color: '#1a237e' },
  searchInitiator: { borderRadius: 12 },
  selectedPatient: { backgroundColor: '#f0f4f8', borderRadius: 12 },
  segmented: { marginBottom: 16 },
  clinicList: { marginBottom: 8 },
  clinicChip: { marginRight: 8 },
  inputRow: { marginBottom: 16 },
  slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  slot: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
  slotText: { fontWeight: '500', color: '#555' },
  noSlots: { color: 'gray', fontStyle: 'italic' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalText: { color: '#2e7d32', fontWeight: 'bold' },
  bookBtn: { borderRadius: 16, marginBottom: 40 },
  searchModal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 20 },
  modalSearch: { marginBottom: 10 },
});

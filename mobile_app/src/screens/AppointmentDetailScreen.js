import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Text, Surface, IconButton, Divider, 
  Button, ActivityIndicator, useTheme, Avatar, Chip
} from 'react-native-paper';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import dayjs from 'dayjs';

export default function AppointmentDetailScreen({ route, navigation }) {
  const { appointmentId } = route.params;
  const theme = useTheme();
  
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appointmentId) return;

    const unsub = onSnapshot(doc(db, 'appointments', appointmentId), (snap) => {
      if (snap.exists()) {
        setAppointment({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [appointmentId]);

  const updateStatus = async (status) => {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), { status });
      Alert.alert('Success', `Appointment marked as ${status}`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!appointment) return <Text>Appointment not found</Text>;

  const initials = appointment.patientName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.header} elevation={0}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 48 }} />
      </Surface>

      <View style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <Chip 
            mode="flat" 
            style={[styles.statusChip, { backgroundColor: appointment.status === 'confirmed' ? '#e8f5e9' : '#fff3e0' }]}
            textStyle={{ color: appointment.status === 'confirmed' ? '#2e7d32' : '#ed6c02', fontWeight: 'bold' }}
          >
            {appointment.status?.toUpperCase()}
          </Chip>
        </View>

        {/* Patient Card */}
        <Surface style={styles.patientCard} elevation={1}>
          <View style={styles.patientInfo}>
            <Avatar.Text label={initials} size={50} />
            <View style={styles.patientNameContainer}>
              <Text variant="titleLarge" style={styles.patientName}>{appointment.patientName}</Text>
              <Text variant="bodyMedium" style={styles.patientPhone}>{appointment.patientPhone}</Text>
            </View>
            <IconButton icon="chevron-right" onPress={() => navigation.navigate('PatientDetail', { patientId: appointment.patientId })} />
          </View>
        </Surface>

        {/* Schedule Info */}
        <Surface style={styles.infoCard} elevation={1}>
          <View style={styles.infoRow}>
            <IconButton icon="calendar" style={styles.icon} />
            <View>
              <Text variant="labelSmall" style={styles.label}>Date</Text>
              <Text variant="bodyLarge">{dayjs(appointment.date).format('dddd, DD MMMM YYYY')}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <IconButton icon="clock-outline" style={styles.icon} />
            <View>
              <Text variant="labelSmall" style={styles.label}>Time</Text>
              <Text variant="bodyLarge">{appointment.time}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <IconButton icon="medical-bag" style={styles.icon} />
            <View>
              <Text variant="labelSmall" style={styles.label}>Service</Text>
              <Text variant="bodyLarge" style={{ textTransform: 'capitalize' }}>{appointment.appointmentType || 'Consultation'}</Text>
            </View>
          </View>
        </Surface>

        {/* Payment Summary */}
        <Surface style={styles.infoCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentRow}>
            <Text>Base Fee</Text>
            <Text style={styles.amount}>{(appointment.totalAmount || 0) - (appointment.additionalFees || 0)} EGP</Text>
          </View>
          {appointment.additionalFees > 0 && (
            <View style={styles.paymentRow}>
              <Text>Additional Fees</Text>
              <Text style={styles.amount}>{appointment.additionalFees} EGP</Text>
            </View>
          )}
          <Divider style={styles.divider} />
          <View style={styles.paymentRow}>
            <Text style={{ fontWeight: 'bold' }}>Total</Text>
            <Text style={styles.totalAmount}>{appointment.totalAmount || 0} EGP</Text>
          </View>
        </Surface>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {appointment.status !== 'confirmed' && (
            <Button mode="contained" onPress={() => updateStatus('confirmed')} style={[styles.actionBtn, {backgroundColor: '#1976d2'}]}>Confirm</Button>
          )}
          {appointment.status === 'confirmed' && (
            <Button mode="contained" onPress={() => updateStatus('arrived')} style={[styles.actionBtn, {backgroundColor: '#ed6c02'}]}>Mark as Arrived</Button>
          )}
          {appointment.status === 'arrived' && (
            <Button mode="contained" onPress={() => updateStatus('completed')} style={[styles.actionBtn, {backgroundColor: '#2e7d32'}]}>Mark as Completed</Button>
          )}
          <Button mode="outlined" onPress={() => updateStatus('cancelled')} textColor="#d32f2f" style={[styles.actionBtn, {borderColor: '#d32f2f'}]}>Cancel Appointment</Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 40, backgroundColor: '#fff' },
  headerTitle: { fontWeight: 'bold' },
  content: { padding: 16 },
  statusRow: { alignItems: 'center', marginBottom: 20 },
  statusChip: { paddingHorizontal: 10 },
  patientCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20 },
  patientInfo: { flexDirection: 'row', alignItems: 'center' },
  patientNameContainer: { marginLeft: 15, flex: 1 },
  patientName: { fontWeight: 'bold' },
  patientPhone: { color: 'gray' },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { margin: 0 },
  label: { color: 'gray' },
  sectionTitle: { fontWeight: 'bold', marginBottom: 15, color: '#1a237e' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  amount: { color: '#666' },
  totalAmount: { fontWeight: 'bold', fontSize: 18, color: '#2e7d32' },
  divider: { marginVertical: 12 },
  actionsContainer: { marginTop: 10 },
  actionBtn: { marginBottom: 12, borderRadius: 12 }
});

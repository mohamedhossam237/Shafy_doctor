import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { 
  Text, Avatar, Surface, IconButton, List, Divider, 
  Chip, Button, ActivityIndicator, useTheme, Card 
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../providers/AuthProvider';
import dayjs from 'dayjs';
import EditPatientModal from '../components/EditPatientModal';
import { getRelationLabel } from '../lib/utils';

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId } = route.params;
  const theme = useTheme();
  const { user } = useAuth();
  
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    // Listen to patient data
    const unsubPatient = onSnapshot(doc(db, 'patients', patientId), (snap) => {
      if (snap.exists()) {
        setPatient({ id: snap.id, ...snap.data() });
      }
    });

    // Listen to appointment history
    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const unsubHistory = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubPatient();
      unsubHistory();
    };
  }, [patientId]);

  const handleCall = () => {
    if (patient?.phone) Linking.openURL(`tel:${patient.phone}`);
  };

  const handleWhatsApp = () => {
    if (patient?.phone) {
      const cleanPhone = patient.phone.replace(/[^\d+]/g, '');
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const initials = patient?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1976d2', '#42a5f5']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>Patient Profile</Text>
          <IconButton icon="pencil" iconColor="#fff" onPress={() => setEditModalVisible(true)} />
        </View>
        
        <View style={styles.profileHeader}>
          <Avatar.Text label={initials} size={70} style={styles.avatar} />
          <View style={styles.nameContainer}>
            <Text variant="headlineSmall" style={styles.name}>{patient?.name}</Text>
            <View style={styles.badgeRow}>
              {getRelationLabel(patient?.familyRelation) ? (
                <Chip style={styles.relationChip} textStyle={{ fontSize: 10 }}>
                  {getRelationLabel(patient?.familyRelation)}
                </Chip>
              ) : null}
              <Text style={styles.idText}>ID: {patient?.id?.slice(-6)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Button icon="phone" mode="contained" onPress={handleCall} style={styles.actionBtn}>Call</Button>
          <Button icon="whatsapp" mode="contained" onPress={handleWhatsApp} style={[styles.actionBtn, { backgroundColor: '#25D366' }]}>Chat</Button>
          <Button icon="calendar-plus" mode="contained" onPress={() => navigation.navigate('NewAppointment', { patient })} style={[styles.actionBtn, { backgroundColor: '#FFD700' }]} textColor="#000">Book</Button>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vital Info */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Medical Info</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>Age</Text>
              <Text variant="bodyLarge">{patient?.age || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>Gender</Text>
              <Text variant="bodyLarge" style={{ textTransform: 'capitalize' }}>{patient?.gender || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>Blood Type</Text>
              <Text variant="bodyLarge">{patient?.bloodType || '--'}</Text>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <List.Item
            title="Allergies"
            description={patient?.allergies || 'None reported'}
            left={props => <List.Icon {...props} icon="alert-circle-outline" color="#d32f2f" />}
          />
          <List.Item
            title="Chronic Conditions"
            description={patient?.conditions || 'None reported'}
            left={props => <List.Icon {...props} icon="heart-pulse" color="#1976d2" />}
          />
        </Surface>

        {/* Visit History */}
        <Text variant="titleMedium" style={styles.historyTitle}>Visit History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No past visits found.</Text>
        ) : (
          history.map((item) => (
            <Card key={item.id} style={styles.visitCard} onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}>
              <Card.Content>
                <View style={styles.visitHeader}>
                  <Text variant="titleMedium" style={styles.visitDate}>
                    {dayjs(item.date).format('DD MMM YYYY')}
                  </Text>
                  <Chip style={styles.statusChip} textStyle={{ fontSize: 10 }}>{item.status.toUpperCase()}</Chip>
                </View>
                <Text variant="bodyMedium" style={styles.visitType}>{item.appointmentType?.toUpperCase() || 'CONSULTATION'}</Text>
                {item.note && <Text variant="bodySmall" numberOfLines={1} style={styles.visitNote}>{item.note}</Text>}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <EditPatientModal 
        visible={editModalVisible} 
        onDismiss={() => setEditModalVisible(false)} 
        patient={patient} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 50, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  profileHeader: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 15, alignItems: 'center' },
  avatar: { backgroundColor: 'rgba(255,255,255,0.2)' },
  nameContainer: { marginLeft: 15, flex: 1 },
  name: { color: '#fff', fontWeight: 'bold' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  relationChip: { height: 24, backgroundColor: '#e3f2fd', marginRight: 10 },
  idText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingHorizontal: 10 },
  actionBtn: { borderRadius: 10, flex: 1, marginHorizontal: 4 },
  scrollContent: { padding: 16 },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 15, color: '#1a237e' },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  infoItem: { flex: 1 },
  infoLabel: { color: 'gray' },
  divider: { marginVertical: 10 },
  historyTitle: { fontWeight: 'bold', marginBottom: 10, marginLeft: 5, color: '#1a237e' },
  visitCard: { marginBottom: 12, borderRadius: 15, backgroundColor: '#fff', elevation: 2 },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDate: { fontWeight: '600' },
  visitType: { color: 'gray', marginTop: 2 },
  visitNote: { color: '#666', marginTop: 5, fontStyle: 'italic' },
  statusChip: { height: 22, backgroundColor: '#f0f0f0' },
  emptyText: { textAlign: 'center', marginTop: 20, color: 'gray' }
});

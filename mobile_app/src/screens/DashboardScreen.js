import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Button, useTheme, ActivityIndicator, Chip, FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../providers/AuthProvider';

import { getRelationLabel, format12h, APPOINTMENT_TYPES, getTodayString } from '../lib/utils';

export default function DashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAppointments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const today = getTodayString();
  const todayApps = appointments.filter(a => a.date === today);
  const confirmedApps = todayApps.filter(a => a.status === 'confirmed');

  const handleConfirm = async (id) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { status: 'confirmed' });
    } catch (e) {
      console.error(e);
    }
  };

  const renderAppointment = ({ item }) => {
    const initials = item.patientName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const relLabel = getRelationLabel(item.familyRelation);
    const displayTitle = relLabel ? `${item.patientName} (${relLabel})` : item.patientName;
    const typeInfo = APPOINTMENT_TYPES[item.appointmentType] || { label: item.appointmentType || 'Consultation', color: '#757575', bg: '#f5f5f5' };
    
    return (
      <Card key={item.id} style={styles.appointmentCard}>
        <Card.Title
          title={displayTitle}
          subtitle={format12h(item.time, true)}
          left={(props) => <Avatar.Text {...props} label={initials} size={40} />}
          right={(props) => (
            <View style={styles.rightActions}>
              <Chip 
                mode="flat" 
                style={[styles.typeChip, { backgroundColor: typeInfo.bg, marginRight: 8 }]}
                textStyle={{ color: typeInfo.color, fontSize: 10, fontWeight: 'bold' }}
              >
                {typeInfo.label}
              </Chip>
              <Chip 
                mode="flat" 
                style={[
                  styles.statusChip, 
                  { backgroundColor: item.status === 'confirmed' ? '#e8f5e9' : '#fff3e0' }
                ]}
                textStyle={{ color: item.status === 'confirmed' ? '#2e7d32' : '#ed6c02', fontSize: 10 }}
              >
                {item.status?.toUpperCase() || 'BOOKED'}
              </Chip>
            </View>
          )}
        />
        <Card.Actions>
          {item.status !== 'confirmed' && (
            <Button mode="outlined" onPress={() => handleConfirm(item.id)}>Confirm</Button>
          )}
          <Button mode="contained" onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}>Details</Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text variant="headlineMedium" style={styles.welcomeText}>
              Welcome,
            </Text>
            <Text variant="titleLarge" style={styles.doctorName}>
               Dr. {user?.email?.split('@')[0] || 'Doctor'}
            </Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Avatar.Icon size={48} icon="logout" style={styles.avatar} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Today's Overview</Text>
          
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="labelMedium">Appointments</Text>
                <Text variant="headlineMedium">{todayApps.length}</Text>
              </Card.Content>
            </Card>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="labelMedium">Confirmed</Text>
                <Text variant="headlineMedium" style={{ color: theme.colors.success }}>{confirmedApps.length}</Text>
              </Card.Content>
            </Card>
          </View>

          <View style={styles.listHeaderRow}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Recent Bookings</Text>
            <Button mode="text" onPress={() => navigation.navigate('NewAppointment')}>View All</Button>
          </View>
          
          {appointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No appointments found.</Text>
            </View>
          ) : (
            appointments.slice(0, 10).map(item => renderAppointment({ item }))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <FAB
        icon="calendar-plus"
        label="New Booking"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#fff"
        onPress={() => navigation.navigate('NewAppointment')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.8)',
  },
  doctorName: {
    color: '#fff',
    fontWeight: 'bold',
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#1a237e',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 0.48,
    borderRadius: 16,
    elevation: 3,
    backgroundColor: '#fff',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  appointmentCard: {
    borderRadius: 16,
    elevation: 2,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  statusChip: {
    borderRadius: 8,
    height: 24,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typeChip: {
    borderRadius: 8,
    height: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: 'gray',
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 30,
    borderRadius: 28,
  },
});

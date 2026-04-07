import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Card, Avatar, Chip, useTheme, ActivityIndicator, FAB, Button } from 'react-native-paper';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../providers/AuthProvider';
import AddPatientModal from '../components/AddPatientModal';
import { getRelationLabel } from '../lib/utils';

export default function PatientsScreen({ navigation }) {
  const { user } = useAuth();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'patients'),
      where('associatedDoctors', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.phone?.includes(search)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const renderItem = ({ item }) => {
    const initials = item.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    
    return (
      <Card 
        style={styles.card} 
        onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
      >
        <Card.Title
          title={item.name}
          subtitle={item.phone}
          left={(props) => <Avatar.Text {...props} label={initials} size={40} />}
          right={(props) => (
            <View style={styles.chipsRow}>
              {getRelationLabel(item.familyRelation) ? (
                <Chip size="small" style={styles.relChip} textStyle={{ fontSize: 10 }}>
                  {getRelationLabel(item.familyRelation)}
                </Chip>
              ) : null}
            </View>
          )}
        />
        <Card.Actions>
          <Button mode="text" onPress={() => navigation.navigate('NewAppointment', { patient: item })}>
            Book Appointment
          </Button>
          <Button mode="contained-tonal" onPress={() => {}}>
            View Profile
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Patients</Text>
        <Searchbar
          placeholder="Search name or phone..."
          onChangeText={setSearch}
          value={search}
          style={styles.searchBar}
          elevation={1}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No patients found.</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        label="Add Patient"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#fff"
        onPress={() => setModalVisible(true)}
      />

      <AddPatientModal 
        visible={modalVisible} 
        onDismiss={() => setModalVisible(false)} 
        onSaved={() => {}}
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a237e',
  },
  searchBar: {
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  chipsRow: {
    marginRight: 16,
  },
  relChip: {
    backgroundColor: '#e3f2fd',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
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

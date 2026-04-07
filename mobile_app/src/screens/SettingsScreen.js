import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Avatar, List, Divider, Button, Surface, IconButton, useTheme } from 'react-native-paper';
import { useAuth } from '../providers/AuthProvider';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1976d2', '#42a5f5']} style={styles.header}>
        <View style={styles.profileHeader}>
          <Avatar.Icon icon="account" size={80} style={styles.avatar} color="#fff" />
          <View style={styles.doctorInfo}>
            <Text variant="headlineSmall" style={styles.name}>Dr. {user?.email?.split('@')[0]}</Text>
            <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Profile Settings</Text>
          <List.Item
            title="Edit Profile"
            left={props => <List.Icon {...props} icon="account-edit-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
          <Divider />
          <List.Item
            title="Professional Info"
            left={props => <List.Icon {...props} icon="certificate-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Practice Settings</Text>
          <List.Item
            title="Clinic Locations"
            left={props => <List.Icon {...props} icon="map-marker-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
          <Divider />
          <List.Item
            title="Fees & Services"
            left={props => <List.Icon {...props} icon="cash-multiple" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
          <Divider />
          <List.Item
            title="Working Hours"
            left={props => <List.Icon {...props} icon="clock-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
          />
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Account</Text>
          <List.Item
            title="Notifications"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <IconButton icon="toggle-switch" />}
          />
          <Divider />
          <List.Item
            title="Sign Out"
            titleStyle={{ color: '#d32f2f' }}
            left={props => <List.Icon {...props} icon="logout" color="#d32f2f" />}
            onPress={signOut}
          />
        </Surface>

        <Text style={styles.versionText}>Shafy Doctor Mobile v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25 },
  avatar: { backgroundColor: 'rgba(255,255,255,0.2)' },
  doctorInfo: { marginLeft: 20 },
  name: { color: '#fff', fontWeight: 'bold' },
  email: { color: 'rgba(255,255,255,0.8)' },
  scrollContent: { padding: 20 },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 10, marginBottom: 20 },
  sectionTitle: { fontWeight: 'bold', margin: 10, color: '#1a237e' },
  versionText: { textAlign: 'center', color: 'gray', fontSize: 12, marginTop: 10, marginBottom: 30 }
});

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { emailLogin } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await emailLogin(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#1976d2', '#42a5f5']}
          style={styles.background}
        />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text variant="displaySmall" style={styles.title}>Shafy Doctor</Text>
            <Text variant="titleMedium" style={styles.subtitle}>Modern Patient Management</Text>
          </View>

          <Surface style={styles.card} elevation={4}>
            <Text variant="headlineSmall" style={styles.cardTitle}>Login</Text>
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />

            {error ? <HelperText type="error">{error}</HelperText> : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>
            
            <Button
              mode="text"
              onPress={() => {}}
              style={styles.forgotBtn}
            >
              Forgot Password?
            </Button>
          </Surface>
          
          <Text style={styles.footer}>© 2026 Shafy Inc.</Text>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1a237e',
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
  },
  buttonContent: {
    height: 48,
  },
  forgotBtn: {
    marginTop: 8,
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 48,
    fontSize: 12,
  },
});

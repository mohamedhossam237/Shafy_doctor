import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Image } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { emailLogin } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await emailLogin(email.trim().toLowerCase(), password.trim());
    } catch (err) {
      const code = err?.code;
      let msg = 'Login failed';
      if (code === 'auth/invalid-email') msg = 'Invalid email address';
      else if (code === 'auth/user-not-found') msg = 'User not found';
      else if (code === 'auth/wrong-password') msg = 'Incorrect password';
      else if (err?.message) msg = `Login failed: ${err.message}`;
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.formContainer}>
            <View style={styles.header}>
              <MaterialCommunityIcons name="lock-outline" size={32} color={theme.colors.primary} />
              <Text variant="headlineSmall" style={styles.title}>Sign In</Text>
            </View>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              theme={{ roundness: 8 }}
            />
            
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              theme={{ roundness: 8 }}
              right={
                <TextInput.Icon 
                  icon={showPassword ? "eye-off" : "eye"} 
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}

            <View style={styles.forgotPasswordContainer}>
              <Button
                mode="text"
                onPress={() => {}}
                labelStyle={styles.forgotBtnText}
                compact
              >
                Forgot Password?
              </Button>
            </View>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Sign In
            </Button>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    fontWeight: '700',
    marginTop: 8,
    color: '#000000',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  button: {
    borderRadius: 8,
    marginVertical: 4,
  },
  buttonContent: {
    height: 48,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});

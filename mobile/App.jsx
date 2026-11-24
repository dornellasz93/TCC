import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/theme';
import { loadStoredSession, saveAuthSession, clearAuthSession } from './src/services/api';
import AuthScreen from './src/screens/AuthScreen';
import StudentScreen from './src/screens/StudentScreen';
import TeacherScreen from './src/screens/TeacherScreen';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadStoredSession()
      .then(({ user: savedUser, token }) => {
        if (savedUser && token) {
          setUser(savedUser);
        }
      })
      .finally(() => setBooting(false));
  }, []);

  const handleAuthenticated = (loggedUser) => {
    setUser(loggedUser);
  };

  const handleUserUpdated = async (updatedUser) => {
    setUser(updatedUser);
    await saveAuthSession(updatedUser, null);
  };

  const handleLogout = async () => {
    await clearAuthSession();
    setUser(null);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      {booting ? (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : !user ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : user.role === 'teacher' ? (
        <TeacherScreen user={user} onLogout={handleLogout} />
      ) : (
        <StudentScreen user={user} onUserUpdated={handleUserUpdated} onLogout={handleLogout} />
      )}
    </SafeAreaProvider>
  );
}

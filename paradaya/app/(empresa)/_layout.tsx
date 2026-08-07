import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

function Icono({ children, focused }: { children: string; focused: boolean }) {
  return (
    <View style={styles.iconoBox}>
      <Text style={[styles.icono, { color: focused ? colors.accent : colors.textMuted }]}>
        {children}
      </Text>
    </View>
  );
}

export default function EmpresaTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="paradas"
        options={{
          title: 'Mis paradas de planta',
          tabBarLabel: 'Paradas',
          tabBarIcon: ({ focused }) => <Icono focused={focused}>▤</Icono>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil de empresa',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ focused }) => <Icono focused={focused}>◍</Icono>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconoBox: { alignItems: 'center', justifyContent: 'center' },
  icono: { fontSize: 20 },
});

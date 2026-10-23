import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Source } from './src/lib/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { useEditorFonts } from './src/skia/fonts';
import { colors } from './src/ui';

export default function App() {
  const fonts = useEditorFonts();
  const [session, setSession] = useState<{ source: Source; key: number } | null>(null);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg, direction: 'ltr' }}>
        <StatusBar style="light" />
        {session ? (
          <EditorScreen key={session.key} source={session.source} fonts={fonts} onClose={() => setSession(null)} />
        ) : (
          <HomeScreen onSource={(source) => setSession({ source, key: Date.now() })} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

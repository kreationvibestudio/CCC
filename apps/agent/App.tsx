import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LoginScreen } from "./src/LoginScreen";
import { PortalScreen } from "./src/PortalScreen";
import { getAccessToken } from "./src/session";
import { colors } from "./src/theme";

export default function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  async function hydrate() {
    const token = await getAccessToken();
    setSignedIn(Boolean(token));
    setReady(true);
  }

  useEffect(() => {
    void hydrate();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color="#93c5fd" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        {signedIn ? (
          <PortalScreen onSignOut={() => setSignedIn(false)} />
        ) : (
          <LoginScreen onSignedIn={() => setSignedIn(true)} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

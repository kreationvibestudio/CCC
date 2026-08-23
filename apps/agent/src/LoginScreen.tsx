import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { AgentAuthError, agentApi } from "./api";
import { saveSession, signIn, signOut } from "./session";
import { colors } from "./theme";

function formatCodeInput(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailMode, setEmailMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function readGps() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      throw new Error("Allow location so we can confirm you are at your polling unit.");
    }
    const last = await Location.getLastKnownPositionAsync();
    const freshEnough = last && Date.now() - last.timestamp < 60_000;
    const pos = freshEnough
      ? last
      : await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (!pos) throw new Error("Could not read GPS. Stand outdoors at the unit and try again.");
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  }

  async function submitCode() {
    setError("");
    if (code.replace(/[^A-Z0-9]/gi, "").length !== 8) {
      setError("Enter the 8-character code HQ gave you");
      return;
    }
    setLoading(true);
    try {
      const gps = await readGps();
      const result = await agentApi.codeLogin(code, gps.latitude, gps.longitude);
      await saveSession(result.session);
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitEmail() {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      try {
        await agentApi.session();
      } catch (e) {
        await signOut();
        if (e instanceof AgentAuthError && e.status === 403) {
          throw new Error("This account cannot use the Agent app. Ask HQ to issue a Field Agent code under Polling units → PU Agents.");
        }
        throw e;
      }
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.mark}>
          <Text style={styles.markText}>CCC</Text>
        </View>
        <Text style={styles.title}>CCC Agent</Text>
        <Text style={styles.sub}>
          Enter the code HQ assigned to your polling unit. You must be at that unit — GPS is checked at sign-in.
        </Text>
        {!emailMode ? (
          <>
            <TextInput
              style={[styles.input, styles.codeInput]}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              placeholder="XXXX-XXXX"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(value) => setCode(formatCodeInput(value))}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={() => void submitCode()} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in at this unit</Text>}
            </Pressable>
            <Pressable onPress={() => { setEmailMode(true); setError(""); }}>
              <Text style={styles.link}>Use email and password instead</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@campaign.ng"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.button} onPress={() => void submitEmail()} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>
            <Pressable onPress={() => { setEmailMode(false); setError(""); }}>
              <Text style={styles.link}>Use agent code instead</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  markText: { color: "#93c5fd", fontWeight: "800", fontSize: 18 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.muted, marginBottom: 12, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 12,
    backgroundColor: colors.card,
  },
  codeInput: { fontSize: 22, letterSpacing: 3, fontWeight: "700", textAlign: "center" },
  error: { color: colors.dangerText },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#93c5fd", textAlign: "center", paddingVertical: 8 },
});

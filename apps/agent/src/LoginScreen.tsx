import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AgentAuthError, agentApi } from "./api";
import { signIn, signOut } from "./session";
import { colors } from "./theme";

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
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
          throw new Error("This account cannot use the Agent app. Ask HQ to create a Field Agent login under Polling units → PU Agents.");
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
      <View style={styles.mark}>
        <Text style={styles.markText}>CCC</Text>
      </View>
      <Text style={styles.title}>CCC Agent</Text>
      <Text style={styles.sub}>Sign in with the login HQ assigned to you. This app is for polling agents only — HQ stays on the web.</Text>
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
      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24, gap: 12 },
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
  error: { color: colors.dangerText },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});

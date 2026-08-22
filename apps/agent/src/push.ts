import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { agentApi } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function listenForHqNudges() {
  const received = Notifications.addNotificationReceivedListener((event) => {
    const title = event.request.content.title ?? "Campaign HQ";
    const body = event.request.content.body ?? "Please submit your polling unit update.";
    Alert.alert(title, body);
  });
  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const title = event.notification.request.content.title ?? "Campaign HQ";
    const body = event.notification.request.content.body ?? "Please submit your polling unit update.";
    Alert.alert(title, body);
  });
  return () => {
    received.remove();
    response.remove();
  };
}

export async function registerPushToken() {
  if (!Device.isDevice) return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("agent-alerts", {
      name: "HQ alerts",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await agentApi.pushToken(token);
  } catch {
    /* EAS projectId is required for a real token; preview builds after eas init. */
  }
}

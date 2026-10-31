import { getCurrentUser } from "@/lib/auth/session";
import {
  getPollingUnitFocusState,
  getPollingUnitLgas,
  getPollingUnitStates,
} from "@/lib/polling-units/actions";
import { getFieldStatusMapData } from "@/lib/maps/field-status";
import { VotersMapView } from "@/components/maps/voters-map-view";

export default async function MapsPage() {
  const user = await getCurrentUser();
  const [states, focusState, initial] = await Promise.all([
    getPollingUnitStates(),
    getPollingUnitFocusState(),
    getFieldStatusMapData(),
  ]);
  const initialState =
    focusState && states.some((s) => s.toLowerCase() === focusState.toLowerCase())
      ? states.find((s) => s.toLowerCase() === focusState.toLowerCase())!
      : states.find((s) => s.toUpperCase().startsWith("EDO")) || states[0] || "";
  const lgas = initialState ? await getPollingUnitLgas(initialState) : [];
  if (!user) return null;
  return (
    <VotersMapView
      states={states}
      initialState={initialState}
      lgas={lgas}
      initial={initial}
    />
  );
}

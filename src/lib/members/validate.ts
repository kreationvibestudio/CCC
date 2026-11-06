export type MemberRegistrationInput = {
  firstName: string;
  lastName: string;
  phone: string;
  votersCardNumber: string;
  membershipCardNumber: string;
  state?: string;
  lga: string;
  ward: string;
  unitCode?: string;
  unitName?: string;
  pollingUnitId?: string;
};

export type ValidatedMemberRegistration = {
  firstName: string;
  lastName: string;
  phone: string;
  votersCardNumber: string;
  membershipCardNumber: string;
  state: string | null;
  lga: string;
  ward: string;
  unitCode: string | null;
  unitName: string | null;
  pollingUnitId: string | null;
};

export function cleanPhone(raw: string) {
  return raw.replace(/[^\d+]/g, "").trim();
}

export function validateMemberRegistration(
  input: MemberRegistrationInput
): { error: string } | { value: ValidatedMemberRegistration } {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = cleanPhone(input.phone);
  const votersCardNumber = input.votersCardNumber.trim().toUpperCase();
  const membershipCardNumber = input.membershipCardNumber.trim().toUpperCase();
  const state = (input.state ?? "").trim() || null;
  const lga = input.lga.trim();
  const ward = input.ward.trim();
  const unitCode = (input.unitCode ?? "").trim() || null;
  const unitName = (input.unitName ?? "").trim() || null;
  const pollingUnitId = (input.pollingUnitId ?? "").trim() || null;

  if (firstName.length < 2) return { error: "Enter the member's first name." };
  if (lastName.length < 2) return { error: "Enter the member's last name." };
  if (phone.replace(/\D/g, "").length < 10) {
    return { error: "Enter a valid Nigerian phone number." };
  }
  if (votersCardNumber.length < 5) {
    return { error: "Enter the voter's card number." };
  }
  if (membershipCardNumber.length < 3) {
    return { error: "Enter the NDC party card membership number." };
  }
  if (!lga) return { error: "Select an LGA." };
  if (!ward) return { error: "Select a ward." };
  if (!pollingUnitId && !unitCode) return { error: "Select a polling unit." };

  return {
    value: {
      firstName,
      lastName,
      phone,
      votersCardNumber,
      membershipCardNumber,
      state,
      lga,
      ward,
      unitCode,
      unitName,
      pollingUnitId,
    },
  };
}

export function memberDisplayName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

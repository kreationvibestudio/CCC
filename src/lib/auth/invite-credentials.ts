/** Plain-text block for WhatsApp / SMS after an HQ invite. */
export function formatInviteCredentials(input: {
  username: string;
  password: string;
  loginUrl: string;
}): string {
  return [
    `Username: ${input.username}`,
    `Temporary password: ${input.password}`,
    `Login: ${input.loginUrl}`,
  ].join("\n");
}

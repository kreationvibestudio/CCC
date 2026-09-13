export const UNKNOWN_FACEBOOK_AUTHOR = "Facebook User";
export const UNKNOWN_FACEBOOK_AUTHOR_LABEL = "Unknown commenter";

export type FacebookCommentFrom = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  picture?: { data?: { url?: string } };
};

export type FacebookCommentAuthorSource = {
  from?: FacebookCommentFrom;
  username?: string;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isPlaceholderFacebookAuthor(name?: string | null) {
  const trimmed = clean(name);
  if (!trimmed) return true;
  return /^(facebook user|unknown commenter|anonymous user)$/i.test(trimmed);
}

/** Label for the inbox. Graph often omits visitor names; do not show "Facebook User" as a person. */
export function displayFacebookAuthor(name?: string | null) {
  if (isPlaceholderFacebookAuthor(name)) return UNKNOWN_FACEBOOK_AUTHOR_LABEL;
  return clean(name) ?? UNKNOWN_FACEBOOK_AUTHOR_LABEL;
}

/** Display name from Graph `from.name`, then username, then a prior stored name. */
export function resolveFacebookCommentAuthor(
  comment: FacebookCommentAuthorSource,
  existingName?: string | null
): { authorName: string; authorAvatar?: string; username?: string } {
  const from = comment.from;
  const displayName = clean(from?.name);
  const firstLast = [clean(from?.first_name), clean(from?.last_name)].filter(Boolean).join(" ");
  const username = clean(from?.username) || clean(comment.username);
  const existing = isPlaceholderFacebookAuthor(existingName) ? undefined : clean(existingName);

  return {
    authorName: displayName || firstLast || username || existing || UNKNOWN_FACEBOOK_AUTHOR,
    authorAvatar: from?.picture?.data?.url,
    username,
  };
}

export function mergeFacebookCommentFrom(
  target: FacebookCommentAuthorSource,
  extra?: FacebookCommentFrom | null
) {
  if (!extra) return;
  target.from = {
    ...target.from,
    ...extra,
    name: extra.name || target.from?.name,
    first_name: extra.first_name || target.from?.first_name,
    last_name: extra.last_name || target.from?.last_name,
    username: extra.username || target.from?.username,
    picture: extra.picture || target.from?.picture,
  };
}

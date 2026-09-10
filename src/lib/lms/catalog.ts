import type { SupportRoleSlug } from "./roles";
import { VOLUNTEER_SUPPORT_ROLES } from "./roles";

export type ModuleKind = "lesson" | "video" | "resource" | "quiz" | "acknowledgement" | "assignment";

export type CatalogQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
};

export type CatalogModule = {
  slug: string;
  title: string;
  kind: ModuleKind;
  minutes: number;
  body?: string;
  resourceUrl?: string;
  questions?: CatalogQuestion[];
};

export type CatalogCourse = {
  slug: string;
  title: string;
  description: string;
  roleSlug: SupportRoleSlug | null;
  minutes: number;
  modules: CatalogModule[];
};

function q(id: string, prompt: string, choices: string[], answer: number): CatalogQuestion {
  return { id, prompt, choices, answer };
}

function lesson(slug: string, title: string, minutes: number, body: string): CatalogModule {
  return { slug, title, kind: "lesson", minutes, body };
}

function quiz(slug: string, title: string, questions: CatalogQuestion[]): CatalogModule {
  return { slug, title, kind: "quiz", minutes: 6, questions };
}

const CORE: CatalogCourse = {
  slug: "core-campaign-briefing",
  title: "Core campaign briefing",
  description: "Required for every volunteer: values, messaging, safety, data protection, and how we talk to voters.",
  roleSlug: null,
  minutes: 45,
  modules: [
    lesson(
      "values-conduct",
      "Campaign values and conduct",
      6,
      "You represent this campaign in every conversation. Be respectful, honest, and calm — even when someone disagrees. Never offer money, gifts, or threats for a vote. Do not speak for the candidate on issues you have not been briefed on. If you are unsure, say you will check with HQ.\n\nDress neatly, arrive on time, and follow the team lead. Harassment, hate speech, or fighting of any kind is grounds for removal."
    ),
    lesson(
      "campaign-messaging",
      "Campaign messaging",
      6,
      "Stick to the approved talking points: who we are, what we will do, and how voters can take part. Do not invent policies. Do not attack opponents with rumours. If a journalist asks for a quote, direct them to HQ.\n\nWhen a voter raises a local issue, listen first, write it down, and report it. Listening is part of the message."
    ),
    {
      slug: "messaging-ack",
      title: "Acknowledge the messaging rules",
      kind: "acknowledgement",
      minutes: 2,
      body: "I will only use approved campaign talking points, I will not spread rumours, and I will send press requests to HQ.",
    },
    lesson(
      "volunteer-safety",
      "Volunteer safety",
      5,
      "Work in pairs when canvassing. Tell your team lead where you are going. Do not enter a compound if you feel unsafe. Carry water, keep your phone charged, and know the emergency contact for your ward.\n\nDo not argue in the street. Walk away from any confrontation and report it. After dark, stay on main roads and travel with the group."
    ),
    lesson(
      "data-protection",
      "Data protection",
      5,
      "Voter names, phone numbers, and PVC details are confidential. Do not share lists on WhatsApp groups outside the campaign. Do not photograph a voter’s card unless HQ has asked for a specific, consented check.\n\nUse the campaign tools you are given. If a device is lost, tell HQ immediately."
    ),
    lesson(
      "voter-etiquette",
      "Voter engagement etiquette",
      5,
      "Introduce yourself and the campaign in one sentence. Ask if it is a good time. Accept no as an answer. Never block a doorway or follow someone who walks away.\n\nBe especially careful with older voters, people at work, and places of worship — follow local custom and the team lead."
    ),
    lesson(
      "reporting-issues",
      "Reporting issues",
      5,
      "Report incidents, intimidation, missing materials, or rumours through HQ as soon as you can. Include time, place, what you saw, and who was there. Do not post incidents on social media yourself.\n\nPolling-day issues go to the Situation Room. Training issues go to your volunteer coordinator."
    ),
    {
      slug: "core-resource",
      title: "Download: field conduct card",
      kind: "resource",
      minutes: 1,
      body: "Keep this one-page reminder with you in the field.",
      resourceUrl: "/learn/resources/conduct-card",
    },
    quiz("core-quiz", "Core knowledge check", [
      q("c1", "If a voter asks about a policy you have not been briefed on, you should:", [
        "Invent an answer so they are not disappointed",
        "Say you will check with HQ and take their contact",
        "Argue until they agree",
      ], 1),
      q("c2", "Voter phone numbers collected in the field may be:", [
        "Posted in any campaign WhatsApp group",
        "Used only in official campaign tools and kept confidential",
        "Sold to help raise funds",
      ], 1),
      q("c3", "If a conversation becomes heated at the door, you should:", [
        "Walk away and report it to your team lead",
        "Raise your voice to match theirs",
        "Film them without consent",
      ], 0),
    ]),
  ],
};

const ROLE_COPY: Record<SupportRoleSlug, { title: string; description: string; lessons: [string, string, string] }> = {
  field_canvassing: {
    title: "Field canvassing",
    description: "Door-to-door outreach: turf, scripts, logging contacts, and handing off issues.",
    lessons: [
      "Work your assigned streets only. Mark each compound: home, not home, declined, or follow up. Never skip the log — HQ uses it to avoid visiting the same house twice.",
      "Open with your name and the campaign. Ask one question at a time. Note the voter’s main issue in their words, not yours.",
      "Leave literature only if the voter accepts it. Do not put flyers in gates or under wipers where it is not allowed.",
    ],
  },
  phone_banking: {
    title: "Phone banking",
    description: "Call scripts, consent, call outcomes, and when to stop a conversation.",
    lessons: [
      "Call only from the list HQ gives you. Introduce the campaign immediately. If they ask not to be called again, mark Do not call.",
      "Keep calls short. Capture support level and the main issue. Never record a call unless HQ has set that up with consent.",
      "Do not debate on the phone. Thank them, log the outcome, and move to the next number.",
    ],
  },
  voter_registration: {
    title: "Voter registration support",
    description: "Help people check their registration and PVC status without collecting extra data.",
    lessons: [
      "Explain how to check the INEC register. You are a guide, not INEC staff. Never promise a PVC.",
      "Do not keep photocopies of IDs. Point people to official channels and campaign help desks.",
      "Log how many people you assisted and any barriers (distance, disability, missing names) for HQ.",
    ],
  },
  digital_outreach: {
    title: "Social media and digital outreach",
    description: "Share approved posts, report abuse, and never impersonate the campaign.",
    lessons: [
      "Share only content from official pages. Do not create fake accounts or buy fake engagement.",
      "If you see misinformation, screenshot, note the URL, and send it to HQ. Do not pile on in comments.",
      "Disclose that you volunteer if you are posting about the campaign from a personal account.",
    ],
  },
  event_support: {
    title: "Event and rally support",
    description: "Crowd flow, materials, accessibility, and incident reporting at events.",
    lessons: [
      "Arrive early. Know the entrance, water, first aid, and who the event lead is.",
      "Keep walkways clear. Help older guests and people with disabilities first.",
      "If capacity is reached, stop entry calmly and radio the lead. Never force a crowd.",
    ],
  },
  polling_day: {
    title: "Polling-day operations",
    description: "Your role at the unit, what you may not do, and how to escalate incidents.",
    lessons: [
      "You are a campaign volunteer, not INEC. Do not touch ballot materials or interfere with officials.",
      "Watch, note, and report. Use the HQ reporting channel. Stay within the rules on observation.",
      "Know the difference between a delay, a minor issue, and a serious incident — and who to call.",
    ],
  },
  data_crm: {
    title: "Data entry and CRM",
    description: "Accurate records, no duplicate contacts, and respect for supporter data.",
    lessons: [
      "Enter names and phones exactly as given. Do not guess missing fields.",
      "Search before creating a contact. Duplicates waste call time and annoy supporters.",
      "Never export a list to personal email or a private drive.",
    ],
  },
  community_outreach: {
    title: "Community outreach",
    description: "Meetings with local groups, respect for custom, and capturing community asks.",
    lessons: [
      "Go with a team lead to first meetings with traditional, religious, or youth leaders.",
      "Listen more than you speak. Write down requests and report them — do not make promises HQ cannot keep.",
      "Follow dress and greeting customs. Leave when asked.",
    ],
  },
  fundraising: {
    title: "Fundraising",
    description: "Receipts, official channels only, and never cash in a personal account.",
    lessons: [
      "Direct donors to the official Paystack or HQ process. Do not collect cash into a personal wallet.",
      "Thank people and log the pledge. HQ issues receipts.",
      "Never suggest that a donation buys a job, contract, or favour.",
    ],
  },
  team_leadership: {
    title: "Volunteer team leadership",
    description: "Brief your team, track attendance, and escalate welfare or conduct issues.",
    lessons: [
      "Start every shift with a 5-minute briefing: turf, script, safety, and who to call.",
      "Check who arrived, who is missing, and who needs a ride or water. Log it.",
      "If someone breaks conduct rules, pause their work and call the volunteer coordinator. Do not handle it alone on social media.",
    ],
  },
};

function roleCourse(slug: SupportRoleSlug): CatalogCourse {
  const copy = ROLE_COPY[slug];
  const role = VOLUNTEER_SUPPORT_ROLES.find((r) => r.slug === slug)!;
  return {
    slug: `role-${slug}`,
    title: copy.title,
    description: copy.description,
    roleSlug: slug,
    minutes: 25,
    modules: [
      lesson("procedure-1", `${role.short}: how the shift works`, 7, copy.lessons[0]),
      lesson("procedure-2", `${role.short}: field standards`, 7, copy.lessons[1]),
      {
        slug: "field-assignment",
        title: `${role.short}: practice note`,
        kind: "assignment",
        minutes: 5,
        body: `Write 2–3 sentences on how you will apply this role in your ward. Your coordinator can review it.`,
      },
      quiz("role-quiz", `${role.short} check`, [
        q("r1", "The main purpose of this role training is to:", [
          "Replace HQ instructions with your own",
          "Follow campaign procedure for this assignment",
          "Skip the core briefing",
        ], 1),
        q("r2", copy.lessons[2].slice(0, 80) + " — you should:", [
          "Ignore HQ if it is slower",
          "Follow the standard and report problems",
          "Post complaints publicly first",
        ], 1),
        q("r3", "If you are unsure what to do in the field:", [
          "Guess and hope",
          "Ask your team lead or coordinator",
          "Leave without telling anyone",
        ], 1),
      ]),
    ],
  };
}

export const LMS_CATALOG: CatalogCourse[] = [
  CORE,
  ...VOLUNTEER_SUPPORT_ROLES.map((r) => roleCourse(r.slug)),
];

export function catalogCourseBySlug(slug: string) {
  return LMS_CATALOG.find((c) => c.slug === slug);
}
